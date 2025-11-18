/**
 * TaskOrchestrator - UI-less orchestration of one end-to-end task:
 * 1) Run ContinuousGenerationService (CGS) to generate a chat record while streaming chunks with role signals.
 * 2) After CGS termination, serially run AssessmentService (AS) first, then RatingService (RS) with assessment results fed into the scoring process.
 * 3) Emit lifecycle and progress events via an EventEmitter-style API.
 *
 * EventEmitter-style API:
 * - on(eventName, handler)
 * - off(eventName, handler)
 * - emit(eventName, payload) [internal]
 *
 * Events and payloads:
 * - streamStart: { role: "user"|"assistant" }
 * - streamRoleSwitch: { role: "user"|"assistant" }
 * - streamChunk: { chunk: string, role: "user"|"assistant" }
 * - streamEnd: { conversation: Array<{id:number,role:"user"|"assistant",content:string}>, endTime:number, duration:number }
 * - stageChange: { stage: "generation"|"assessment"|"rating"|"finalize", status: "idle"|"generating"|"evaluating"|"completed"|"aborted"|"error" }
 * - evalUpdate: { service: "assessment"|"rating", status: "started"|"progress"|"completed"|"failed", data?: any, error?: {code?:string,message:string} }
 * - complete: { chatRecord, assessmentResult, ratingResult }
 * - error: { code?: string, message: string, stage: string, timestamp: number }
 * - abort: { timestamp:number }
 *
 * Public API:
 * - constructor(apiKey)
 * - on(eventName, handler)
 * - off(eventName, handler)
 * - start(inputs)
 * - abort()
 * - rerun(overrideInputs?) // resets state, optionally overrides inputs, then start()
 * - getStatus() // returns { status, stage, updatedAt }
 * - getResults() // returns artifacts snapshot
 *
 * Inputs structure (validated only superficially; caller should ensure validity):
 * {
 *   cgsInputs: {
 *     chatSystemPrompt: string,
 *     autoresponseSystemPrompt: string,
 *     initialMessage: string,
 *     sceneInfo?: string, // Scene information from scene config
 *     endCondition: { type: 'roundLimit'|'userRegex'|'assistantRegex', value: number|string },
 *     modelName?: string, // For assistant responses
 *     temperature?: number, // For assistant responses
 *     topP?: number // For assistant responses
 *   },
 *   assessmentConfig: {
 *     llmConfig?: Object,
 *     mistakeLibrary?: Object,
 *     emitUnlistedIssues?: boolean
 *   },
 *   ratingConfig: {
 *     llmConfig?: Object,
 *     expertPanel: Array<{ field:string, portfolio:string, harshness:number }>,
 *     includeSystemPrompt?: boolean
 *   },
 *   name?: string
 * }
 *
 * Artifacts:
 * - chatRecord: { systemPrompt?: string, conversation: Array<{id, role, content}> }
 * - assessmentResult: { Inform:[], Warning:[], Error:[], Unlisted:[] }
 * - ratingResult: { scores:number[], comments:string[], finalScore:number }
 *
 * Status and Stage enums:
 * - status: 'idle'|'generating'|'evaluating'|'completed'|'aborted'|'error'
 * - stage: 'generation'|'assessment'|'rating'|'finalize'
 */

import { ContinuousGenerationService } from './ContinuousGenerationService.js';
import { AssessmentService } from './AssessmentService.js';
// RatingService removed: expert-based rating feature disabled

export class TaskOrchestrator {
  /**
   * @param {string} apiKey
   */
  constructor(apiKey) {
    this.apiKey = apiKey;

    // Event handlers registry: Map<string, Set<Function>>
    this._handlers = new Map();

    // Runtime state
    this._status = 'idle';
    this._stage = 'generation';
    this._updatedAt = Date.now();

    // Controls
    this._aborted = false;
    this._forceProgressTriggered = false;

    // Inputs and artifacts
    this._inputs = null;
    this._artifacts = {
      chatRecord: null,
      assessmentResult: null,
      ratingResult: null
    };

    // Services
    this._cgs = null;
    this._as = null;
    this._rs = null; // no rating service when feature disabled
  }

