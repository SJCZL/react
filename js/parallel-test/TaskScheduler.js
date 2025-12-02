/**
 * TaskScheduler - UI-less manager for multiple TaskOrchestrator tasks.
 *
 * Responsibilities:
 * - Create, start, abort, delete tasks
 * - Track status/stage/results for many tasks
 * - Multiplex task events and allow subscription per-task or wildcard "*"
 * - Concurrency caps: generating=10, evaluating=10 with FIFO queue
 * - CSV export/import via js/utils/csv.mjs (ENTIRE snapshots serialized: meta, inputs, artifacts, lastError)
 *
 * Public API:
 * - constructor({ apiKey, genCap=10, evalCap=10 }?)
 * - on(eventName, handler) // eventName can be specific like "taskEvent" or "*" wildcard via onTaskEvent
 * - off(eventName, handler)
 * - onTaskEvent(taskIdOrWildcard, handler) // "taskId" or "*" for all
 * - createTask({ id?, name?, inputs }) -> taskId
 * - startTask(taskId)
 * - abortTask(taskId)
 * - deleteTask(taskId)
 * - listTasks(filter?: { status?, stage? }) -> array of {id,name,status,stage,createdAt,updatedAt}
 * - getTask(taskId) -> detailed snapshot { meta, inputs, artifacts }
 * - exportCSV() -> string
 * - importCSV(csvString) -> { imported:int, errors:int }
 *
 * Events:
 * - taskEvent: { taskId, event, payload } // proxied from TaskOrchestrator emit
 * - taskStatus: { taskId, status, stage, updatedAt }
 * - schedulerQueue: { type:"enqueue"|"dequeue"|"start", phase:"generation"|"evaluation", taskId }
 */

import { TaskOrchestrator } from './TaskOrchestrator.js';
import * as CSV from '../utils/csv.mjs';

export class TaskScheduler {
  constructor({ apiKey = null, genCap = 10, evalCap = 10 } = {}) {
    this.apiKey = apiKey || null;
    this.genCap = genCap;
    this.evalCap = evalCap;

    // Registries
    this._tasks = new Map(); // taskId -> { orchestrator, meta, inputs, artifactsCache }
    this._handlers = new Map(); // eventName -> Set(handler)
    this._wildcardHandlers = new Set(); // for onTaskEvent("*", ...)

    // Queues for phases
    this._genActive = new Set(); // taskIds currently generating
    this._genQueue = []; // pending start generation

    // Notes:
    // Evaluation concurrency is enforced at orchestrator-phase level by permitting only genCap generation starts concurrently.
    // AS/RS run inside each orchestrator; evalCap can be used as a higher-level limit to enqueue tasks waiting for evaluation if desired.
    // For simplicity, we enforce genCap only; AS/RS run after generation without global cap. evalCap retained for future extension.

    // Bindings
    this._forwardTaskEvents = this._forwardTaskEvents.bind(this);
  }

  // Event bus
  on(eventName, handler) {
    if (!this._handlers.has(eventName)) {
      this._handlers.set(eventName, new Set());
    }
    this._handlers.get(eventName).add(handler);
  }

  off(eventName, handler) {
    const set = this._handlers.get(eventName);
    if (set) set.delete(handler);
  }

  emit(eventName, payload) {
    const set = this._handlers.get(eventName);
    if (set) {
      for (const h of set) {
        try { h(payload); } catch (e) { console.warn('[TaskScheduler] handler error', e); }
      }
    }
  }

  /**
   * Subscribe to all per-task events with wildcard "*" or a specific taskId.
   * @param {string} taskIdOrWildcard
   * @param {(evt:{taskId:string,event:string,payload:any})=>void} handler
   */
  onTaskEvent(taskIdOrWildcard, handler) {
    if (taskIdOrWildcard === '*') {
      this._wildcardHandlers.add(handler);
      return () => this._wildcardHandlers.delete(handler);
    }
    // Attach to per-task channel via generic "taskEvent", filter in callback
    const wrapped = (evt) => {
      if (evt.taskId === taskIdOrWildcard) handler(evt);
    };
    this.on('taskEvent', wrapped);
    return () => this.off('taskEvent', wrapped);
  }

  _emitTaskEvent(taskId, event, payload) {
    const evt = { taskId, event, payload };
    // named channel
    this.emit('taskEvent', evt);
    // wildcard subscribers
    for (const h of this._wildcardHandlers) {
      try { h(evt); } catch (e) { console.warn('[TaskScheduler] wildcard handler error', e); }
    }
  }

