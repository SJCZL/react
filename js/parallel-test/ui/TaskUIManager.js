/**
 * TaskUIManager - Manages the UI for task bubbles in the left 2/3 space
 * 
 * Responsibilities:
 * - Render task bubbles with status, phase, index, timer, expert score, and mistake counters
 * - Handle horizontally scrollable chat text with role-based coloring
 * - Manage floating action button for creating new tasks
 * - Wire up with TaskScheduler for real-time updates
 * - Implement scrollable task list with hidden scrollbar
 */

import { TaskScheduler } from '../TaskScheduler.js';
import * as CSV from '../../utils/csv.mjs';
import { modelConfig } from '../../config/ModelConfig.js';

export class TaskUIManager {
    constructor() {
        this.containerId = 'parallel-left-column';
        this.scheduler = null;
        this.tasks = new Map(); // taskId -> task UI data
        this.taskCounter = 0;
        this.chatSystemPrompt = '';

        // Alternation state for consecutive parameter-identical tasks
        this._lastParamsSignature = null; // last effective params signature
        this._currentShade = 'W'; // 'W' for white, 'G' for grey. First group white by default.
        
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        this.ensureContainer();
        this.createButtonContainer();
        this.bindEvents();
        
        // Get API key from model config system
        const apiKey = modelConfig.apiKey;
        
        // Initialize TaskScheduler
        if (apiKey) {
            this.scheduler = new TaskScheduler({ apiKey });
            this.setupTaskEventHandlers();
        }
        
        // Get chat system prompt from main chat (will be empty if not set, which is correct)
        this.updateChatSystemPrompt();
        
        // Set up observer to sync with main chat system prompt changes
        this.setupSystemPromptObserver();
    }

    ensureContainer() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        
        // Clear any existing content
        container.innerHTML = '';
        