  // EventEmitter-style API
  on(eventName, handler) {
    if (!this._handlers.has(eventName)) {
      this._handlers.set(eventName, new Set());
    }
    this._handlers.get(eventName).add(handler);
  }

  off(eventName, handler) {
    const set = this._handlers.get(eventName);
    if (set) {
      set.delete(handler);
    }
  }

  emit(eventName, payload) {
    const set = this._handlers.get(eventName);
    if (set) {
      for (const handler of set) {
        try {
          handler(payload);
        } catch (e) {
          // Avoid cascading errors from handlers
          console.warn('[TaskOrchestrator] Handler error for event', eventName, e);
        }
      }
    }
  }

  _setStageStatus(stage, status) {
    this._stage = stage;
    this._status = status;
    this._updatedAt = Date.now();
    this.emit('stageChange', { stage: this._stage, status: this._status });
  }

  /**
   * Start the task end-to-end. If already running, throws.
   * @param {Object} inputs - See Inputs structure above
   */
  async start(inputs) {
    if (this._status !== 'idle' && this._status !== 'completed' && this._status !== 'error' && this._status !== 'aborted') {
      throw new Error('Task is already running');
    }

    this._inputs = inputs ? JSON.parse(JSON.stringify(inputs)) : this._inputs;
    if (!this._inputs || !this._inputs.cgsInputs) {
      throw new Error('Missing required inputs.cgsInputs');
    }

    // Reset state for fresh run
    this._aborted = false;
    this._forceProgressTriggered = false;
    this._artifacts = { chatRecord: null, assessmentResult: null, ratingResult: null };
    this._setStageStatus('generation', 'generating');

    // Initialize services
    this._cgs = new ContinuousGenerationService(this.apiKey);
    this._as = new AssessmentService(this.apiKey);
    // Skip rating service initialization (feature removed)

    // Wire streaming
    this._wireStreaming();

    try {
      // Kick off generation session
      await this._cgs.startSession(this._inputs.cgsInputs);

      if (this._aborted) {
        this._finalizeAbort();
        return;
      }

      // On termination, CGS already emitted streamEnd; capture chat record
      const sessionData = this._cgs.getCurrentSession();
      const conversation = sessionData?.conversation || [];
      
      // Log conversation data for debugging
      console.log(`[TaskOrchestrator] Creating chatRecord from session data:`, {
        hasSessionData: !!sessionData,
        hasConversation: !!(sessionData && sessionData.conversation),
        conversationLength: conversation.length,
        conversationData: conversation.map(msg => ({
          id: msg.id,
          role: msg.role,
          contentLength: msg.content.length,
          hasReasoningContent: !!(msg.reasoningContent && msg.reasoningContent.trim()),
          reasoningContentLength: msg.reasoningContent ? msg.reasoningContent.length : 0
        }))
      });
      
      const chatRecord = {
        systemPrompt: this._inputs.cgsInputs.chatSystemPrompt,
        conversation
      };
      this._artifacts.chatRecord = chatRecord;
      
      // Log the created chatRecord
      console.log(`[TaskOrchestrator] Created and cached chatRecord:`, {
        hasChatRecord: !!this._artifacts.chatRecord,
        hasSystemPrompt: !!this._artifacts.chatRecord?.systemPrompt,
        hasConversation: !!(this._artifacts.chatRecord?.conversation),
        conversationLength: this._artifacts.chatRecord?.conversation?.length || 0
      });

      // Move to evaluating
      this._setStageStatus('assessment', 'evaluating');

      // Check if force progress was triggered - if so, skip normal evaluation
      if (this._forceProgressTriggered) {
        console.log('[TaskOrchestrator] Force progress was triggered, skipping normal evaluation flow');
        // The forced evaluation will handle completion
        return;
      }

      // Run AS and RS serially
      await this._runEvaluation(chatRecord);

      if (this._aborted) {
        this._finalizeAbort();
        return;
      }

      // Finalize completion
      this._setStageStatus('finalize', 'completed');
      
      // Log the complete event payload before emitting
      const completePayload = {
        chatRecord: this._artifacts.chatRecord,
        assessmentResult: this._artifacts.assessmentResult,
        ratingResult: this._artifacts.ratingResult
      };
      
      console.log(`[TaskOrchestrator] Emitting complete event with payload:`, {
        hasChatRecord: !!completePayload.chatRecord,
        hasAssessmentResult: !!completePayload.assessmentResult,
        hasRatingResult: !!completePayload.ratingResult,
        chatRecordDetails: completePayload.chatRecord ? {
          hasSystemPrompt: !!completePayload.chatRecord.systemPrompt,
          hasConversation: !!(completePayload.chatRecord.conversation),
          conversationLength: completePayload.chatRecord.conversation ? completePayload.chatRecord.conversation.length : 0
        } : null
      });
      
      this.emit('complete', completePayload);
    } catch (err) {
      if (this._aborted) {
        this._finalizeAbort();
        return;
      }
      this._handleError('generation', err);
    }
  }