  /**
   * Create a task, returns taskId.
   * @param {{id?:string,name?:string,inputs:Object}} param0
   */
  createTask({ id, name, inputs }) {
    const taskId = id || this._uuid();
    if (this._tasks.has(taskId)) throw new Error('Task id already exists');
    const now = Date.now();

    const taskApiKey = inputs?.cgsInputs?.apiKeyOverride || this.apiKey;
    if (!taskApiKey) {
      throw new Error('TaskScheduler: missing API key for this task（请先在“模型设置”保存相应服务商的 Key）。');
    }
    const orchestrator = new TaskOrchestrator(taskApiKey);
    const meta = {
      id: taskId,
      name: name || `task_${taskId.slice(0, 8)}`,
      createdAt: now,
      updatedAt: now,
      status: 'idle',
      stage: 'generation'
    };
    const artifactsCache = {
      chatRecord: null,
      assessmentResult: null,
      ratingResult: null
    };

    // Wire orchestrator events
    this._attachOrchestrator(taskId, orchestrator, meta, artifactsCache);

    this._tasks.set(taskId, { orchestrator, meta, inputs: this._deepClone(inputs), artifactsCache });
    return taskId;
  }

  /**
   * Start a task: enqueue for generation respecting genCap.
   */
  async startTask(taskId) {
    const t = this._tasks.get(taskId);
    if (!t) throw new Error('Task not found');

    // If already running or queued, no-op
    if (this._genActive.has(taskId) || this._genQueue.includes(taskId)) return;

    // Update meta to queued
    t.meta.updatedAt = Date.now();
    this._genQueue.push(taskId);
    this.emit('schedulerQueue', { type: 'enqueue', phase: 'generation', taskId });

    // Try to dispatch
    this._pumpGenerationQueue();
  }

  /**
   * Abort a running task.
   */
  abortTask(taskId) {
    const t = this._tasks.get(taskId);
    if (!t) throw new Error('Task not found');
    try {
      t.orchestrator.abort();
    } catch (e) {
      // ignore
    }
  }