        // Create task list container
        const taskListContainer = document.createElement('div');
        taskListContainer.id = 'task-list-container';
        taskListContainer.className = 'task-list-container';
        container.appendChild(taskListContainer);
    }

    createButtonContainer() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        
        // Create unified buttons container
        const buttonsContainer = document.createElement('div');
        buttonsContainer.id = 'task-buttons-container';
        buttonsContainer.className = 'task-buttons-container';
        
        // Create delete all tasks button
        const deleteAllButton = document.createElement('button');
        deleteAllButton.id = 'task-delete-all';
        deleteAllButton.className = 'task-button';
        deleteAllButton.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
        `;
        deleteAllButton.title = '删除所有任务';
        buttonsContainer.appendChild(deleteAllButton);
        
        // Create export CSV button
        const exportCsvButton = document.createElement('button');
        exportCsvButton.id = 'task-export-csv';
        exportCsvButton.className = 'task-button';
        exportCsvButton.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
        `;
        exportCsvButton.title = '导出已完成任务为CSV';
        buttonsContainer.appendChild(exportCsvButton);
        
        // Create add task button (FAB)
        const fab = document.createElement('button');
        fab.id = 'task-fab';
        fab.className = 'task-button task-fab';
        fab.innerHTML = `
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
        `;
        fab.title = '创建新任务';
        buttonsContainer.appendChild(fab);
        
        container.appendChild(buttonsContainer);
    }

    bindEvents() {
        // Floating button click event
        const fab = document.getElementById('task-fab');
        if (fab) {
            fab.addEventListener('click', () => this.createNewTask());
        }
        
        // Delete all tasks button click event
        const deleteAllButton = document.getElementById('task-delete-all');
        if (deleteAllButton) {
            deleteAllButton.addEventListener('click', () => this.deleteAllTasks());
        }
        
        // Export CSV button click event
        const exportCsvButton = document.getElementById('task-export-csv');
        if (exportCsvButton) {
            exportCsvButton.addEventListener('click', () => this.exportCompletedTasksToCSV());
        }
        
        // Handle API key changes through model config system
        // Listen for model config changes and update scheduler accordingly
        this.modelConfigChangeHandler = () => {
            const newApiKey = modelConfig.apiKey;
            if (newApiKey && !this.scheduler) {
                this.scheduler = new TaskScheduler({ apiKey: newApiKey });
                this.setupTaskEventHandlers();
            } else if (this.scheduler && newApiKey !== this.scheduler.apiKey) {
                this.scheduler.apiKey = newApiKey;
            }
        };

        // Listen for model config changes
        document.addEventListener('modelConfigChanged', this.modelConfigChangeHandler);

        // Add cleanup method for event listeners
        this.cleanup = () => {
            if (this.modelConfigChangeHandler) {
                document.removeEventListener('modelConfigChanged', this.modelConfigChangeHandler);
            }
        };
        
        // Global click event to close dropdowns when clicking outside
        document.addEventListener('click', (e) => this.handleGlobalClick(e));
    }

    setupTaskEventHandlers() {
        if (!this.scheduler) return;
        
        // Listen to task events
        this.scheduler.on('taskEvent', (evt) => {
            const { taskId, event, payload } = evt;
            this.handleTaskEvent(taskId, event, payload);
        });
        
        // Listen to status changes
        this.scheduler.on('taskStatus', (evt) => {
            const { taskId, status, stage, updatedAt } = evt;
            this.updateTaskStatus(taskId, status, stage, updatedAt);
        });
    }

    /**
     * Build a stable signature string from the effective inputs that determine task equivalence.
     * Only include fields that impact execution semantics.
     */
    buildParamsSignature(config) {
        try {
            // Select only relevant parts that define equivalence
            const payload = {
                // generation inputs
                cgsInputs: {
                    chatSystemPrompt: config?.cgsInputs?.chatSystemPrompt ?? '',
                    autoresponseSystemPrompt: config?.cgsInputs?.autoresponseSystemPrompt ?? '',
                    initialMessage: config?.cgsInputs?.initialMessage ?? '',
                    sceneInfo: config?.cgsInputs?.sceneInfo ?? '',
                    endCondition: config?.cgsInputs?.endCondition ?? {},
                    modelName: config?.cgsInputs?.modelName ?? '',
                    temperature: Number(config?.cgsInputs?.temperature ?? 0),
                    topP: Number(config?.cgsInputs?.topP ?? 0),
                },
                // assessment config
                assessmentConfig: {
                    llmConfig: {
                        model: config?.assessmentConfig?.llmConfig?.model ?? '',
                        top_p: Number(config?.assessmentConfig?.llmConfig?.top_p ?? 0),
                        temperature: Number(config?.assessmentConfig?.llmConfig?.temperature ?? 0),
                    },
                    mistakeLibrary: {
                        mistakes: Array.isArray(config?.assessmentConfig?.mistakeLibrary?.mistakes)
                            ? config.assessmentConfig.mistakeLibrary.mistakes
                            : [],
                    },
                    emitUnlistedIssues: Boolean(config?.assessmentConfig?.emitUnlistedIssues !== false),
                },
                // rating config
                ratingConfig: {
                    llmConfig: {
                        model: config?.ratingConfig?.llmConfig?.model ?? '',
                        top_p: Number(config?.ratingConfig?.llmConfig?.top_p ?? 0),
                        temperature: Number(config?.ratingConfig?.llmConfig?.temperature ?? 0),
                    },
                    expertPanel: Array.isArray(config?.ratingConfig?.expertPanel)
                        ? config.ratingConfig.expertPanel
                        : [],
                    includeSystemPrompt: Boolean(config?.ratingConfig?.includeSystemPrompt !== false),
                },
            };

            // Deep sort object keys for stable stringify
            const sortDeep = (x) => {
                if (Array.isArray(x)) return x.map(sortDeep);
                if (x && typeof x === 'object') {
                    return Object.keys(x).sort().reduce((o, k) => {
                        o[k] = sortDeep(x[k]);
                        return o;
                    }, {});
                }
                return x;
            };

            return JSON.stringify(sortDeep(payload));
        } catch (e) {
            console.warn('[TaskUIManager] buildParamsSignature failed, falling back', e);
            return JSON.stringify(config ?? {});
        }
    }

    setupSystemPromptObserver() {
        // Set up MutationObserver to detect changes in the system prompt message
        const chatContainer = document.getElementById('chat-container');
        if (chatContainer) {
            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.type === 'childList') {
                        // Check if system prompt message was updated
                        const systemPromptMessage = document.querySelector('.system-prompt-message');
                        if (systemPromptMessage) {
                            this.updateChatSystemPrompt();
                        }
                    }
                }
            });

            observer.observe(chatContainer, { childList: true, subtree: true });
        }

        // Set up listener for parallel test tab system prompt changes
        document.addEventListener('input', (e) => {
            if (e.target.id === 'pt-chat-system-prompt') {
                this.updateChatSystemPrompt();
            }
        });

        // Set up listener for scene config generated prompt changes
        const scenePromptEl = document.getElementById('generated-prompt');
        if (scenePromptEl) {
            scenePromptEl.addEventListener('input', () => {
                console.log('[TaskUIManager] Scene config prompt changed, updating...');
                this.updateChatSystemPrompt();
            });

            // Also listen for custom events when scene config generates prompt
            document.addEventListener('scenePromptGenerated', () => {
                console.log('[TaskUIManager] Scene prompt generated event received');
                this.updateChatSystemPrompt();
            });
        }
    }

    updateChatSystemPrompt() {
        // Try to get from main chat first
        if (window.chatInstance && window.chatInstance.chatService) {
            this.chatSystemPrompt = window.chatInstance.chatService.getSystemPrompt();
        } else {
            // Fallback to parallel test tab
            const promptEl = document.querySelector('#pt-chat-system-prompt');
            if (promptEl) {
                this.chatSystemPrompt = promptEl.value;
            }
        }

        // Also check for scene config generated prompt
        const scenePromptEl = document.getElementById('generated-prompt');
        if (scenePromptEl && scenePromptEl.value && scenePromptEl.value.trim()) {
            // If scene config has a generated prompt and it's not empty, use it
            console.log('[TaskUIManager] Found generated prompt from scene config');
            this.chatSystemPrompt = scenePromptEl.value.trim();
        }
    }

    createNewTask() {
        if (!this.scheduler) {
            console.error('[TaskUIManager] TaskScheduler not initialized');
            return;
        }
        
        // Get current config from ConfigPanel
        const config = this.getCurrentConfig();
        if (!config) {
            console.error('[TaskUIManager] Failed to get current config');
            return;
        }
    
        // Compute signature of effective params to decide bubble shade
        const sig = this.buildParamsSignature(config);
        if (this._lastParamsSignature === null) {
            // First task group: set baseline signature (keep default shade)
            this._lastParamsSignature = sig;
        } else if (sig !== this._lastParamsSignature) {
            // Parameters changed: flip shade and update baseline
            this._currentShade = this._currentShade === 'W' ? 'G' : 'W';
            this._lastParamsSignature = sig;
        }
        
        // Create task with scheduler
        const taskId = this.scheduler.createTask({
            name: `Task ${++this.taskCounter}`,
            inputs: config
        });
        
        // Create UI for the task
        this.createTaskUI(taskId);

        // Persist the inputs on the task UI data so shift-preview can access them later
        try {
            const td = this.tasks.get(taskId);
            if (td) td.inputs = config;
        } catch (e) {
            console.warn('[TaskUIManager] Failed to attach inputs to task UI data', e);
        }
        
        // Start the task
        this.scheduler.startTask(taskId);
        
        console.log(`[TaskUIManager] Created and started task: ${taskId}`);
    }

    getCurrentConfig() {
        // Try to get config from ConfigPanel state
        if (window.ConfigPanel && window.ConfigPanel.state && window.ConfigPanel.state.preset) {
            const preset = window.ConfigPanel.state.preset;
            const mistakes = window.ConfigPanel.state.mistakes || [];
            
            // Ensure expert panel has required properties
            const expertPanel = (preset.experts || []).map(expert => ({
                field: expert.specialization || expert.field || '对话专家',
                portfolio: expert.portfolio || '专业评估',
                harshness: expert.harshness || 5
            }));
            
            // Transform to the format expected by TaskOrchestrator
            return {
                cgsInputs: {
                    chatSystemPrompt: this.chatSystemPrompt,
                    autoresponseSystemPrompt: preset.basic?.autoResponsePrompt || '',
                    initialMessage: preset.basic?.initialMessage || '',
                    sceneInfo: window.ConfigPanel.state.sceneInfo || '', // Scene information from scene config
                    endCondition: {
                        type: preset.basic?.endCondition?.type || 'assistantRegex',
                        value: preset.basic?.endCondition?.type === 'rounds'
                            ? preset.basic?.endCondition?.rounds
                            : preset.basic?.endCondition?.[preset.basic?.endCondition?.type + 'Regex'] || '<\\?END_CHAT>'
                    },
                    modelName: preset.dialogue?.model || modelConfig.currentModel, // 使用并行测试中选择的模型或全局模型配置
                    temperature: preset.dialogue?.temperature || 0.97, // This is for the assistant
                    topP: preset.dialogue?.top_p || 0.3 // This is for the assistant
                },
                assessmentConfig: {
                    llmConfig: {
                        model: preset.evaluation?.model || modelConfig.currentModel,
                        top_p: preset.evaluation?.top_p || 0.97,
                        temperature: preset.evaluation?.temperature || 0.75
                    },
                    mistakeLibrary: { mistakes },
                    emitUnlistedIssues: preset.assessmentOptions?.includeUnlistedIssues !== false
                },
                ratingConfig: {
                    llmConfig: {
                        model: preset.evaluation?.model || modelConfig.currentModel,
                        top_p: preset.evaluation?.top_p || 0.97,
                        temperature: preset.evaluation?.temperature || 0.75
                    },
                    expertPanel: expertPanel,
                    includeSystemPrompt: preset.evaluation?.includeSystemPrompt !== false
                }
            };
        }
        
        return null;
    }

    /**
     * Build a ConfigPanel-style preset object from the internal task inputs (TaskOrchestrator format).
     * Includes only the 'basic', 'evaluation', 'dialogue' sections and chatSystemPrompt (no mistakes/experts).
     * This is used for the shift-click temporary preview.
     * @param {Object} inputs - the config object passed to scheduler (cgsInputs, assessmentConfig, ratingConfig)
     * @returns {Object} preset-like object
     */
    _buildPresetFromInputs(inputs) {
        if (!inputs) return null;
        const preset = {
            basic: {
                initialMessage: inputs.cgsInputs?.initialMessage || '',
                autoResponsePrompt: inputs.cgsInputs?.autoresponseSystemPrompt || '',
                endCondition: { type: 'assistantRegex' },
                concurrencyLimit: null
            },
            sceneInfo: inputs.cgsInputs?.sceneInfo || '',
            evaluation: {
                model: inputs.assessmentConfig?.llmConfig?.model || '',
                top_p: inputs.assessmentConfig?.llmConfig?.top_p,
                temperature: inputs.assessmentConfig?.llmConfig?.temperature,
                includeSystemPrompt: inputs.ratingConfig?.includeSystemPrompt !== false
            },
            dialogue: {
                model: inputs.cgsInputs?.modelName || '',
                top_p: inputs.cgsInputs?.topP,
                temperature: inputs.cgsInputs?.temperature
            },
            chatSystemPrompt: inputs.cgsInputs?.chatSystemPrompt || '',
            sceneInfo: inputs.cgsInputs?.sceneInfo || ''
        };

        // Map endCondition value back to ConfigPanel shape where possible
        const ec = inputs.cgsInputs?.endCondition;
        if (ec) {
            if (ec.type === 'rounds' || typeof ec.value === 'number') {
                preset.basic.endCondition.type = 'rounds';
                preset.basic.endCondition.rounds = ec.value;
            } else if (ec.type === 'assistantRegex' || ec.type === 'userRegex') {
                preset.basic.endCondition.type = ec.type;
                if (ec.type === 'assistantRegex') preset.basic.endCondition.assistantRegex = ec.value;
                if (ec.type === 'userRegex') preset.basic.endCondition.userRegex = ec.value;
            } else if (typeof ec.value === 'string') {
                // fallback: treat as assistantRegex
                preset.basic.endCondition.type = 'assistantRegex';
                preset.basic.endCondition.assistantRegex = ec.value;
            }
        }

        // Concurrency if present
        if (typeof inputs.cgsInputs?.concurrencyLimit !== 'undefined') {
            preset.basic.concurrencyLimit = inputs.cgsInputs.concurrencyLimit;
        }

        return preset;
    }

    createTaskUI(taskId) {
        const container = document.getElementById('task-list-container');
        if (!container) return;
        
        const taskEl = document.createElement('div');
        taskEl.id = `task-${taskId}`;
        taskEl.className = 'task-bubble';
        taskEl.dataset.taskId = taskId;
    
        // Apply shade class based on current alternation state
        const shadeClass = this._currentShade === 'W' ? 'task-bubble--white' : 'task-bubble--grey';
        taskEl.classList.add(shadeClass);
        
        taskEl.innerHTML = `
            <div class="task-bubble-main">
                <div class="task-mistakes-indicator">
                    <span class="mistake-item blue">
                        <span class="mistake-number">0</span>
                        <span class="mistake-circle"></span>
                    </span>
                    <span class="mistake-gap"></span>
                    <span class="mistake-item yellow">
                        <span class="mistake-number">0</span>
                        <span class="mistake-circle"></span>
                    </span>
                    <span class="mistake-gap"></span>
                    <span class="mistake-item red">
                        <span class="mistake-number">0</span>
                        <span class="mistake-circle"></span>
                    </span>
                    <span class="mistake-gap"></span>
                    <span class="mistake-item grey">
                        <span class="mistake-number">0</span>
                        <span class="mistake-circle"></span>
                    </span>
                    <span class="mistake-gap"></span>
                </div>

                <!-- Rounds counter: visually identical to the text bar (reuses task-chat-text-container styles)
                     but fixed width so it doesn't steal flexible space from the main text bar -->
                <div class="task-rounds-container task-chat-text-container" style="flex: 0 0 84px; margin-right: 8px;">
                    <div class="task-rounds-text">
                        <span class="task-rounds-number">0　轮</span>
                    </div>
                </div>

                <div class="task-chat-text-container">
                    <div class="task-chat-text" data-task-id="${taskId}"></div>
                </div>
                <div class="task-score-container">
                    <div class="task-score" data-task-id="${taskId}"></div>
                </div>
            </div>
            <div class="task-mistakes-dropdown">
                <div class="task-dropdown-content" id="mistakes-dropdown-${taskId}"></div>
            </div>
            <div class="task-score-dropdown">
                <div class="task-dropdown-content" id="score-dropdown-${taskId}"></div>
            </div>
        `;
        
        container.appendChild(taskEl);
        
        // Add vertical->horizontal wheel mapping for the compact chat text bar.
        // When the task chat text overflows horizontally, translate vertical wheel
        // motion to horizontal scrolling so mouse/trackpad vertical scroll moves the bar.
        const chatTextElForWheel = taskEl.querySelector('.task-chat-text');
        if (chatTextElForWheel) {
            chatTextElForWheel.addEventListener('wheel', (e) => {
                try {
                    // Only intercept when horizontal overflow exists
                    if (chatTextElForWheel.scrollWidth > chatTextElForWheel.clientWidth) {
                        // Normalize delta based on deltaMode
                        let deltaY = e.deltaY;
                        if (e.deltaMode === 1) deltaY *= 16; // LINE -> pixels approx
                        else if (e.deltaMode === 2) deltaY *= chatTextElForWheel.clientHeight; // PAGE
                        
                        // Apply vertical delta to horizontal scroll
                        chatTextElForWheel.scrollLeft += deltaY;
                        
                        // Prevent vertical scrolling of parent containers
                        e.preventDefault();
                    }
                } catch (err) {
                    console.error('[TaskUIManager] wheel handler error', err);
                }
            }, { passive: false });
        }
        
        // Store task UI data
        this.tasks.set(taskId, {
            element: taskEl,
            startTime: Date.now(),
            chatText: '',
            chatHtml: '', // Store HTML with role-based spans
            currentRole: 'user',
            status: 'idle',
            phase: 'generation',
            conversationLength: 0,
            issueCounts: { Inform: 0, Warning: 0, Error: 0, Unlisted: 0 },
            expertScore: null,
            assessmentResult: null,
            ratingResult: null,
            pendingChunks: [], // Queue for chunks to be displayed
            chunkDisplayInterval: null, // Interval for displaying chunks
            mistakesExpanded: false,
            scoreExpanded: false
        });
        
        // Add click event listeners
        this.addTaskClickHandlers(taskId);

        // Shift+Click: when the task has finished generating dialogue, load its system prompt
        // and conversation into the main chat and switch to the chat tab.
        taskEl.addEventListener('click', (e) => {
            if (!e.shiftKey) return;
            try {
                e.preventDefault();
                e.stopPropagation();
                
                const taskData = this.tasks.get(taskId);
                if (!taskData) return;
                
                // Consider generation finished when there is conversation content OR assessment/rating results.
                const isFinished = (taskData.conversationLength && taskData.conversationLength > 0)
                                   || taskData.assessmentResult
                                   || taskData.ratingResult;
                if (!isFinished) {
                    console.warn(`[TaskUIManager] Shift+Click ignored for task ${taskId} because generation not finished`);
                    return;
                }
                
                // Build conversation from the task DOM (one span per message after normalization)
                // Ensure each message has a numeric id so it integrates correctly with the main chat/analysis systems.
                // For shift+click, we need to get the full conversation data including reasoning content from the task data
                let conversation = [];
                
                // Try to get the full conversation data from the task scheduler first (includes reasoning content)
                if (this.scheduler && typeof this.scheduler.getTask === 'function') {
                    try {
                        const taskDetails = this.scheduler.getTask(taskId);
                        console.log(`[TaskUIManager] Retrieved task details:`, {
                            hasTaskDetails: !!taskDetails,
                            hasArtifacts: !!(taskDetails && taskDetails.artifacts),
                            hasChatRecord: !!(taskDetails && taskDetails.artifacts && taskDetails.artifacts.chatRecord),
                            hasConversation: !!(taskDetails && taskDetails.artifacts && taskDetails.artifacts.chatRecord && taskDetails.artifacts.chatRecord.conversation)
                        });
                        
                        if (taskDetails && taskDetails.artifacts && taskDetails.artifacts.chatRecord && taskDetails.artifacts.chatRecord.conversation) {
                            // Log the raw conversation data from the task
                            console.log(`[TaskUIManager] Raw conversation data from task:`, taskDetails.artifacts.chatRecord.conversation.map(msg => ({
                                id: msg.id,
                                role: msg.role,
                                contentLength: msg.content.length,
                                hasReasoningContent: !!(msg.reasoningContent && msg.reasoningContent.trim()),
                                reasoningContentLength: msg.reasoningContent ? msg.reasoningContent.length : 0
                            })));
                            
                            // Use the full conversation data with reasoning content
                            conversation = taskDetails.artifacts.chatRecord.conversation.map(msg => ({
                                id: msg.id,
                                role: msg.role,
                                content: msg.content,
                                reasoningContent: msg.reasoningContent || null
                            }));
                            console.log(`[TaskUIManager] Loaded conversation with ${conversation.length} messages including reasoning content`);
                        }
                    } catch (err) {
                        console.warn('[TaskUIManager] Could not read full conversation data from scheduler', err);
                    }
                }
                
                // Fallback: build conversation from DOM if scheduler data not available
                if (conversation.length === 0) {
                    const chatTextEl = taskEl.querySelector('.task-chat-text');
                    const spans = chatTextEl ? Array.from(chatTextEl.querySelectorAll('span.chat-user, span.chat-assistant')) : [];
                    const now = Date.now();
                    conversation = spans.map((sp, idx) => ({
                        id: Number(now + idx), // numeric unique id (ms-based)
                        role: sp.classList.contains('chat-user') ? 'user' : 'assistant',
                        content: sp.textContent || '',
                        reasoningContent: null // No reasoning content available from DOM
                    }));
                    console.log(`[TaskUIManager] Built conversation from DOM with ${conversation.length} messages (no reasoning content)`);
                }
                
                // Obtain system prompt from stored inputs if available, else from scheduler task record
                let systemPrompt = '';
                if (taskData.inputs && taskData.inputs.cgsInputs && taskData.inputs.cgsInputs.chatSystemPrompt) {
                    systemPrompt = taskData.inputs.cgsInputs.chatSystemPrompt;
                } else if (this.scheduler && typeof this.scheduler.getTask === 'function') {
                    try {
                        const taskDetails = this.scheduler.getTask(taskId);
                        if (taskDetails && taskDetails.inputs && taskDetails.inputs.cgsInputs) {
                            systemPrompt = taskDetails.inputs.cgsInputs.chatSystemPrompt || '';
                        }
                    } catch (err) {
                        console.warn('[TaskUIManager] Could not read task inputs from scheduler', err);
                    }
                }
                
                // Apply to main chat instance if present
                if (window.chatInstance && window.chatInstance.chatService) {
                    // Halt any ongoing generation in main chat before replacing content
                    if (typeof window.chatInstance.haltAllGeneration === 'function') {
                        try { window.chatInstance.haltAllGeneration(); } catch (_) {}
                    }
                    
                    // Log the final conversation data being passed to main chat
                    console.log(`[TaskUIManager] Final conversation data being passed to main chat:`, conversation.map(msg => ({
                        id: msg.id,
                        role: msg.role,
                        contentLength: msg.content.length,
                        hasReasoningContent: !!(msg.reasoningContent && msg.reasoningContent.trim()),
                        reasoningContentLength: msg.reasoningContent ? msg.reasoningContent.length : 0
                    })));
                    
                    window.chatInstance.chatService.setSystemPrompt(systemPrompt || '');
                    window.chatInstance.chatService.setConversation(conversation);

                    // Map parallel-test fields to main chat UI controls:
                    try {
                        const inputs = taskData.inputs || (this.scheduler && typeof this.scheduler.getTask === 'function' ? (this.scheduler.getTask(taskId)?.inputs || null) : null);
                        if (window.chatInstance.uiManager && inputs && inputs.cgsInputs) {
                            const ui = window.chatInstance.uiManager;
                            const cgs = inputs.cgsInputs;
                            // 初始消息 -> 初始响应
                            if (typeof cgs.initialMessage !== 'undefined' && ui.initialResponseInput) {
                                ui.initialResponseInput.value = cgs.initialMessage || '';
                            }
                            // 自动回复提示 -> 响应提示
                            if (typeof cgs.autoresponseSystemPrompt !== 'undefined' && ui.responsePromptInput) {
                                ui.responsePromptInput.value = cgs.autoresponseSystemPrompt || '';
                            }
                            // 对话模型配置 -> 模型设置 (model name + sampling params)
                            if (typeof cgs.modelName !== 'undefined') {
                                if (ui.modelInput) ui.modelInput.value = cgs.modelName || '';
                                if (window.chatInstance.chatService && typeof window.chatInstance.chatService.updateModelName === 'function') {
                                    window.chatInstance.chatService.updateModelName(String(cgs.modelName || ''));
                                }
                            }
                            if (typeof cgs.temperature !== 'undefined' && ui.temperatureInput) {
                                ui.temperatureInput.value = cgs.temperature;
                            }
                            if (typeof cgs.topP !== 'undefined' && ui.topPInput) {
                                ui.topPInput.value = cgs.topP;
                            }
                        }
                    } catch (mapErr) {
                        console.warn('[TaskUIManager] Failed to map parallel preset fields to main chat UI', mapErr);
                    }
                    
                    // Switch to the main chat tab
                    const chatTabLink = document.querySelector('.tab-link[data-tab="chat-tab"]');
                    if (chatTabLink) chatTabLink.click();
                    
                    // Render messages in main chat
                    try { window.chatInstance.renderMessages(); } catch (err) { console.error('[TaskUIManager] renderMessages failed', err); }
                } else {
                    console.warn('[TaskUIManager] No main chat instance to load task content into');
                }
            } catch (err) {
                console.error('[TaskUIManager] Shift+Click handler error', err);
            }
        }, { passive: false });
        
        // Scroll to bottom to show new task
        container.scrollTop = container.scrollHeight;
    }

    handleTaskEvent(taskId, event, payload) {
        const taskData = this.tasks.get(taskId);
        if (!taskData) return;
        
        switch (event) {
            case 'streamStart':
                this.handleStreamStart(taskId, payload);
                break;
            case 'streamChunk':
                this.handleStreamChunk(taskId, payload);
                break;
            case 'streamRoleSwitch':
                this.handleRoleSwitch(taskId, payload);
                break;
            case 'streamEnd':
                this.handleStreamEnd(taskId, payload);
                break;
            case 'evalUpdate':
                this.handleEvalUpdate(taskId, payload);
                break;
            case 'complete':
                this.handleTaskComplete(taskId, payload);
                break;
            case 'error':
                this.handleTaskError(taskId, payload);
                break;
            case 'abort':
                this.handleTaskAbort(taskId, payload);
                break;
        }
        
        // Don't log all task events to console as it's too noisy
    }

    handleStreamStart(taskId, payload) {
        const taskData = this.tasks.get(taskId);
        if (!taskData) return;
        
        taskData.startTime = Date.now();
        taskData.chatText = '';
        taskData.chatHtml = '';
        taskData.currentRole = payload.role;
        taskData.pendingChunks = [];
        taskData.conversationLength = 0; // reset rounds tracking at start
        
        // Clear any existing chunk display interval
        if (taskData.chunkDisplayInterval) {
            clearInterval(taskData.chunkDisplayInterval);
            taskData.chunkDisplayInterval = null;
        }
        
        // Clear the chat text element
        const chatTextEl = taskData.element.querySelector('.task-chat-text');
        if (chatTextEl) {
            chatTextEl.innerHTML = '';
        }
        
        this.updateTaskTimer(taskId);
        this.updateTaskChatText(taskId);
        this.updateRoundsCounter(taskId);
    }

    handleStreamChunk(taskId, payload) {
        const taskData = this.tasks.get(taskId);
        if (!taskData) return;
        
        // Append chunk to chat text with role-based styling
        const { chunk, role } = payload;
        
        // If role changed, create a new span
        if (role !== taskData.currentRole) {
            taskData.currentRole = role;
        }
        
        // Add chunk to the pending queue
        taskData.pendingChunks.push({
            chunk: chunk,
            role: role,
            timestamp: Date.now() // Track when chunk was received
        });
        
        // Start chunk display interval if not already running
        if (!taskData.chunkDisplayInterval) {
            taskData.chunkDisplayInterval = setInterval(() => {
                this.displayNextChunk(taskId);
            }, 30); // Display one chunk every 30ms for smoother animation
        }
    }

    handleRoleSwitch(taskId, payload) {
        const taskData = this.tasks.get(taskId);
        if (!taskData) return;
        
        taskData.currentRole = payload.role;
    }

    handleStreamEnd(taskId, payload) {
        const taskData = this.tasks.get(taskId);
        if (!taskData) return;
        
        const { conversation } = payload;
        taskData.conversationLength = conversation.length;
        
        // Stop timer
        if (taskData.timerInterval) {
            clearInterval(taskData.timerInterval);
            taskData.timerInterval = null;
        }
        
        // Stop chunk display interval
        if (taskData.chunkDisplayInterval) {
            clearInterval(taskData.chunkDisplayInterval);
            taskData.chunkDisplayInterval = null;
        }
 
        // Normalize the span structure to one message one span after streaming completes
        this.normalizeMessageSpans(taskId, conversation);
        // Update the rounds counter now that we have authoritative conversation length
        this.updateRoundsCounter(taskId);
 
        console.log(`[TaskUIManager] Task ${taskId} conversation ended with ${conversation.length} messages`);
    }

    handleEvalUpdate(taskId, payload) {
        const taskData = this.tasks.get(taskId);
        if (!taskData) return;
        
        const { service, status, data, error } = payload;
        
        if (service === 'assessment') {
            const mistakesEl = taskData.element.querySelector('.task-mistakes-indicator');
            if (mistakesEl) {
                if (status === 'started') {
                    // Add analyzing class to start blinking
                    mistakesEl.classList.add('analyzing');
                } else if (status === 'completed' || status === 'failed') {
                    // Remove analyzing class to stop blinking
                    mistakesEl.classList.remove('analyzing');
                    
                    if (status === 'completed' && data) {
                        // Update mistake counters
                        taskData.issueCounts = {
                            Inform: data.Inform?.length || 0,
                            Warning: data.Warning?.length || 0,
                            Error: data.Error?.length || 0,
                            Unlisted: data.Unlisted?.length || 0
                        };
                        // Store assessment result
                        taskData.assessmentResult = data;
                        // Add assessment-ready class to enable clicking
                        taskData.element.classList.add('assessment-ready');
                        this.updateMistakeCounters(taskId);
                    }
                }
            }
        } else if (service === 'rating') {
            if (status === 'completed' && data) {
                // Debug: Log the rating data when received with detailed expert information
                console.log(`[TaskUIManager] Rating completed for task ${taskId}:`, {
                    finalScore: data.finalScore,
                    scores: data.scores,
                    comments: data.comments,
                    expertFields: data.expertFields,
                    expertHarshness: data.expertHarshness,
                    expertCount: data.scores ? data.scores.length : 0,
                    expertFieldsCount: data.expertFields ? data.expertFields.length : 0,
                    dataIntegrity: {
                        scoresMatchComments: data.scores && data.comments && data.scores.length === data.comments.length,
                        expertFieldsMatchScores: data.expertFields && data.scores && data.expertFields.length === data.scores.length,
                        expertHarshnessMatchScores: data.expertHarshness && data.scores && data.expertHarshness.length === data.scores.length
                    }
                });
                
                // Additional debugging for expert field issues
                if (data.expertFields && data.expertFields.length > 0) {
                    const genericExpertCount = data.expertFields.filter(field => field === '专家' || field === '对话专家').length;
                    console.log(`[TaskUIManager] Expert field analysis for task ${taskId}:`, {
                        totalExperts: data.expertFields.length,
                        genericExperts: genericExpertCount,
                        specificExperts: data.expertFields.length - genericExpertCount,
                        expertFieldValues: data.expertFields
                    });
                }
                
                // Update expert score
                taskData.expertScore = data.finalScore;
                // Store rating result
                taskData.ratingResult = data;
                this.updateExpertScore(taskId);
            }
        }
        
        if (status === 'failed' && error) {
            console.error(`[TaskUIManager] Task ${taskId} ${service} failed:`, error);
        }
    }

    handleTaskComplete(taskId, payload) {
        const taskData = this.tasks.get(taskId);
        if (!taskData) return;
        
        // Stop blinking in case it's still running
        const mistakesEl = taskData.element.querySelector('.task-mistakes-indicator');
        if (mistakesEl) {
            mistakesEl.classList.remove('analyzing');
        }
        
        const { assessmentResult, ratingResult } = payload;
        
        // Final update of metrics
        if (assessmentResult) {
            taskData.issueCounts = {
                Inform: assessmentResult.Inform?.length || 0,
                Warning: assessmentResult.Warning?.length || 0,
                Error: assessmentResult.Error?.length || 0,
                Unlisted: assessmentResult.Unlisted?.length || 0
            };
            // Store assessment result
            taskData.assessmentResult = assessmentResult;
            // Add assessment-ready class to enable clicking
            taskData.element.classList.add('assessment-ready');
            this.updateMistakeCounters(taskId);
        }
        
        if (ratingResult) {
            // Debug: Log the rating result from task completion with expert analysis
            console.log(`[TaskUIManager] Task ${taskId} completion ratingResult:`, {
                finalScore: ratingResult.finalScore,
                scores: ratingResult.scores,
                comments: ratingResult.comments,
                expertFields: ratingResult.expertFields,
                expertHarshness: ratingResult.expertHarshness,
                hasExpertData: !!(ratingResult.expertFields && ratingResult.expertFields.length > 0),
                expertNames: ratingResult.expertFields || [],
                dataValidation: {
                    hasScores: !!(ratingResult.scores && ratingResult.scores.length > 0),
                    hasComments: !!(ratingResult.comments && ratingResult.comments.length > 0),
                    hasExpertFields: !!(ratingResult.expertFields && ratingResult.expertFields.length > 0),
                    hasExpertHarshness: !!(ratingResult.expertHarshness && ratingResult.expertHarshness.length > 0),
                    arraysMatch: ratingResult.scores && ratingResult.comments && ratingResult.expertFields && 
                                ratingResult.scores.length === ratingResult.comments.length && 
                                ratingResult.scores.length === ratingResult.expertFields.length
                }
            });
            
            // Warn if expert data is missing or incomplete
            if (!ratingResult.expertFields || ratingResult.expertFields.length === 0) {
                console.warn(`[TaskUIManager] Task ${taskId}: Missing expertFields in rating result`);
            } else if (ratingResult.expertFields.some(field => !field || field === '专家')) {
                console.warn(`[TaskUIManager] Task ${taskId}: Some expert fields are missing or generic:`, ratingResult.expertFields);
            }
            
            taskData.expertScore = ratingResult.finalScore;
            // Store rating result
            taskData.ratingResult = ratingResult;
            this.updateExpertScore(taskId);
        }
        
        console.log(`[TaskUIManager] Task ${taskId} completed`, payload);
    }

    handleTaskError(taskId, payload) {
        const taskData = this.tasks.get(taskId);
        if (!taskData) return;
        
        console.error(`[TaskUIManager] Task ${taskId} error:`, payload);
        
        // Update status to error
        this.updateTaskStatus(taskId, 'error', taskData.phase, Date.now());
    }

    handleTaskAbort(taskId, payload) {
        const taskData = this.tasks.get(taskId);
        if (!taskData) return;
        
        console.log(`[TaskUIManager] Task ${taskId} aborted`, payload);
        
        // Stop timer
        if (taskData.timerInterval) {
            clearInterval(taskData.timerInterval);
            taskData.timerInterval = null;
        }
        
        // Stop chunk display interval
        if (taskData.chunkDisplayInterval) {
            clearInterval(taskData.chunkDisplayInterval);
            taskData.chunkDisplayInterval = null;
        }
        
        // Update status to aborted
        this.updateTaskStatus(taskId, 'aborted', taskData.phase, Date.now());
    }

    updateTaskStatus(taskId, status, stage, updatedAt) {
        const taskData = this.tasks.get(taskId);
        if (!taskData) return;
        
        taskData.status = status;
        taskData.stage = stage;
        taskData.updatedAt = updatedAt;
        
        // Add/remove generating class for construction warning styling
        if (status === 'generating') {
            taskData.element.classList.add('generating');
        } else {
            taskData.element.classList.remove('generating');
        }
        
        // Start/stop timer based on status (for internal tracking, not displayed)
        if (status === 'generating' && !taskData.timerInterval) {
            this.updateTaskTimer(taskId);
        } else if ((status === 'completed' || status === 'aborted' || status === 'error') && taskData.timerInterval) {
            clearInterval(taskData.timerInterval);
            taskData.timerInterval = null;
        }
    }

    updateTaskTimer(taskId) {
        const taskData = this.tasks.get(taskId);
        if (!taskData) return;
        
        // Clear existing interval
        if (taskData.timerInterval) {
            clearInterval(taskData.timerInterval);
        }
        
        // Update timer every second
        taskData.timerInterval = setInterval(() => {
            const elapsed = Date.now() - taskData.startTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            const timerEl = taskData.element.querySelector('.task-timer');
            if (timerEl) {
                timerEl.textContent = timeStr;
            }
        }, 1000);
    }

    displayNextChunk(taskId) {
        const taskData = this.tasks.get(taskId);
        if (!taskData || taskData.pendingChunks.length === 0) return;
        
        // Get the next chunk from the queue
        const nextChunk = taskData.pendingChunks.shift();
        
        // Add to chat text
        taskData.chatText += nextChunk.chunk;
        
        // Instead of building HTML with escaped chunks, we'll use textContent
        // to avoid HTML interpretation issues with special sequences like <?END_CHAT>
        // This ensures that all text is displayed as plain text, not HTML
        const chatTextEl = taskData.element.querySelector('.task-chat-text');
        if (chatTextEl) {
            // Append to the last span if role matches; otherwise create a new message span
            const lastChild = chatTextEl.lastElementChild;
            if (lastChild && lastChild.classList.contains(`chat-${nextChunk.role}`)) {
                lastChild.textContent += nextChunk.chunk;
            } else {
                const span = document.createElement('span');
                span.className = `chat-${nextChunk.role}`;
                span.textContent = nextChunk.chunk; // Use textContent to avoid HTML interpretation
                chatTextEl.appendChild(span);
            }
            
            // Scroll to the right to show latest content
            chatTextEl.scrollLeft = chatTextEl.scrollWidth;
        }

        // Update rounds counter as chunks produce new spans/messages
        try { this.updateRoundsCounter(taskId); } catch (e) { /* best-effort */ }
        
        // If no more chunks, clear the interval
        if (taskData.pendingChunks.length === 0 && taskData.chunkDisplayInterval) {
            clearInterval(taskData.chunkDisplayInterval);
            taskData.chunkDisplayInterval = null;
        }
    }

    updateTaskChatText(taskId) {
        const taskData = this.tasks.get(taskId);
        if (!taskData) return;
        
        const chatTextEl = taskData.element.querySelector('.task-chat-text');
        if (!chatTextEl) return;
        
        // Since we're now directly manipulating the DOM in displayNextChunk,
        // we don't need to set innerHTML here anymore
        // Just ensure the scrolling is correct
        chatTextEl.scrollLeft = chatTextEl.scrollWidth;
    }

    updateMistakeCounters(taskId) {
        const taskData = this.tasks.get(taskId);
        if (!taskData) return;
        
        const mistakesEl = taskData.element.querySelector('.task-mistakes-indicator');
        if (!mistakesEl) return;
        
        // Update each counter with new structure
        const colorMap = {
            'Inform': 'blue',
            'Warning': 'yellow',
            'Error': 'red',
            'Unlisted': 'grey'
        };
        
        Object.entries(colorMap).forEach(([severity, color]) => {
            const mistakeItem = mistakesEl.querySelector(`.mistake-item.${color}`);
            if (mistakeItem) {
                const numberEl = mistakeItem.querySelector('.mistake-number');
                if (numberEl) {
                    numberEl.textContent = taskData.issueCounts[severity] || 0;
                }
            }
        });
    }

    /**
     * Update rounds counter for a task bubble.
     * Rounds = floor(number_of_messages / 2)
     * Prefer authoritative taskData.conversationLength when available, otherwise
     * count message spans in the DOM (chat-user / chat-assistant).
     */
    updateRoundsCounter(taskId) {
        const taskData = this.tasks.get(taskId);
        if (!taskData) return;

        let rounds = 0;
        if (typeof taskData.conversationLength === 'number' && taskData.conversationLength > 0) {
            rounds = Math.floor(taskData.conversationLength / 2);
        } else {
            const chatTextEl = taskData.element.querySelector('.task-chat-text');
            if (chatTextEl) {
                const spans = chatTextEl.querySelectorAll('span.chat-user, span.chat-assistant');
                rounds = Math.floor(spans.length / 2);
            }
        }

        const roundsEl = taskData.element.querySelector('.task-rounds-number');
        if (roundsEl) {
            roundsEl.textContent = `${rounds}　轮`;
        }
    }

    /**
     * Add click event handlers to task bubble
     * @param {string} taskId - Task ID
     */
    addTaskClickHandlers(taskId) {
        const taskData = this.tasks.get(taskId);
        if (!taskData) return;

        const taskEl = taskData.element;
        const mistakesIndicator = taskEl.querySelector('.task-mistakes-indicator');
        const scoreContainer = taskEl.querySelector('.task-score-container');
        const chatTextContainer = taskEl.querySelector('.task-chat-text-container');
 
        // Strict fast double-click handler: only very fast double clicks trigger preview.
        // We implement our own timing-based detector (short threshold) so that normal
        // single/deliberate clicks do not accidentally open the preview.
        (function attachFastDblClick(el, cb, altHandler) {
            const THRESHOLD_MS = 220; // strict fast double click threshold
            let lastClickAt = 0;

            el.addEventListener('click', (e) => {
                // If Alt/Option is pressed, prefer the altHandler immediately (force progress)
                if (e.altKey || (e.getModifierState && e.getModifierState('Alt'))) {
                    try {
                        e.preventDefault();
                        e.stopPropagation();
                    } catch (_) {}
                    lastClickAt = 0;
                    if (typeof altHandler === 'function') altHandler(e);
                    return;
                }

                const now = Date.now();
                const delta = now - lastClickAt;

                if (delta > 0 && delta <= THRESHOLD_MS) {
                    // Fast double-click detected
                    try {
                        e.preventDefault();
                        e.stopPropagation();
                    } catch (_) {}
                    lastClickAt = 0;
                    cb(e);
                    return;
                }

                // Record this click time and clear shortly after if no second click arrives
                lastClickAt = now;
                setTimeout(() => {
                    if (lastClickAt === now) lastClickAt = 0;
                }, THRESHOLD_MS + 10);
            });
        })(taskEl, (e) => {
            // double-click callback: build and show preview
            const inputs = taskData.inputs || (this.scheduler && typeof this.scheduler.getTask === 'function' ? (this.scheduler.getTask(taskId)?.inputs || null) : null);
            const preset = this._buildPresetFromInputs(inputs);

            if (preset && window.ConfigPanel && typeof window.ConfigPanel.showTempPreset === 'function') {
                // pass source task id so ConfigPanel can highlight the source bubble
                window.ConfigPanel.showTempPreset(preset, String(taskId));
            } else {
                console.warn('[TaskUIManager] No preset available for fast-dblclick-preview');
            }
        }, (e) => {
            // alt/option click handler (force progress)
            this.handleForceProgress(taskId);
        });

        // Handle clicks on the mistakes indicator
        mistakesIndicator.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Check if assessment is ready
            if (!taskData.assessmentResult) {
                return; // Don't expand if assessment not ready
            }

            this.toggleMistakesDropdown(taskId);
        });

        // Handle clicks on the score area
        scoreContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Check if score is available
            if (!taskData.expertScore || !taskData.ratingResult) {
                return; // Don't expand if score not available
            }

            this.toggleScoreDropdown(taskId);
        });
    }

    /**
     * Toggle mistakes dropdown expansion
     * @param {string} taskId - Task ID
     */
    toggleMistakesDropdown(taskId) {
        const taskData = this.tasks.get(taskId);
        if (!taskData) return;

        const taskEl = taskData.element;
        const mistakesDropdown = taskEl.querySelector('.task-mistakes-dropdown');

        // If already expanded, collapse
        if (taskData.mistakesExpanded) {
            taskEl.classList.remove('mistakes-expanded');
            taskData.mistakesExpanded = false;
            // Clear content after animation completes
            setTimeout(() => {
                if (!taskData.mistakesExpanded) {
                    this.clearMistakesDropdown(taskId);
                }
            }, 300); // Match animation duration
            return;
        }

        // Close score dropdown if it's open (mutually exclusive)
        if (taskData.scoreExpanded) {
            this.toggleScoreDropdown(taskId);
        }

        // Expand mistakes dropdown
        taskEl.classList.add('mistakes-expanded');
        taskData.mistakesExpanded = true;

        // Populate content if not already populated
        if (taskData.assessmentResult) {
            const mistakesDropdownContent = document.getElementById(`mistakes-dropdown-${taskId}`);
            if (mistakesDropdownContent && !mistakesDropdownContent.hasChildNodes()) {
                this.populateMistakeDetails(taskId, mistakesDropdownContent);
            }
        }
    }

    /**
     * Toggle score dropdown expansion
     * @param {string} taskId - Task ID
     */
    toggleScoreDropdown(taskId) {
        const taskData = this.tasks.get(taskId);
        if (!taskData) return;

        const taskEl = taskData.element;
        const scoreDropdown = taskEl.querySelector('.task-score-dropdown');

        // If already expanded, collapse
        if (taskData.scoreExpanded) {
            taskEl.classList.remove('score-expanded');
            taskData.scoreExpanded = false;
            // Clear content after animation completes
            setTimeout(() => {
                if (!taskData.scoreExpanded) {
                    this.clearScoreDropdown(taskId);
                }
            }, 300); // Match animation duration
            return;
        }

        // Close mistakes dropdown if it's open (mutually exclusive)
        if (taskData.mistakesExpanded) {
            this.toggleMistakesDropdown(taskId);
        }

        // Expand score dropdown
        taskEl.classList.add('score-expanded');
        taskData.scoreExpanded = true;

        // Populate content if not already populated
        if (taskData.ratingResult) {
            const scoreDropdownContent = document.getElementById(`score-dropdown-${taskId}`);
            if (scoreDropdownContent && !scoreDropdownContent.hasChildNodes()) {
                this.populateScoreDetails(taskId, scoreDropdownContent);
            }
        }
    }

    /**
     * Clear mistakes dropdown content
     * @param {string} taskId - Task ID
     */
    clearMistakesDropdown(taskId) {
        const taskData = this.tasks.get(taskId);
        if (!taskData) return;

        const mistakesDropdownContent = document.getElementById(`mistakes-dropdown-${taskId}`);
        if (mistakesDropdownContent) {
            mistakesDropdownContent.innerHTML = '';
        }
    }

    /**
     * Clear score dropdown content
     * @param {string} taskId - Task ID
     */
    clearScoreDropdown(taskId) {
        const taskData = this.tasks.get(taskId);
        if (!taskData) return;

        const scoreDropdownContent = document.getElementById(`score-dropdown-${taskId}`);
        if (scoreDropdownContent) {
            scoreDropdownContent.innerHTML = '';
        }
    }


    /**
     * Populate mistake details in dropdown
     * @param {string} taskId - Task ID
     * @param {HTMLElement} container - Container element
     */
    populateMistakeDetails(taskId, container) {
        const taskData = this.tasks.get(taskId);
        if (!taskData || !taskData.assessmentResult) return;

        const assessmentResult = taskData.assessmentResult;
        
        // Clear existing content
        container.innerHTML = '';

        // Helper function to create mistake item
        const createMistakeItem = (mistake, severity) => {
            const item = document.createElement('div');
            item.className = 'mistake-detail-item';
            item.innerHTML = `
                <div class="mistake-name">${mistake.name || 'Unknown'}</div>
                <div class="mistake-location">Message ${mistake.where?.messageId || 'N/A'}: "${this.truncateText(mistake.where?.text || 'N/A', 40)}"</div>
                <div class="mistake-explanation">${mistake.explanation || 'No explanation provided'}</div>
            `;
            
            // Add hover event listener for highlighting
            item.addEventListener('mouseenter', () => {
                this.highlightMistakeInChat(taskId, mistake, severity);
                console.log(`[TaskUIManager] Hovering over mistake: ${mistake.name}, severity: ${severity}`);
            });
            
            item.addEventListener('mouseleave', () => {
                this.clearMistakeHighlight(taskId);
                console.log(`[TaskUIManager] Cleared highlight for mistake: ${mistake.name}`);
            });
            
            return item;
        };

        // Add mistakes for each severity level
        const severities = ['Inform', 'Warning', 'Error', 'Unlisted'];
        const severityLabels = {
            Inform: '信息',
            Warning: '警告',
            Error: '错误',
            Unlisted: '未分类'
        };
        const severityClasses = {
            Inform: 'inform',
            Warning: 'warning',
            Error: 'error',
            Unlisted: 'unlisted'
        };

        let hasMistakes = false;

        severities.forEach(severity => {
            const mistakes = assessmentResult[severity] || [];
            if (mistakes.length > 0) {
                hasMistakes = true;
                
                // Create category container
                const category = document.createElement('div');
                category.className = 'mistake-category';
                
                // Create category header
                const categoryHeader = document.createElement('div');
                categoryHeader.className = `mistake-category-header ${severityClasses[severity]}`;
                categoryHeader.innerHTML = `
                    ${severityLabels[severity]}
                    <span class="mistake-category-count">${mistakes.length}</span>
                `;
                category.appendChild(categoryHeader);

                // Add mistake items
                mistakes.forEach(mistake => {
                    category.appendChild(createMistakeItem(mistake, severity));
                });

                container.appendChild(category);
            }
        });

        // If no mistakes found
        if (!hasMistakes) {
            const noMistakes = document.createElement('div');
            noMistakes.className = 'dropdown-empty-state';
            noMistakes.textContent = '未发现错误';
            container.appendChild(noMistakes);
        }
    }

    /**
     * Truncate text to specified length
     * @param {string} text - Text to truncate
     * @param {number} length - Maximum length
     * @returns {string} Truncated text
     */
    truncateText(text, length) {
        if (!text) return 'N/A';
        return text.length > length ? text.substring(0, length) + '...' : text;
    }

    /**
     * Populate score details in dropdown
     * @param {string} taskId - Task ID
     * @param {HTMLElement} container - Container element
     */
    populateScoreDetails(taskId, container) {
        const taskData = this.tasks.get(taskId);
        if (!taskData || !taskData.ratingResult) return;

        const ratingResult = taskData.ratingResult;
        
        // Debug: Log the actual rating result data
        console.log(`[TaskUIManager] populateScoreDetails for task ${taskId}:`, {
            scores: ratingResult.scores,
            comments: ratingResult.comments,
            expertFields: ratingResult.expertFields,
            expertHarshness: ratingResult.expertHarshness,
            finalScore: ratingResult.finalScore
        });
        
        // Clear existing content
        container.innerHTML = '';

        // Create score summary section
        const scoreSummary = document.createElement('div');
        scoreSummary.className = 'expert-score-summary';
        scoreSummary.innerHTML = `
            <div class="expert-score-summary-title">专家平均评分</div>
            <div class="expert-score-summary-value">${parseFloat(ratingResult.finalScore).toFixed(1)}</div>
            <div class="expert-score-summary-subtitle">满分 10 分</div>
        `;
        container.appendChild(scoreSummary);

        // Add individual expert scores
        if (ratingResult.scores && ratingResult.comments && ratingResult.scores.length === ratingResult.comments.length) {
            const expertFields = ratingResult.expertFields || [];
            const expertHarshness = ratingResult.expertHarshness || [];
            
            console.log(`[TaskUIManager] Processing ${ratingResult.scores.length} expert scores:`);
            console.log(`[TaskUIManager] expertFields:`, expertFields);
            console.log(`[TaskUIManager] expertHarshness:`, expertHarshness);
            
            for (let i = 0; i < ratingResult.scores.length; i++) {
                const scoreItem = document.createElement('div');
                scoreItem.className = 'expert-score-item';
                
                
                // Create score header
                const scoreHeader = document.createElement('div');
                scoreHeader.className = 'expert-score-header';
                scoreHeader.innerHTML = `
                    <div class="expert-field">${expertFields[i] || '专家'}</div>
                    <div class="expert-score">${parseFloat(ratingResult.scores[i]).toFixed(1)}</div>
                `;
                
                // Create comment section
                const commentSection = document.createElement('div');
                commentSection.className = 'expert-comment';
                commentSection.textContent = ratingResult.comments[i] || '无评价';
                
                scoreItem.appendChild(scoreHeader);
                scoreItem.appendChild(commentSection);
                container.appendChild(scoreItem);
            }
        } else {
            // No expert scores available
            const noScores = document.createElement('div');
            noScores.className = 'dropdown-empty-state';
            noScores.textContent = '无专家评分数据';
            container.appendChild(noScores);
        }
    }

    updateExpertScore(taskId) {
        const taskData = this.tasks.get(taskId);
        if (!taskData) return;
        
        const scoreContainer = taskData.element.querySelector('.task-score-container');
        const scoreEl = taskData.element.querySelector('.task-score');
        if (!scoreContainer || !scoreEl) return;
        
        // Only show score if it exists (not null or undefined)
        if (taskData.expertScore !== null && taskData.expertScore !== undefined) {
            // Format the score to one decimal place
            const formattedScore = parseFloat(taskData.expertScore).toFixed(1);
            scoreEl.textContent = formattedScore;
            
            // Add has-score class to task bubble to trigger text bar shrinking
            taskData.element.classList.add('has-score');
            
            // Show the container and add the show class to trigger the appear animation
            scoreContainer.classList.add('show');
            scoreEl.classList.add('show');
        }
    }

    /**
     * Delete all tasks including in-progress ones
     */
    deleteAllTasks() {
        if (!this.scheduler) {
            console.error('[TaskUIManager] TaskScheduler not initialized');
            return;
        }

        // Get all task IDs
        const taskIds = Array.from(this.tasks.keys());
        
        if (taskIds.length === 0) {
            console.log('[TaskUIManager] No tasks to delete');
            return;
        }

        // Abort all tasks first (especially important for in-progress tasks)
        taskIds.forEach(taskId => {
            try {
                this.scheduler.abortTask(taskId);
            } catch (e) {
                console.warn(`[TaskUIManager] Failed to abort task ${taskId}:`, e);
            }
        });

        // Wait a bit for abort operations to complete, then delete all tasks
        setTimeout(() => {
            taskIds.forEach(taskId => {
                try {
                    this.scheduler.deleteTask(taskId);
                } catch (e) {
                    console.warn(`[TaskUIManager] Failed to delete task ${taskId}:`, e);
                }
            });

            // Clear all task UI elements
            const container = document.getElementById('task-list-container');
            if (container) {
                container.innerHTML = '';
            }

            // Clear the tasks map
            this.tasks.clear();
            
            console.log(`[TaskUIManager] Deleted all ${taskIds.length} tasks`);
        }, 100);
    }

    /**
     * Handle global click events to close dropdowns when clicking outside
     * @param {Event} e - Click event
     */
    handleGlobalClick(e) {
        // Check if any dropdown is open
        let hasOpenDropdown = false;
        for (const [taskId, taskData] of this.tasks) {
            if (taskData.mistakesExpanded || taskData.scoreExpanded) {
                hasOpenDropdown = true;
                break;
            }
        }
        
        // If no dropdown is open, do nothing
        if (!hasOpenDropdown) return;
        
        // Check if the click is inside any task bubble or its dropdowns
        const clickedInsideTask = e.target.closest('.task-bubble');
        
        // If clicked outside all task bubbles, close all open dropdowns
        if (!clickedInsideTask) {
            this.closeAllDropdowns();
            return;
        }
        
        // If clicked inside a task bubble, check if it's the one with open dropdown
        const clickedTaskId = clickedInsideTask.dataset.taskId;
        const clickedTaskData = this.tasks.get(clickedTaskId);
        
        if (clickedTaskData) {
            // If clicked on the mistakes indicator or score container, let the click handlers handle it
            const clickedOnMistakes = e.target.closest('.task-mistakes-indicator');
            const clickedOnScore = e.target.closest('.task-score-container');
            
            if (!clickedOnMistakes && !clickedOnScore) {
                // If clicked elsewhere inside the task bubble but not on the indicators, close dropdowns
                this.closeTaskDropdowns(clickedTaskId);
            }
        }
    }
    
    /**
     * Close all open dropdowns across all tasks
     */
    closeAllDropdowns() {
        for (const [taskId, taskData] of this.tasks) {
            if (taskData.mistakesExpanded || taskData.scoreExpanded) {
                this.closeTaskDropdowns(taskId);
            }
        }
    }
    
    /**
     * Close dropdowns for a specific task
     * @param {string} taskId - Task ID
     */
    closeTaskDropdowns(taskId) {
        const taskData = this.tasks.get(taskId);
        if (!taskData) return;
        
        if (taskData.mistakesExpanded) {
            this.toggleMistakesDropdown(taskId);
        }
        
        if (taskData.scoreExpanded) {
            this.toggleScoreDropdown(taskId);
        }
    }

    /**
     * Export completed tasks data to CSV format
     */
    exportCompletedTasksToCSV() {
        if (!this.scheduler) {
            console.error('[TaskUIManager] TaskScheduler not initialized');
            return;
        }

        // Get all tasks
        const allTasks = this.scheduler.listTasks();
        
        // Filter for completed tasks
        const completedTasks = allTasks.filter(task => task.status === 'completed');
        
        if (completedTasks.length === 0) {
            console.log('[TaskUIManager] No completed tasks to export');
            return;
        }

        // Prepare CSV data
        const csvData = [];
        
        completedTasks.forEach(task => {
            const taskDetails = this.scheduler.getTask(task.id);
            if (!taskDetails) return;

            const artifacts = taskDetails.artifacts;
            const assessmentResult = artifacts?.assessmentResult || {};
            const ratingResult = artifacts?.ratingResult || {};
            const chatRecord = artifacts?.chatRecord || {};

            // Calculate total issues
            const totalIssues = (assessmentResult.Inform?.length || 0) +
                               (assessmentResult.Warning?.length || 0) +
                               (assessmentResult.Error?.length || 0) +
                               (assessmentResult.Unlisted?.length || 0);

            // Create CSV row
            const csvRow = {
                taskId: task.id,
                taskName: task.name,
                status: task.status,
                createdAt: new Date(task.createdAt).toISOString(),
                completedAt: new Date(task.updatedAt).toISOString(),
                conversationLength: chatRecord.conversation?.length || 0,
                expertScore: ratingResult.finalScore || null,
                totalIssues: totalIssues,
                informIssues: assessmentResult.Inform?.length || 0,
                warningIssues: assessmentResult.Warning?.length || 0,
                errorIssues: assessmentResult.Error?.length || 0,
                unlistedIssues: assessmentResult.Unlisted?.length || 0,
                assessmentResult: JSON.stringify(assessmentResult),
                ratingResult: JSON.stringify(ratingResult),
                chatRecord: JSON.stringify(chatRecord)
            };

            csvData.push(csvRow);
        });

        // Convert to CSV
        const csvString = CSV.stringify(csvData);
        
        // Create and download the CSV file
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `completed_tasks_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log(`[TaskUIManager] Exported ${completedTasks.length} completed tasks to CSV`);
    }

    /**
     * Highlight the mistake text in the chat text area
     * @param {string} taskId - Task ID
     * @param {Object} mistake - Mistake object with positional information
     * @param {string} severity - Severity level (Inform, Warning, Error, Unlisted)
     */
    highlightMistakeInChat(taskId, mistake, severity) {
        const taskData = this.tasks.get(taskId);
        if (!taskData) {
            console.warn(`[TaskUIManager] Task data not found for taskId: ${taskId}`);
            return;
        }

        const chatTextEl = taskData.element.querySelector('.task-chat-text');
        if (!chatTextEl) {
            console.warn(`[TaskUIManager] Chat text element not found for taskId: ${taskId}`);
            return;
        }

        // Clear any existing highlights
        this.clearMistakeHighlight(taskId);

        // Get the mistake text and position
        const mistakeText = mistake.where?.text;
        const messageId = mistake.where?.messageId;

        if (!mistakeText) {
            console.warn(`[TaskUIManager] No mistake text found for mistake: ${mistake.name}`);
            return;
        }

        console.log(`[TaskUIManager] Highlighting mistake: "${mistakeText}" in message ${messageId}`);

        // Get the full text content of the chat text element
        const fullText = chatTextEl.textContent;
        const cleanedFullText = fullText.replace(/\r?\n|\r/g, '');
        const cleanedMistakeText = mistakeText.replace(/\r?\n|\r/g, '');
        
        console.log(`[TaskUIManager] Searching for cleaned text: "${cleanedMistakeText}" in cleaned content: "${cleanedFullText.substring(0, 100)}..."`);

        // Search for the mistake text in the cleaned full text
        const index = cleanedFullText.indexOf(cleanedMistakeText);
        
        if (index !== -1) {
            // Found the mistake text, now we need to highlight it in the DOM
            this.highlightTextInDOM(chatTextEl, cleanedMistakeText, index, severity);
            console.log(`[TaskUIManager] Found mistake text at cleaned index ${index}, highlighting in DOM`);
        } else {
            console.warn(`[TaskUIManager] Could not find mistake text "${cleanedMistakeText}" in chat content`);
            console.log(`[TaskUIManager] Full cleaned content length: ${cleanedFullText.length}`);
            console.log(`[TaskUIManager] Search text length: ${cleanedMistakeText.length}`);
            // Fallback behavior: select the last customer (user) message
            this.highlightLastCustomerMessage(taskId, severity);
        }
    }

    /**
     * Clear mistake highlight from chat text
     * @param {string} taskId - Task ID
     */
    clearMistakeHighlight(taskId) {
        const taskData = this.tasks.get(taskId);
        if (!taskData) return;

        const chatTextEl = taskData.element.querySelector('.task-chat-text');
        if (!chatTextEl) return;

        // Remove all highlight elements
        const highlights = chatTextEl.querySelectorAll('.mistake-highlight');
        highlights.forEach(highlight => {
            const parent = highlight.parentNode;
            parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
            parent.normalize();
        });

        console.log(`[TaskUIManager] Cleared all highlights for taskId: ${taskId}`);
    }

    /**
     * Get all text nodes within an element
     * @param {HTMLElement} element - Parent element
     * @returns {Array} Array of text nodes
     */
    getTextNodes(element) {
        const textNodes = [];
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let node;
        while (node = walker.nextNode()) {
            if (node.textContent.trim()) {
                textNodes.push(node);
            }
        }

        return textNodes;
    }

    /**
     * Scroll to highlight element within chat text
     * @param {HTMLElement} container - Chat text container
     * @param {HTMLElement} highlightEl - Highlight element to scroll to
     */
    scrollToHighlight(container, highlightEl) {
        // Get the position of the highlight element
        const highlightRect = highlightEl.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Calculate the scroll position
        const scrollLeft = highlightEl.offsetLeft - containerRect.width / 2 + highlightRect.width / 2;
        
        // Scroll to the position
        container.scrollTo({
            left: scrollLeft,
            behavior: 'smooth'
        });
        
        console.log(`[TaskUIManager] Scrolled to highlight position: ${scrollLeft}`);
    }

    /**
     * Highlight text in the DOM by searching through text nodes
     * @param {HTMLElement} container - Container element to search in
     * @param {string} searchText - Text to search for (without line breaks)
     * @param {number} startIndex - Starting index in the cleaned text
     * @param {string} severity - Severity level for styling
     */
    highlightTextInDOM(container, searchText, startIndex, severity) {
        // Robust, container-scoped highlighter that:
        // - Works only within the provided container
        // - Ignores line breaks when matching (uses cleaned text)
        // - Wraps the matched range with a span.mistake-highlight
        // - Does not rely on global selection or window.find()
        try {
            // Build a flat list of text nodes and a mapping from cleaned offsets
            const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
            const nodes = [];
            let node;
            while ((node = walker.nextNode())) {
                if (node.parentElement && !node.parentElement.classList.contains('mistake-highlight')) {
                    nodes.push(node);
                }
            }

            // Helper to compute cleaned length of a string (remove CR/LF)
            const cleanedLen = (s) => s.replace(/\r?\n|\r/g, '').length;

            // Step 1: locate the node and offset where the cleaned startIndex lands
            let cumulative = 0;
            let startNode = null;
            let startNodeOffsetInOriginal = 0; // offset into startNode.textContent (original, with line breaks)
            for (const textNode of nodes) {
                const original = textNode.textContent || '';
                const clen = cleanedLen(original);
                if (cumulative + clen > startIndex) {
                    // The match starts inside this node
                    const targetCleanedOffsetInNode = startIndex - cumulative;
                    // Map cleaned offset to original offset
                    let oIdx = 0;
                    let cCount = 0;
                    while (oIdx < original.length && cCount < targetCleanedOffsetInNode) {
                        const ch = original[oIdx++];
                        if (ch !== '\n' && ch !== '\r') cCount++;
                    }
                    startNode = textNode;
                    startNodeOffsetInOriginal = oIdx;
                    break;
                }
                cumulative += clen;
            }

            if (!startNode) {
                console.warn('[TaskUIManager] highlightTextInDOM: startNode not found');
                return;
            }

            // Step 2: collect consecutive nodes to cover searchText length (in cleaned terms)
            const neededCleaned = cleanedLen(searchText);
            let remainingCleaned = neededCleaned;
            const ranges = []; // { node, from, to } in original offsets
            // First node: from startNodeOffsetInOriginal to as far as possible
            {
                const original = startNode.textContent || '';
                let from = startNodeOffsetInOriginal;
                let to = from;
                while (to < original.length && remainingCleaned > 0) {
                    const ch = original[to++];
                    if (ch !== '\n' && ch !== '\r') remainingCleaned--;
                }
                ranges.push({ node: startNode, from, to });
            }
            // Subsequent nodes if still remaining
            if (remainingCleaned > 0) {
                let idx = nodes.indexOf(startNode) + 1;
                while (idx < nodes.length && remainingCleaned > 0) {
                    const n = nodes[idx++];
                    const original = n.textContent || '';
                    let from = 0;
                    let to = 0;
                    while (to < original.length && remainingCleaned > 0) {
                        const ch = original[to++];
                        if (ch !== '\n' && ch !== '\r') remainingCleaned--;
                    }
                    if (from !== to) {
                        ranges.push({ node: n, from, to });
                    }
                }
            }

            if (remainingCleaned > 0) {
                console.warn('[TaskUIManager] highlightTextInDOM: not enough content to cover searchText');
                return;
            }

            // Step 3: Verify that the concatenation of cleaned slice equals searchText (cleaned)
            const concatCleaned = ranges.map(r => (r.node.textContent || '').slice(r.from, r.to).replace(/\r?\n|\r/g, '')).join('');
            if (concatCleaned !== searchText) {
                // As a safety, try to search within container cleaned text starting at startIndex
                const containerClean = container.textContent.replace(/\r?\n|\r/g, '');
                const idx = containerClean.indexOf(searchText, startIndex);
                if (idx === -1) {
                    console.warn('[TaskUIManager] highlightTextInDOM: cleaned verification failed');
                    return;
                }
                // If verification failed but the global cleaned index exists elsewhere, bail to avoid wrong wrap.
                // We rely on upstream startIndex computation; do not attempt a second wrap here.
            }

            // Step 4: Wrap the ranges with a single span, handling single or multi-node selections
            const highlightEl = document.createElement('span');
            highlightEl.className = `mistake-highlight ${severity.toLowerCase()}`;

            if (ranges.length === 1) {
                const r = ranges[0];
                const range = document.createRange();
                range.setStart(r.node, r.from);
                range.setEnd(r.node, r.to);
                const frag = range.extractContents();
                highlightEl.appendChild(frag);
                range.insertNode(highlightEl);
            } else {
                // Multi-node: extract from first-from to last-to, then rebuild inside wrapper
                const first = ranges[0];
                const last = ranges[ranges.length - 1];
                const range = document.createRange();
                range.setStart(first.node, first.from);
                range.setEnd(last.node, last.to);
                const frag = range.extractContents();
                // Now we need to keep only the portion that corresponds to cleaned length; but we already cut exact ranges.
                highlightEl.appendChild(frag);
                range.insertNode(highlightEl);
            }

            // Ensure the highlight is visible (scroll into center)
            this.scrollToHighlight(container, highlightEl);
            console.log('[TaskUIManager] Highlight inserted');
        } catch (e) {
            console.error('[TaskUIManager] highlightTextInDOM error:', e);
        }
    }

    /**
     * Find the actual offset in text that may contain line breaks
     * @param {string} originalText - Original text with line breaks
     * @param {number} cleanedOffset - Offset in cleaned text
     * @returns {number} Actual offset in original text
     */
    findActualOffset(originalText, cleanedOffset) {
        let actualOffset = 0;
        let cleanedCounter = 0;
        
        while (actualOffset < originalText.length && cleanedCounter < cleanedOffset) {
            const char = originalText[actualOffset];
            
            if (char === '\n' || char === '\r') {
                actualOffset++;
                continue;
            }
            
            actualOffset++;
            cleanedCounter++;
        }
        
        return actualOffset;
    }

    /**
     * When no exact text match is found, highlight the last customer (user) message
     * within the task chat container to provide useful context.
     * @param {string} taskId
     * @param {string} severity
     */
    highlightLastCustomerMessage(taskId, severity = 'Inform') {
        const taskData = this.tasks.get(taskId);
        if (!taskData) return;

        const chatTextEl = taskData.element.querySelector('.task-chat-text');
        if (!chatTextEl) return;

        // Clear any existing highlights first
        this.clearMistakeHighlight(taskId);

        // Find all spans and select the last contiguous customer (user) message block
        const spans = Array.from(chatTextEl.querySelectorAll('span.chat-user, span.chat-assistant'));
        if (!spans.length) {
            console.warn('[TaskUIManager] No chat spans found for fallback highlight');
            return;
        }

        // Identify the last contiguous block of chat-assistant spans (the "customer" message)
        // Traverse from the end to find the last ass. span, then expand backwards while consecutive user spans
        let endIdx = -1;
        for (let i = spans.length - 1; i >= 0; i--) {
            if (spans[i].classList.contains('chat-assistant')) {
                endIdx = i;
                break;
            }
        }
        if (endIdx === -1) {
            console.warn('[TaskUIManager] No customer (assistant) message found for fallback highlight');
            return;
        }
        let startIdx = endIdx;
        for (let i = endIdx - 1; i >= 0; i--) {
            if (spans[i].classList.contains('chat-assistant') && spans[i].nextSibling === spans[i + 1]) {
                startIdx = i;
            } else {
                break;
            }
        }

        const firstSpan = spans[startIdx];
        const lastSpan = spans[endIdx];

        try {
            // Create a range covering the entire contiguous block
            const range = document.createRange();
            range.setStartBefore(firstSpan);
            range.setEndAfter(lastSpan);

            // Create the highlight wrapper
            const highlightEl = document.createElement('span');
            const sevClass = String(severity).toLowerCase(); // inform|warning|error|unlisted
            highlightEl.className = `mistake-highlight ${sevClass}`;

            // Extract block and wrap
            const frag = range.extractContents();
            highlightEl.appendChild(frag);
            range.insertNode(highlightEl);

            // Scroll into view
            this.scrollToHighlight(chatTextEl, highlightEl);
            console.log('[TaskUIManager] Fallback: highlighted entire last customer (user) message block');
        } catch (e) {
            console.error('[TaskUIManager] Error highlighting last customer message block:', e);
        }
    }

    /**
     * Handle Option+Click on task bubble to halt generation and force progress to assessment/rating phase
     * @param {string} taskId - Task ID
     */
    handleForceProgress(taskId) {
        const taskData = this.tasks.get(taskId);
        if (!taskData) {
            console.warn(`[TaskUIManager] Task data not found for taskId: ${taskId}`);
            return;
        }

        // Check if task is currently generating
        if (taskData.status !== 'generating' && taskData.stage !== 'generation') {
            console.log(`[TaskUIManager] Task ${taskId} is not in generation phase (status: ${taskData.status}, stage: ${taskData.stage})`);
            return;
        }

        console.log(`[TaskUIManager] Force progress triggered for task ${taskId}`);

        // Show visual feedback
        this.showForceProgressFeedback(taskId);

        // Get the task scheduler and trigger force progress
        if (this.scheduler) {
            try {
                // Call the scheduler's force progress method
                this.scheduler.forceProgressToAssessment(taskId);
            } catch (error) {
                console.error(`[TaskUIManager] Error forcing progress for task ${taskId}:`, error);
            }
        } else {
            console.error(`[TaskUIManager] TaskScheduler not available for task ${taskId}`);
        }

        // Best-effort normalization even when forcing progress (DOM may already have most content)
        // We don't have conversation here, so we consolidate adjacent spans by class only.
        this.normalizeMessageSpans(taskId, null);
    }

    /**
     * Show visual feedback for force progress action
     * @param {string} taskId - Task ID
     */
    showForceProgressFeedback(taskId) {
        const taskData = this.tasks.get(taskId);
        if (!taskData) return;

        const taskEl = taskData.element;
        
        // Add a temporary visual indicator
        taskEl.classList.add('force-progress');
        
        // Create and show a temporary notification
        const notification = document.createElement('div');
        notification.className = 'force-progress-notification';
        notification.textContent = '强制进入评估阶段...';
        notification.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #616161ff;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            z-index: 1000;
            pointer-events: none;
        `;
        
        taskEl.style.position = 'relative';
        taskEl.appendChild(notification);
        
        // Remove the notification after animation
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            taskEl.classList.remove('force-progress');
        }, 2000);
    }

    /**
     * Find the actual position of text in a string that may contain line breaks
     * @param {string} originalText - Original text that may contain line breaks
     * @param {string} searchText - Search text without line breaks
     * @param {number} cleanedIndex - Index in the cleaned text
     * @returns {number} Actual index in the original text
     */
    findTextPositionWithLineBreaks(originalText, searchText, cleanedIndex) {
        let originalIndex = 0;
        let cleanedIndexCounter = 0;
        
        while (originalIndex < originalText.length && cleanedIndexCounter < cleanedIndex) {
            const char = originalText[originalIndex];
            
            // If current character is a line break, skip it in the cleaned text
            if (char === '\n' || char === '\r') {
                originalIndex++;
                continue;
            }
            
            // Move both counters forward
            originalIndex++;
            cleanedIndexCounter++;
        }
        
        // Skip any remaining line breaks at the position
        while (originalIndex < originalText.length &&
               (originalText[originalIndex] === '\n' || originalText[originalIndex] === '\r')) {
            originalIndex++;
        }
        
        return originalIndex;
    }
    /**
     * Normalize the span structure within a task's chat area to one message one span.
     * If conversation is provided, rebuild exactly per-message; otherwise collapse adjacent same-role spans.
     * @param {string} taskId
     * @param {Array<{id:number,role:string,content:string,reasoningContent?:string}>|null} conversation
     */
    normalizeMessageSpans(taskId, conversation = null) {
        const taskData = this.tasks.get(taskId);
        if (!taskData) return;

        const chatTextEl = taskData.element.querySelector('.task-chat-text');
        if (!chatTextEl) return;

        // If we have the authoritative conversation, rebuild spans exactly
        if (Array.isArray(conversation) && conversation.length > 0) {
            // Build a DocumentFragment for performance
            const frag = document.createDocumentFragment();
            for (const msg of conversation) {
                const span = document.createElement('span');
                span.className = `chat-${msg.role}`;
                span.textContent = msg.content || ''; // Only display content, not reasoningContent
                frag.appendChild(span);
            }
            chatTextEl.innerHTML = '';
            chatTextEl.appendChild(frag);
            return;
        }

        // Otherwise, collapse adjacent spans of the same role class
        const children = Array.from(chatTextEl.children);
        if (children.length === 0) return;

        const collapsed = [];
        for (const el of children) {
            if (!(el instanceof HTMLElement)) continue;
            const classList = el.classList;
            const roleClass = classList.contains('chat-user') ? 'chat-user'
                            : classList.contains('chat-assistant') ? 'chat-assistant'
                            : null;
            if (!roleClass) {
                // Non-role nodes: push as-is (rare)
                collapsed.push(el);
                continue;
            }

            const last = collapsed[collapsed.length - 1];
            if (last && last.classList && last.classList.contains(roleClass)) {
                // Merge text into previous span
                last.textContent += el.textContent || '';
            } else {
                // Clone a fresh span with just the role class and text
                const span = document.createElement('span');
                span.className = roleClass;
                span.textContent = el.textContent || '';
                collapsed.push(span);
            }
        }

        // Replace children
        chatTextEl.innerHTML = '';
        for (const node of collapsed) chatTextEl.appendChild(node);
    }
}

// Initialize globally when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.taskUIManager = new TaskUIManager();
});