  /**
   * Abort the current task. It is idempotent.
   */
  abort() {
    if (this._aborted) return;
    this._aborted = true;

    // Abort generation if ongoing
    try {
      this._cgs?.stopSession();
    } catch (_) {}

    // Abort assessment if ongoing
    try {
      this._as?.abort?.();
    } catch (_) {}

    this.emit('abort', { timestamp: Date.now() });
  }

  /**
   * Force progress to assessment phase, halting current generation
   */
  async forceProgressToAssessment() {
    if (this._status !== 'generating' || this._stage !== 'generation') {
      console.warn('[TaskOrchestrator] Task is not in generation phase, cannot force progress');
      return;
    }

    console.log('[TaskOrchestrator] Force progress to assessment triggered');

    // Set flag to prevent normal evaluation flow from running
    this._forceProgressTriggered = true;

    try {
      // Stop the current generation session
      if (this._cgs) {
        this._cgs.stopSession();
      }

      // Get the current conversation data even if incomplete
      const sessionData = this._cgs?.getCurrentSession();
      const conversation = sessionData?.conversation || [];
      
      // Only proceed if we have some conversation data
      if (conversation.length === 0) {
        console.warn('[TaskOrchestrator] No conversation data available, cannot proceed to assessment');
        return;
      }

      // Create chat record from available data
      const chatRecord = {
        systemPrompt: this._inputs.cgsInputs.chatSystemPrompt,
        conversation
      };
      this._artifacts.chatRecord = chatRecord;
      
      // Log the created chatRecord in force progress
      console.log(`[TaskOrchestrator] Force progress - created chatRecord:`, {
        hasChatRecord: !!this._artifacts.chatRecord,
        hasSystemPrompt: !!this._artifacts.chatRecord?.systemPrompt,
        hasConversation: !!(this._artifacts.chatRecord?.conversation),
        conversationLength: this._artifacts.chatRecord?.conversation?.length || 0,
        conversationData: this._artifacts.chatRecord?.conversation?.map(msg => ({
          id: msg.id,
          role: msg.role,
          contentLength: msg.content.length,
          hasReasoningContent: !!(msg.reasoningContent && msg.reasoningContent.trim()),
          reasoningContentLength: msg.reasoningContent ? msg.reasoningContent.length : 0
        }))
      });

      // Emit stream end event with the partial conversation
      this.emit('streamEnd', {
        conversation,
        endTime: Date.now(),
        duration: sessionData?.duration || 0
      });

      // Move to assessment phase - the normal flow will continue from here
      this._setStageStatus('assessment', 'evaluating');

      // Let the normal evaluation flow continue naturally
      // This will trigger the serial assessment -> rating process
      this._runEvaluation(chatRecord).then(() => {
        // Finalize completion after forced evaluation
        if (!this._aborted) {
          this._setStageStatus('finalize', 'completed');
          
          // Log the complete event payload before emitting in force progress
          const forceCompletePayload = {
            chatRecord: this._artifacts.chatRecord,
            assessmentResult: this._artifacts.assessmentResult,
            ratingResult: this._artifacts.ratingResult
          };
          
          console.log(`[TaskOrchestrator] Force progress - emitting complete event with payload:`, {
            hasChatRecord: !!forceCompletePayload.chatRecord,
            hasAssessmentResult: !!forceCompletePayload.assessmentResult,
            hasRatingResult: !!forceCompletePayload.ratingResult,
            chatRecordDetails: forceCompletePayload.chatRecord ? {
              hasSystemPrompt: !!forceCompletePayload.chatRecord.systemPrompt,
              hasConversation: !!(forceCompletePayload.chatRecord.conversation),
              conversationLength: forceCompletePayload.chatRecord.conversation ? forceCompletePayload.chatRecord.conversation.length : 0
            } : null
          });
          
          this.emit('complete', forceCompletePayload);
        }
      }).catch(error => {
        console.error('[TaskOrchestrator] Error in forced evaluation:', error);
        this._handleError('assessment', error);
      });

    } catch (error) {
      console.error('[TaskOrchestrator] Error in forceProgressToAssessment:', error);
      this._handleError('assessment', error);
    }
  }