  /**
   * Force progress to assessment phase for a generating task
   * @param {string} taskId - Task ID
   */
  async forceProgressToAssessment(taskId) {
    const t = this._tasks.get(taskId);
    if (!t) throw new Error('Task not found');

    // Check if task is currently generating
    if (!this._genActive.has(taskId)) {
      console.warn(`[TaskScheduler] Task ${taskId} is not currently generating, cannot force progress`);
      return;
    }

    console.log(`[TaskScheduler] Force progress to assessment for task ${taskId}`);

    try {
      // Call the orchestrator's force progress method
      await t.orchestrator.forceProgressToAssessment();
      
      // After force progress, update the artifactsCache with the chatRecord from the orchestrator
      const orchestratorArtifacts = t.orchestrator.getResults();
      console.log(`[TaskScheduler] Force progress completed, updating artifactsCache:`, {
        hasOrchestratorArtifacts: !!orchestratorArtifacts,
        hasChatRecord: !!(orchestratorArtifacts && orchestratorArtifacts.chatRecord),
        chatRecordDetails: orchestratorArtifacts && orchestratorArtifacts.chatRecord ? {
          hasSystemPrompt: !!orchestratorArtifacts.chatRecord.systemPrompt,
          hasConversation: !!(orchestratorArtifacts.chatRecord.conversation),
          conversationLength: orchestratorArtifacts.chatRecord.conversation ? orchestratorArtifacts.chatRecord.conversation.length : 0
        } : null
      });
      
      if (orchestratorArtifacts && orchestratorArtifacts.chatRecord) {
        t.artifactsCache.chatRecord = orchestratorArtifacts.chatRecord;
        console.log(`[TaskScheduler] Updated artifactsCache with chatRecord from orchestrator`);
      }
      
      // Remove from active generation set
      this._genActive.delete(taskId);
      
      // Pump the queue to start next task if any
      this._pumpGenerationQueue();
      
    } catch (error) {
      console.error(`[TaskScheduler] Error forcing progress for task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a task (allowed when not currently generating; if generating, abort first).
   */
  deleteTask(taskId) {
    const t = this._tasks.get(taskId);
    if (!t) return;
    if (this._genActive.has(taskId)) {
      throw new Error('Cannot delete a generating task. Abort first.');
    }
    // Remove from queue if present
    this._genQueue = this._genQueue.filter(id => id !== taskId);

    this._detachOrchestrator(taskId, t.orchestrator);
    this._tasks.delete(taskId);
  }

  /**
   * List tasks, optionally filtered by status or stage.
   */
  listTasks(filter = {}) {
    const { status, stage } = filter;
    const out = [];
    for (const [, { meta }] of this._tasks) {
      if (status && meta.status !== status) continue;
      if (stage && meta.stage !== stage) continue;
      out.push({ id: meta.id, name: meta.name, status: meta.status, stage: meta.stage, createdAt: meta.createdAt, updatedAt: meta.updatedAt });
    }
    return out;
  }

  /**
   * Get a detailed snapshot.
   */
  getTask(taskId) {
    const t = this._tasks.get(taskId);
    if (!t) return null;
    return {
      meta: this._deepClone(t.meta),
      inputs: this._deepClone(t.inputs),
      artifacts: this._deepClone(t.artifactsCache)
    };
  }

  /**
   * Export to CSV string.
   * ENTIRE snapshots are serialized.
   * Schema columns:
   * id,name,status,stage,createdAt,updatedAt,metaJSON,inputsJSON,artifactsJSON,lastErrorJSON
   */
  exportCSV() {
    const rows = [];
    for (const [, { meta, inputs, artifactsCache, lastError }] of this._tasks) {
      rows.push({
        id: meta.id,
        name: meta.name,
        status: meta.status,
        stage: meta.stage,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        metaJSON: JSON.stringify(meta || {}),
        inputsJSON: JSON.stringify(inputs || {}),
        artifactsJSON: JSON.stringify(artifactsCache || {}),
        lastErrorJSON: JSON.stringify(lastError || null)
      });
    }
    const headers = ['id','name','status','stage','createdAt','updatedAt','metaJSON','inputsJSON','artifactsJSON','lastErrorJSON'];
    return CSV.stringify(rows, { header: headers });
  }

  /**
   * Import from CSV string.
   * - Reconstructs ENTIRE snapshots: meta, inputs, artifacts, lastError.
   * - All imported tasks are normalized to status 'idle' and stage 'generation' (not auto-started).
   */
  importCSV(csvString) {
    const parsed = CSV.parse(csvString);
    let imported = 0, errors = 0;
    for (const row of parsed) {
      try {
        const id = row.id || this._uuid();
        const name = row.name || `task_${id.slice(0,8)}`;
        const inputs = JSON.parse(row.inputsJSON || '{}');
        const metaRaw = JSON.parse(row.metaJSON || '{}');
        const artifacts = JSON.parse(row.artifactsJSON || '{}');
        const lastError = row.lastErrorJSON ? JSON.parse(row.lastErrorJSON) : null;

        if (this._tasks.has(id)) {
          // skip duplicates
          continue;
        }
        const now = Date.now();
        const taskApiKey = inputs?.cgsInputs?.apiKeyOverride || this.apiKey;
        if (!taskApiKey) {
          throw new Error('导入的任务缺少 API 密钥，请在 CSV 中包含 cgsInputs.apiKeyOverride。');
        }
        const orchestrator = new TaskOrchestrator(taskApiKey);
        // Normalize meta: keep identity/timestamps, reset runtime status/stage to safe defaults
        const meta = {
          id,
          name,
          createdAt: Number(metaRaw.createdAt ?? row.createdAt) || now,
          updatedAt: Number(metaRaw.updatedAt ?? row.updatedAt) || now,
          status: 'idle',
          stage: 'generation'
        };
        // Restore full artifacts as cached snapshot for UI/export
        const artifactsCache = {
          chatRecord: artifacts?.chatRecord ?? null,
          assessmentResult: artifacts?.assessmentResult ?? null,
          ratingResult: artifacts?.ratingResult ?? null
        };

        this._attachOrchestrator(id, orchestrator, meta, artifactsCache);
        this._tasks.set(id, { orchestrator, meta, inputs, artifactsCache, lastError });
        imported++;
      } catch (e) {
        console.warn('[TaskScheduler] import row error', e);
        errors++;
      }
    }
    return { imported, errors };
  }

  // Internal: attach and proxy orchestrator events into scheduler
  _attachOrchestrator(taskId, orchestrator, meta, artifactsCache) {
    const forward = (event) => (payload) => this._forwardTaskEvents(taskId, event, payload, meta, orchestrator, artifactsCache);

    orchestrator.on('stageChange', forward('stageChange'));
    orchestrator.on('streamStart', forward('streamStart'));
    orchestrator.on('streamRoleSwitch', forward('streamRoleSwitch'));
    orchestrator.on('streamChunk', forward('streamChunk'));
    orchestrator.on('streamEnd', forward('streamEnd'));
    orchestrator.on('evalUpdate', forward('evalUpdate'));
    orchestrator.on('complete', forward('complete'));
    orchestrator.on('error', forward('error'));
    orchestrator.on('abort', forward('abort'));
  }

  _detachOrchestrator(taskId, orchestrator) {
    // No-op since TaskOrchestrator exposes off but we didn't retain handler references here.
    // In a more advanced implementation, store bound handlers and off() here.
  }

  async _dispatchStart(taskId) {
    const t = this._tasks.get(taskId);
    if (!t) return;

    // Move to active
    this._genActive.add(taskId);
    this.emit('schedulerQueue', { type: 'start', phase: 'generation', taskId });

    // Start orchestrator
    try {
      await t.orchestrator.start(t.inputs);
    } catch (e) {
      // start errors surface via orchestrator error event
    } finally {
      // On any exit, free slot and pump next
      this._genActive.delete(taskId);
      this._pumpGenerationQueue();
    }
  }

  _pumpGenerationQueue() {
    while (this._genActive.size < this.genCap && this._genQueue.length > 0) {
      const nextId = this._genQueue.shift();
      this.emit('schedulerQueue', { type: 'dequeue', phase: 'generation', taskId: nextId });
      this._dispatchStart(nextId);
    }
  }

  _forwardTaskEvents(taskId, event, payload, meta, orchestrator, artifactsCache) {
    // Update meta based on orchestrator's getStatus where relevant
    if (event === 'stageChange') {
      const st = orchestrator.getStatus();
      meta.status = st.status;
      meta.stage = st.stage;
      meta.updatedAt = st.updatedAt;
      this.emit('taskStatus', { taskId, status: meta.status, stage: meta.stage, updatedAt: meta.updatedAt });

      // When moving from idle/queued to generating, ensure genActive contains it (guarded in start)
    }

    if (event === 'complete') {
      // Log the incoming payload for debugging
      console.log(`[TaskScheduler] Task complete event received:`, {
        hasPayload: !!payload,
        hasChatRecord: !!(payload && payload.chatRecord),
        hasAssessmentResult: !!(payload && payload.assessmentResult),
        hasRatingResult: !!(payload && payload.ratingResult),
        payload: payload
      });
      
      // cache artifacts for snapshot and CSV summaries
      artifactsCache.chatRecord = payload?.chatRecord || null;
      artifactsCache.assessmentResult = payload?.assessmentResult || null;
      artifactsCache.ratingResult = payload?.ratingResult || null;
      
      // Log cached artifacts for debugging
      console.log(`[TaskScheduler] Cached artifacts:`, {
        hasChatRecord: !!artifactsCache.chatRecord,
        hasAssessmentResult: !!artifactsCache.assessmentResult,
        hasRatingResult: !!artifactsCache.ratingResult,
        chatRecordDetails: artifactsCache.chatRecord ? {
          hasSystemPrompt: !!artifactsCache.chatRecord.systemPrompt,
          hasConversation: !!(artifactsCache.chatRecord.conversation),
          conversationLength: artifactsCache.chatRecord.conversation ? artifactsCache.chatRecord.conversation.length : 0
        } : null
      });
      
      // Log chatRecord for debugging
      if (artifactsCache.chatRecord && artifactsCache.chatRecord.conversation) {
        console.log(`[TaskScheduler] Cached chatRecord with reasoning content:`, artifactsCache.chatRecord.conversation.map(msg => ({
          id: msg.id,
          role: msg.role,
          contentLength: msg.content.length,
          hasReasoningContent: !!(msg.reasoningContent && msg.reasoningContent.trim()),
          reasoningContentLength: msg.reasoningContent ? msg.reasoningContent.length : 0
        })));
      }
    }

    // Proxy the event outward
    this._emitTaskEvent(taskId, event, payload);
  }

  _buildOutputsSummary(artifacts) {
    const convoLen = artifacts?.chatRecord?.conversation?.length || 0;
    const issueCounts = {
      Inform: artifacts?.assessmentResult?.Inform?.length || 0,
      Warning: artifacts?.assessmentResult?.Warning?.length || 0,
      Error: artifacts?.assessmentResult?.Error?.length || 0,
      Unlisted: artifacts?.assessmentResult?.Unlisted?.length || 0
    };
    const finalScore = typeof artifacts?.ratingResult?.finalScore === 'number'
      ? artifacts.ratingResult.finalScore
      : null;
    return { conversationLength: convoLen, issueCounts, finalScore };
  }

  _uuid() {
    // Simple UUID v4-ish
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  _deepClone(obj) {
    return obj ? JSON.parse(JSON.stringify(obj)) : obj;
  }
}