  /**
   * Rerun from idle/completed/error/aborted; optionally override inputs.
   * @param {Object} overrideInputs
   */
  async rerun(overrideInputs = undefined) {
    if (overrideInputs) {
      this._inputs = JSON.parse(JSON.stringify(overrideInputs));
    }
    // Reset to idle and call start
    this._status = 'idle';
    this._stage = 'generation';
    this._forceProgressTriggered = false; // Reset the force progress flag
    this._updatedAt = Date.now();
    return this.start(this._inputs);
  }

  /**
   * @returns {{status:string, stage:string, updatedAt:number}}
   */
  getStatus() {
    return { status: this._status, stage: this._stage, updatedAt: this._updatedAt };
  }

  /**
   * @returns {{chatRecord:any, assessmentResult:any, ratingResult:any}}
   */
  getResults() {
    return JSON.parse(JSON.stringify(this._artifacts));
  }

  // Internal helpers

  _wireStreaming() {
    let firstUserSignalSent = false;
    // Emit initial streamStart for the first role once we push the initial message
    this._cgs.setStreamCallbacks({
      onChunk: (chunk, role) => {
        // At the very beginning, the service pushes the initial user message; ensure streamStart is emitted once.
        if (!firstUserSignalSent && role === 'user') {
          firstUserSignalSent = true;
          this.emit('streamStart', { role: 'user' });
        }
        this.emit('streamChunk', { chunk, role });
      },
      onRoleSwitch: (role) => {
        this.emit('streamRoleSwitch', { role });
      },
      onTermination: (sessionData) => {
        const { conversation, endTime, duration } = sessionData || {};
        this.emit('streamEnd', { conversation, endTime, duration });
      }
    });
  }

  async _runEvaluation(chatRecord) {
    // Create a copy of the chat record with reasoning content stripped for assessments
    const chatRecordForAssessment = {
      systemPrompt: chatRecord.systemPrompt,
      conversation: chatRecord.conversation.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content
        // reasoningContent is intentionally excluded
      }))
    };

    // Run assessment first
    this.emit('evalUpdate', { service: 'assessment', status: 'started' });
    
    let assessmentResult;
    try {
      const cfg = this._inputs.assessmentConfig || {};
      assessmentResult = await this._as.startAssessment({
        llmConfig: cfg.llmConfig || {},
        chatRecord: chatRecordForAssessment, // Use stripped version
        sceneDescription: this._inputs.cgsInputs.sceneInfo || '',
        mistakeLibrary: cfg.mistakeLibrary || {},
        emitUnlistedIssues: cfg.emitUnlistedIssues !== false
      });
      this._artifacts.assessmentResult = assessmentResult;
      this.emit('evalUpdate', { service: 'assessment', status: 'completed', data: assessmentResult });
    } catch (e) {
      const err = { message: e?.message || 'Assessment error' };
      this.emit('evalUpdate', { service: 'assessment', status: 'failed', error: err });
      // If assessment fails, we don't proceed to rating
      return;
    }

    // Rating stage removed: do not run rating, keep ratingResult null
  }

  _finalizeAbort() {
    this._setStageStatus(this._stage, 'aborted');
    // Keep partial artifacts if any; do not emit complete
  }

  _handleError(stage, err) {
    const errorPayload = {
      code: undefined,
      message: err?.message || 'Unknown error',
      stage,
      timestamp: Date.now()
    };
    this._setStageStatus(stage, 'error');
    this.emit('error', errorPayload);
  }
}
