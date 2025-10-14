/**
 * Parallel Test - Right 1/3 Configuration Panel (UI only, no wiring to services yet)
 * Tabs: Basic, Mistakes, Experts
 * - Loads Default Preset JSON from js/parallel-test/presets/default.json
 * - Loads Mistake Library JSON from js/parallel-test/presets/mistakes.json
 * - Supports JSON export (current preset snapshot) and JSON export (mistake library)
 * - Client-side validation that blocks actions if invalid
 * - Chat System Prompt textarea is read-only and mirrors main chat prompt in real-time
 *
 * Styling hooks live in css/parallel-test.css
 */
import * as CSV from '../../utils/csv.mjs';

const PANEL_ID = 'parallel-config-panel';
const RIGHT_COL_ID = 'parallel-right-column';
const LEFT_COL_ID = 'parallel-left-column';

const DEFAULT_PRESET_PATH = 'js/parallel-test/presets/default.json';
const DEFAULT_MISTAKES_JSON_PATH = 'js/parallel-test/presets/mistakes.json';

const state = {
  activeTab: 'basic',
  previousActiveTab: null,
  preset: null,
  mistakes: [], // array of {name,severity,type,description,examples(array)}
  chatSystemPrompt: '', // live-bound from main chat
  sceneInfo: '', // live-bound from scene config
  blockingError: null,
  editingIndex: null, // index of mistake being edited, null if not editing
  addingNewMistake: false, // true if adding a new mistake

  // Temporary preview state used for task double-click preview behavior
  tempActive: false,           // whether a temporary preview is currently shown
  tempPreset: null,            // the temporary preset object being previewed (clone)
  tempSourceTaskId: null,      // taskId of the task that is the source of the preview (for highlighting)
  _tempGlobalClickHandler: null // internal reference to the global click handler while preview is active
};

function ensureContainers() {
  const parallel = document.getElementById('parallel-container');
  if (!parallel) return;

  // Create a two-column layout inside parallel-container: left 2/3 empty, right 1/3 panel
  if (!document.getElementById(LEFT_COL_ID)) {
    const left = document.createElement('div');
    left.id = LEFT_COL_ID;
    left.className = 'parallel-left-column';
    parallel.innerHTML = ''; // clear placeholder
    parallel.appendChild(left);
  }
  if (!document.getElementById(RIGHT_COL_ID)) {
    const right = document.createElement('div');
    right.id = RIGHT_COL_ID;
    right.className = 'parallel-right-column';
    parallel.appendChild(right);
  }
}

function mountPanel() {
  ensureContainers();
  const mountPoint = document.getElementById(RIGHT_COL_ID);
  if (!mountPoint) return;

  const existingPanel = document.getElementById(PANEL_ID);
  const isInitialLoad = !existingPanel;

  mountPoint.innerHTML = `
    <div id="${PANEL_ID}" class="pt-panel ${state.tempActive ? 'pt-temp-active' : ''}">
      <div class="pt-tabs">
        <button class="pt-tab ${state.activeTab === 'basic' ? 'active' : ''}" data-tab="basic">基础</button>
        <button class="pt-tab ${state.activeTab === 'mistakes' ? 'active' : ''}" data-tab="mistakes">错误库</button>
        <button class="pt-tab ${state.activeTab === 'experts' ? 'active' : ''}" data-tab="experts">专家团队</button>
      </div>

      ${renderBlockingError()}

      <div class="pt-content">
        <div class="pt-tab-content ${state.activeTab === 'basic' ? 'active' : 'hidden'}" data-tab="basic">
          ${renderBasicTab()}
        </div>
        <div class="pt-tab-content ${state.activeTab === 'mistakes' ? 'active' : 'hidden'}" data-tab="mistakes">
          ${renderMistakesTab()}
        </div>
        <div class="pt-tab-content ${state.activeTab === 'experts' ? 'active' : 'hidden'}" data-tab="experts">
          ${renderExpertsTab()}
        </div>
      </div>
    </div>
  `;

  bindTabEvents();
  if (!state.blockingError) {
    if (state.activeTab === 'basic') bindBasicTabEvents();
    if (state.activeTab === 'mistakes') bindMistakesTabEvents();
    // Experts is read-only
  }
}

function renderBlockingError() {
  if (!state.blockingError) return '';
  return `
    <div class="pt-blocking-error">
      <div class="pt-blocking-error-title">加载配置失败</div>
      <div class="pt-blocking-error-body">${escapeHtml(state.blockingError)}</div>
      <div class="pt-blocking-error-actions">
        <button id="pt-retry-load">重试加载</button>
      </div>
    </div>
  `;
}

function renderBasicTab() {
  // If a temporary preview is active, prefer the preview preset for rendering.
  const p = (state.tempActive && state.tempPreset) ? state.tempPreset : (state.preset || {});
  const basic = p.basic || {};
  const evaluation = p.evaluation || {};
  const dialogue = p.dialogue || {};
  const assessmentOptions = p.assessmentOptions || {};

  return `
    <div class="pt-basic-groups">
      <!-- Group: 文本与提示（full width cards) -->
      <div class="pt-basic-group">
        <h4 class="pt-group-title">文本与提示</h4>
        <div class="pt-basic-grid">
          <div class="pt-section pt-full">
            <label>聊天系统提示（同步自主对话）</label>
            <textarea id="pt-chat-system-prompt" class="pt-textarea" readonly>${escapeHtml((p && p.chatSystemPrompt) ?? state.chatSystemPrompt)}</textarea>
          </div>
          <div class="pt-section pt-full">
            <label>场景信息（同步场景配置）</label>
            <textarea id="pt-scene-info" class="pt-textarea" readonly placeholder="场景信息将自动从场景配置标签页同步...">${escapeHtml((p && p.sceneInfo) ?? state.sceneInfo ?? '')}</textarea>
          </div>
          <div class="pt-section pt-full">
            <label>初始消息</label>
            <textarea id="pt-initial-message" data-snap-id="pt-initial-message" class="pt-textarea">${escapeHtml(basic.initialMessage ?? '')}</textarea>
          </div>
          <div class="pt-section pt-full">
            <label>自动回复提示</label>
            <textarea id="pt-auto-response" data-snap-id="pt-auto-response" class="pt-textarea">${escapeHtml(basic.autoResponsePrompt ?? '')}</textarea>
          </div>
        </div>
      </div>

      <!-- Group: 结束条件与并发（single column explicitly) -->
      <div class="pt-basic-group pt-group-singlecol">
        <h4 class="pt-group-title">结束条件与并发</h4>
        <div class="pt-basic-grid">
          <div class="pt-section">
            <label>结束条件</label>
            <div class="pt-row">
              <!-- Custom select UI like main chat: wrapper + hidden select -->
              <div class="custom-select-wrapper" style="width:100%;">
                <select id="pt-end-type" style="display:none">
                  ${option('rounds', '轮次限制', (basic.endCondition?.type === 'rounds'))}
                  ${option('assistantRegex', '助理正则', (basic.endCondition?.type === 'assistantRegex'))}
                  ${option('userRegex', '用户正则', (basic.endCondition?.type === 'userRegex'))}
                </select>
                <div class="custom-select">
                  <div class="custom-select-trigger" id="pt-end-type-trigger"><span>${escapeHtml(
                    basic.endCondition?.type === 'assistantRegex' ? '助理正则' :
                    basic.endCondition?.type === 'userRegex' ? '用户正则' : '轮次限制'
                  )}</span><div class="arrow"></div></div>
                  <div class="custom-options" id="pt-end-type-options">
                    <span class="custom-option ${basic.endCondition?.type === 'rounds' ? 'selected':''}" data-value="rounds">对话轮次限制</span>
                    <span class="custom-option ${basic.endCondition?.type === 'assistantRegex' ? 'selected':''}" data-value="assistantRegex">助理正则匹配</span>
                    <span class="custom-option ${basic.endCondition?.type === 'userRegex' ? 'selected':''}" data-value="userRegex">用户正则匹配</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="pt-row">
              <input id="pt-end-rounds" class="pt-input" type="number" min="1" placeholder="轮次" value="${escapeAttr(basic.endCondition?.rounds ?? '')}">
              <input id="pt-end-assistant" class="pt-input" type="text" placeholder="助理正则表达式" value="${escapeAttr(basic.endCondition?.assistantRegex ?? '')}">
              <input id="pt-end-user" class="pt-input" type="text" placeholder="用户正则表达式" value="${escapeAttr(basic.endCondition?.userRegex ?? '')}">
            </div>
          </div>

          <div class="pt-section">
            <label>并发上限</label>
            <input id="pt-concurrency" class="pt-input" type="number" min="1" placeholder="10" value="${escapeAttr(basic.concurrencyLimit ?? '')}">
          </div>
        </div>
      </div>

      <!-- Group: 评估模型配置（force side-by-side with dedicated grid) -->
      <div class="pt-basic-group">
        <h4 class="pt-group-title">评估模型配置</h4>
        <div class="pt-eval-grid">
          <div class="pt-eval-item">
            <label class="pt-inline-label">模型</label>
            <textarea id="pt-eval-model" class="pt-textarea pt-inline">${escapeHtml(evaluation.model ?? '')}</textarea>
          </div>
          <div class="pt-eval-item">
            <label class="pt-inline-label">top-p</label>
            <input id="pt-eval-top-p" class="pt-input pt-inline" type="number" min="0" max="1" step="0.01" value="${escapeAttr(evaluation.top_p ?? '')}">
          </div>
          <div class="pt-eval-item">
            <label class="pt-inline-label">温度</label>
            <input id="pt-eval-temp" class="pt-input pt-inline" type="number" min="0" max="2" step="0.01" value="${escapeAttr(evaluation.temperature ?? '')}">
          </div>
          <div class="pt-eval-item toggles">
            <div class="pt-toggle">
              <input type="checkbox" id="pt-include-system-prompt" ${evaluation.includeSystemPrompt ? 'checked' : ''}>
              <label for="pt-include-system-prompt" class="slider"></label>
              <label for="pt-include-system-prompt" class="pt-toggle-label">包含系统提示</label>
            </div>
            <div class="pt-toggle">
              <input type="checkbox" id="pt-include-unlisted" ${assessmentOptions.includeUnlistedIssues ? 'checked' : ''}>
              <label for="pt-include-unlisted" class="slider"></label>
              <label for="pt-include-unlisted" class="pt-toggle-label">评估：包含未列出问题</label>
            </div>
          </div>
        </div>
      </div>

      <!-- Group: 对话模型配置（force side-by-side with dedicated grid) -->
      <div class="pt-basic-group">
        <h4 class="pt-group-title">对话模型配置</h4>
        <div class="pt-eval-grid">
          <div class="pt-eval-item">
            <label class="pt-inline-label">模型</label>
            <textarea id="pt-dialogue-model" data-snap-id="pt-dialogue-model" class="pt-textarea pt-inline">${escapeHtml(dialogue.model ?? '')}</textarea>
          </div>
          <div class="pt-eval-item">
            <label class="pt-inline-label">top-p</label>
            <input id="pt-dialogue-top-p" class="pt-input pt-inline" type="number" min="0" max="1" step="0.01" value="${escapeAttr(dialogue.top_p ?? '')}">
          </div>
          <div class="pt-eval-item">
            <label class="pt-inline-label">温度</label>
            <input id="pt-dialogue-temp" class="pt-input pt-inline" type="number" min="0" max="2" step="0.01" value="${escapeAttr(dialogue.temperature ?? '')}">
          </div>
        </div>
      </div>

      <!-- Group: 预设管理 -->
      <div class="pt-basic-group alt">
        <h4 class="pt-group-title">预设管理</h4>
        <div class="pt-row">
          <button id="pt-preset-load" class="pt-btn">加载默认预设</button>
          <button id="pt-preset-export" class="pt-btn">导出当前预设（JSON）</button>
          <input id="pt-preset-import-input" type="file" accept=".json" style="display:none">
          <button id="pt-preset-import" class="pt-btn">导入预设（JSON）</button>
        </div>
      </div>

      <div id="pt-basic-errors" class="pt-errors"></div>
    </div>
  `;
}

// Sort mistakes by severity: error > warning > inform
function sortMistakesBySeverity(mistakes) {
  const severityOrder = { 'error': 0, 'warning': 1, 'inform': 2 };
  return [...mistakes].sort((a, b) => {
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

function renderMistakesTab() {
  const sortedMistakes = sortMistakesBySeverity(state.mistakes);
  let cards = '';
  
  for (let i = 0; i < sortedMistakes.length; i++) {
    const m = sortedMistakes[i];
    // Find the original index for editing purposes
    const originalIndex = state.mistakes.findIndex(mistake => mistake.name === m.name);
    const isEditing = state.editingIndex === originalIndex;
    
    cards += `
    <div class="pt-mistake-card ${isEditing ? 'editing' : ''}" data-index="${originalIndex}">
      <div class="pt-mistake-header ${severityClass(m.severity)}">
    `;
    
    if (isEditing) {
      cards += `
          <input type="text" class="pt-mistake-name-input pt-input" value="${escapeHtml(m.name)}" placeholder="输入错误项名称">
          <div class="custom-select-wrapper" style="width:120px;">
            <select class="pt-mistake-severity-input" style="display:none">
              <option value="inform" ${m.severity === 'inform' ? 'selected' : ''}>inform</option>
              <option value="warning" ${m.severity === 'warning' ? 'selected' : ''}>warning</option>
              <option value="error" ${m.severity === 'error' ? 'selected' : ''}>error</option>
            </select>
            <div class="custom-select">
              <div class="custom-select-trigger pt-mistake-severity-trigger"><span>${escapeHtml(m.severity)}</span><div class="arrow"></div></div>
              <div class="custom-options pt-mistake-severity-options">
                <span class="custom-option ${m.severity === 'inform' ? 'selected':''}" data-value="inform">inform（信息）</span>
                <span class="custom-option ${m.severity === 'warning' ? 'selected':''}" data-value="warning">warning（警告）</span>
                <span class="custom-option ${m.severity === 'error' ? 'selected':''}" data-value="error">error（错误）</span>
              </div>
            </div>
          </div>
      `;
    } else {
      cards += `
          <span class="pt-mistake-name">${escapeHtml(m.name)}</span>
          <span class="pt-mistake-severity">${escapeHtml(m.severity)}</span>
      `;
    }
    
    cards += `
      </div>
      <div class="pt-mistake-body">
    `;
    
    if (isEditing) {
      cards += `
          <div class="pt-mistake-field">
            <label class="pt-mistake-field-label">类型</label>
            <input type="text" class="pt-mistake-type-input pt-input" value="${escapeHtml(m.type)}" placeholder="输入错误类型">
          </div>
          <div class="pt-mistake-field">
            <label class="pt-mistake-field-label">描述</label>
            <textarea class="pt-mistake-desc-input pt-textarea" placeholder="输入错误描述">${escapeHtml(m.description)}</textarea>
          </div>
          <div class="pt-mistake-field">
            <label class="pt-mistake-field-label">示例（JSON字符串数组）</label>
            <textarea class="pt-mistake-examples-input pt-textarea" placeholder='["示例1", "示例2"]'>${escapeHtml(JSON.stringify(m.examples || []))}</textarea>
          </div>
          <div class="pt-mistake-edit-errors pt-errors"></div>
      `;
    } else {
      cards += `
          <div class="pt-mistake-field">
            <span class="pt-mistake-field-label">类型</span>
            <span class="pt-mistake-field-value">${escapeHtml(m.type)}</span>
          </div>
          <div class="pt-mistake-field">
            <span class="pt-mistake-field-label">描述</span>
            <span class="pt-mistake-field-value">${escapeHtml(m.description)}</span>
          </div>
      `;
      
      if ((m.examples || []).length > 0) {
        cards += `
            <div class="pt-mistake-field">
              <span class="pt-mistake-field-label">示例</span>
              <div class="pt-mistake-examples">${escapeHtml((m.examples || []).join(' | '))}</div>
            </div>
        `;
      }
    }
    
    cards += `
      </div>
      <div class="pt-mistake-actions">
    `;
    
    if (isEditing) {
      cards += `
          <button class="pt-save-mistake">保存</button>
          <button class="pt-cancel-mistake">取消</button>
      `;
    } else {
      cards += `
          <button class="pt-edit-mistake">编辑</button>
          <button class="pt-delete-mistake">删除</button>
      `;
    }
    
    cards += `
      </div>
    </div>
    `;
  }

  // Add new mistake form if in "adding" mode
  let newMistakeForm = '';
  if (state.addingNewMistake) {
    newMistakeForm = `
    <div class="pt-mistake-card editing new-mistake">
      <div class="pt-mistake-header sev-warning">
        <input type="text" class="pt-mistake-name-input pt-input" value="" placeholder="输入错误项名称">
        <div class="custom-select-wrapper" style="width:120px;">
          <select class="pt-mistake-severity-input" style="display:none">
            <option value="inform">inform</option>
            <option value="warning" selected>warning</option>
            <option value="error">error</option>
          </select>
          <div class="custom-select">
            <div class="custom-select-trigger pt-mistake-severity-trigger"><span>warning</span><div class="arrow"></div></div>
            <div class="custom-options pt-mistake-severity-options">
              <span class="custom-option" data-value="inform">inform（信息）</span>
              <span class="custom-option selected" data-value="warning">warning（警告）</span>
              <span class="custom-option" data-value="error">error（错误）</span>
            </div>
          </div>
        </div>
      </div>
      <div class="pt-mistake-body">
        <div class="pt-mistake-field">
          <label class="pt-mistake-field-label">类型</label>
          <input type="text" class="pt-mistake-type-input pt-input" value="" placeholder="输入错误类型">
        </div>
        <div class="pt-mistake-field">
          <label class="pt-mistake-field-label">描述</label>
          <textarea class="pt-mistake-desc-input pt-textarea" placeholder="输入错误描述"></textarea>
        </div>
        <div class="pt-mistake-field">
          <label class="pt-mistake-field-label">示例（JSON字符串数组）</label>
          <textarea class="pt-mistake-examples-input pt-textarea" placeholder='["示例1", "示例2"]'>[]</textarea>
        </div>
        <div class="pt-mistake-edit-errors pt-errors"></div>
      </div>
      <div class="pt-mistake-actions">
        <button class="pt-save-new-mistake">保存</button>
        <button class="pt-cancel-new-mistake">取消</button>
      </div>
    </div>
    `;
  }

  return `
    <div class="pt-toolbar">
      <button id="pt-new-mistake" class="pt-btn-primary">新建错误项</button>
      <input id="pt-import-json-input" type="file" accept=".json" style="display:none">
      <button id="pt-import-json" class="pt-btn-secondary">导入JSON</button>
      <button id="pt-export-json" class="pt-btn-secondary">导出JSON</button>
    </div>
    <div id="pt-mistakes-list" class="pt-mistakes-list">${cards}${newMistakeForm}</div>
    <div id="pt-mistakes-errors" class="pt-errors"></div>
  `;
}


function renderExpertsTab() {
  const experts = (state.preset?.experts || []).map((e) => `
    <div class="pt-expert-row">
      <span class="pt-expert-field">${escapeHtml(e.specialization ?? e.field ?? '')}</span>
      <span class="pt-expert-portfolio">${escapeHtml(e.portfolio ?? '')}</span>
      <span class="pt-expert-harshness">${escapeHtml(String(e.harshness ?? ''))}</span>
    </div>
  `).join('');
  return `
    <div class="pt-experts">
      ${experts || '<div class="pt-empty">未找到预设中的专家</div>'}
    </div>
  `;
}

function bindTabEvents() {
  const root = document.getElementById(PANEL_ID);
  if (!root) return;

  // Hover and click switch
  root.querySelectorAll('.pt-tab').forEach(btn => {
    btn.addEventListener('mouseenter', onTabSwitch);
    btn.addEventListener('click', onTabSwitch);
  });

  const retry = root.querySelector('#pt-retry-load');
  if (retry) {
    retry.addEventListener('click', async () => {
      state.blockingError = null;
      await bootstrap();
    });
  }
}

function onTabSwitch(ev) {
  const tab = ev.currentTarget.getAttribute('data-tab');
  if (tab && state.activeTab !== tab) {
    // Simple, reliable approach - just update state and remount
    state.activeTab = tab;
    mountPanel();
  }
}

function bindBasicTabEvents() {
  const root = document.getElementById(PANEL_ID);
  if (!root) return;

  const setVal = (path, value) => {
    // When a temporary preview is active, write into the tempPreset (so UI inputs reflect the preview
    // without mutating the real state.preset). Otherwise mutate state.preset as before.
    const parts = path.split('.');
    const targetRoot = state.tempActive ? (state.tempPreset = state.tempPreset || {}) : (state.preset = state.preset || {});
    let obj = targetRoot;
    for (let i = 0; i < parts.length - 1; i++) {
      obj[parts[i]] = obj[parts[i]] || {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
  };

  const initialEl = root.querySelector('#pt-initial-message');
  const autoRespEl = root.querySelector('#pt-auto-response');
  const endTypeEl = root.querySelector('#pt-end-type');
  const endRoundsEl = root.querySelector('#pt-end-rounds');
  const endAssistantEl = root.querySelector('#pt-end-assistant');
  const endUserEl = root.querySelector('#pt-end-user');
  const concEl = root.querySelector('#pt-concurrency');

  const modelEl = root.querySelector('#pt-eval-model');
  const topPEl = root.querySelector('#pt-eval-top-p');
  const tempEl = root.querySelector('#pt-eval-temp');
  const includePromptEl = root.querySelector('#pt-include-system-prompt');
  const includeUnlistedEl = root.querySelector('#pt-include-unlisted');

  const dialogueModelEl = root.querySelector('#pt-dialogue-model');
  const dialogueTopPEl = root.querySelector('#pt-dialogue-top-p');
  const dialogueTempEl = root.querySelector('#pt-dialogue-temp');

  // Custom select refs for end-type (main chat style)
  const endTypeNative = root.querySelector('#pt-end-type');
  const endTypeTrigger = root.querySelector('#pt-end-type-trigger');
  const endTypeOptions = root.querySelector('#pt-end-type-options');

  if (initialEl) initialEl.addEventListener('input', e => setVal('basic.initialMessage', e.target.value));
  if (autoRespEl) autoRespEl.addEventListener('input', e => setVal('basic.autoResponsePrompt', e.target.value));
  if (endTypeEl) endTypeEl.addEventListener('change', e => setVal('basic.endCondition.type', e.target.value));
  if (endRoundsEl) endRoundsEl.addEventListener('input', e => setVal('basic.endCondition.rounds', e.target.valueAsNumber || null));
  if (endAssistantEl) endAssistantEl.addEventListener('input', e => setVal('basic.endCondition.assistantRegex', e.target.value));
  if (endUserEl) endUserEl.addEventListener('input', e => setVal('basic.endCondition.userRegex', e.target.value));
  if (concEl) concEl.addEventListener('input', e => setVal('basic.concurrencyLimit', e.target.valueAsNumber || null));

  if (modelEl) modelEl.addEventListener('input', e => setVal('evaluation.model', e.target.value));
  if (topPEl) topPEl.addEventListener('input', e => setVal('evaluation.top_p', e.target.valueAsNumber));
  if (tempEl) tempEl.addEventListener('input', e => setVal('evaluation.temperature', e.target.valueAsNumber));
  if (includePromptEl) includePromptEl.addEventListener('change', e => setVal('evaluation.includeSystemPrompt', !!e.target.checked));
  if (includeUnlistedEl) includeUnlistedEl.addEventListener('change', e => setVal('assessmentOptions.includeUnlistedIssues', !!e.target.checked));

  if (dialogueModelEl) dialogueModelEl.addEventListener('input', e => setVal('dialogue.model', e.target.value));
  if (dialogueTopPEl) dialogueTopPEl.addEventListener('input', e => setVal('dialogue.top_p', e.target.valueAsNumber));
  if (dialogueTempEl) dialogueTempEl.addEventListener('input', e => setVal('dialogue.temperature', e.target.valueAsNumber));

  // Wire custom select (end type) like main chat
  const updateEndTypeUI = (value) => {
    // update native select
    if (endTypeNative) endTypeNative.value = value;
    // update preset
    setVal('basic.endCondition.type', value);
    // label mapping
    const labelMap = {
      rounds: '对话轮次限制',
      assistantRegex: '助理正则匹配',
      userRegex: '用户正则匹配'
    };
    // update trigger label
    if (endTypeTrigger) {
      const span = endTypeTrigger.querySelector('span');
      if (span) span.textContent = labelMap[value] || '对话轮次限制';
    }
    // update selected state
    if (endTypeOptions) {
      endTypeOptions.querySelectorAll('.custom-option').forEach(opt => {
        opt.classList.toggle('selected', opt.getAttribute('data-value') === value);
      });
    }
  };

  if (endTypeTrigger) {
    endTypeTrigger.addEventListener('click', () => {
      const wrapper = endTypeTrigger.closest('.custom-select');
      wrapper?.classList.toggle('open');
    });
  }
  if (endTypeOptions) {
    endTypeOptions.addEventListener('click', (e) => {
      const opt = e.target.closest('.custom-option');
      if (!opt) return;
      const value = opt.getAttribute('data-value');
      updateEndTypeUI(value);
      const wrapper = endTypeTrigger?.closest('.custom-select');
      wrapper?.classList.remove('open');
    });
  }
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const select = endTypeTrigger?.closest('.custom-select');
    if (select && !select.contains(e.target)) {
      select.classList.remove('open');
    }
  });


  // Preset buttons
  const loadBtn = root.querySelector('#pt-preset-load');
  const exportBtn = root.querySelector('#pt-preset-export');
  const importBtn = root.querySelector('#pt-preset-import');
  const importInput = root.querySelector('#pt-preset-import-input');
  const errorsEl = root.querySelector('#pt-basic-errors');

  if (loadBtn) {
    loadBtn.addEventListener('click', async () => {
      try {
        const preset = await fetchPreset(DEFAULT_PRESET_PATH);
        state.preset = preset;
        renderErrors(errorsEl, []);
        mountPanel();
      } catch (e) {
        renderErrors(errorsEl, [e.message || String(e)]);
      }
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const errs = validateBasic(state.preset);
      if (errs.length > 0) {
        renderErrors(errorsEl, errs);
        return;
      }
      const dataStr = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state.preset, null, 2));
      const a = document.createElement('a');
      a.href = dataStr;
      a.download = (state.preset?.name || 'preset') + '.json';
      a.click();
    });
  }

  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', () => {
      const file = importInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = String(reader.result);
          const preset = JSON.parse(text);
          
          // Validate the preset
          const errs = validateBasic(preset);
          if (errs.length > 0) {
            renderErrors(errorsEl, errs);
            return;
          }
          
          // Update the preset
          state.preset = preset;
          renderErrors(errorsEl, []);
          mountPanel();
        } catch (e) {
          renderErrors(errorsEl, [e.message || String(e)]);
        }
      };
      reader.readAsText(file, 'utf-8');
    });
  }
}

function bindMistakesTabEvents() {
  const root = document.getElementById(PANEL_ID);
  if (!root) return;

  const list = root.querySelector('#pt-mistakes-list');
  const newBtn = root.querySelector('#pt-new-mistake');
  const importBtn = root.querySelector('#pt-import-json');
  const importInput = root.querySelector('#pt-import-json-input');
  const exportBtn = root.querySelector('#pt-export-json');
  const errorsEl = root.querySelector('#pt-mistakes-errors');

  if (newBtn) {
    newBtn.addEventListener('click', () => {
      if (state.addingNewMistake) {
        // If already adding, just scroll to the form
        const newMistakeForm = document.querySelector('.pt-mistake-card.new-mistake');
        if (newMistakeForm) {
          // Scroll only the mistakes list container, not the entire page
          const mistakesList = document.getElementById('pt-mistakes-list');
          if (mistakesList) {
            // Scroll to top to show the new form
            mistakesList.scrollTop = 0;
          }
        }
        return;
      }
      
      state.addingNewMistake = true;
      state.editingIndex = null;
      
      // Only render the new mistake form without full rerender
      const mistakesList = document.getElementById('pt-mistakes-list');
      if (mistakesList) {
        // Create the new mistake form element
        const newMistakeForm = document.createElement('div');
        newMistakeForm.className = 'pt-mistake-card editing new-mistake';
        newMistakeForm.innerHTML = `
          <div class="pt-mistake-header sev-warning">
            <input type="text" class="pt-mistake-name-input pt-input" value="" placeholder="输入错误项名称">
            <div class="custom-select-wrapper" style="width:120px;">
              <select class="pt-mistake-severity-input" style="display:none">
                <option value="inform">inform</option>
                <option value="warning" selected>warning</option>
                <option value="error">error</option>
              </select>
              <div class="custom-select">
                <div class="custom-select-trigger pt-mistake-severity-trigger"><span>warning</span><div class="arrow"></div></div>
                <div class="custom-options pt-mistake-severity-options">
                  <span class="custom-option" data-value="inform">inform（信息）</span>
                  <span class="custom-option selected" data-value="warning">warning（警告）</span>
                  <span class="custom-option" data-value="error">error（错误）</span>
                </div>
              </div>
            </div>
          </div>
          <div class="pt-mistake-body">
            <div class="pt-mistake-field">
              <label class="pt-mistake-field-label">类型</label>
              <input type="text" class="pt-mistake-type-input pt-input" value="" placeholder="输入错误类型">
            </div>
            <div class="pt-mistake-field">
              <label class="pt-mistake-field-label">描述</label>
              <textarea class="pt-mistake-desc-input pt-textarea" placeholder="输入错误描述"></textarea>
            </div>
            <div class="pt-mistake-field">
              <label class="pt-mistake-field-label">示例（JSON字符串数组）</label>
              <textarea class="pt-mistake-examples-input pt-textarea" placeholder='["示例1", "示例2"]'>[]</textarea>
            </div>
            <div class="pt-mistake-edit-errors pt-errors"></div>
          </div>
          <div class="pt-mistake-actions">
            <button class="pt-save-new-mistake">保存</button>
            <button class="pt-cancel-new-mistake">取消</button>
          </div>
        `;
        
        // Add the form to the top of the list
        mistakesList.insertBefore(newMistakeForm, mistakesList.firstChild);
        
        // Setup event handlers for the new form
        setupNewMistakeFormEvents(newMistakeForm);
        
        // Scroll to the new form at the top of the container
        setTimeout(() => {
          // Scroll to top to show the new form
          mistakesList.scrollTop = 0;
        }, 50);
      } else {
        // Fallback to full render if list not found
        mountPanel();
      }
    });
  }

  if (list) {
    list.addEventListener('click', (e) => {
      const card = e.target.closest('.pt-mistake-card');
      if (!card) return;
      
      // Handle new mistake card (doesn't have data-index)
      if (card.classList.contains('new-mistake')) {
        if (e.target.classList.contains('pt-save-new-mistake')) {
          saveNewMistake(card);
        } else if (e.target.classList.contains('pt-cancel-new-mistake')) {
          state.addingNewMistake = false;
          mountPanel();
        }
        return;
      }
      
      const index = Number(card.getAttribute('data-index'));
      const m = state.mistakes[index];
      if (!m) return;

      if (e.target.classList.contains('pt-edit-mistake')) {
        // Convert the card to edit mode without full rerender
        convertCardToEditMode(card, index);
      } else if (e.target.classList.contains('pt-delete-mistake')) {
        if (confirm('确定要删除该错误项？')) {
          state.mistakes = state.mistakes.filter((_, i) => i !== index);
          mountPanel();
        }
      } else if (e.target.classList.contains('pt-save-mistake')) {
        saveMistake(card, index);
      } else if (e.target.classList.contains('pt-cancel-mistake')) {
        state.editingIndex = null;
        mountPanel();
      }
    });
  }

  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', () => {
      const file = importInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = String(reader.result);
          const data = JSON.parse(text);
          const arr = Array.isArray(data) ? data : (Array.isArray(data.mistakes) ? data.mistakes : []);
          if (!Array.isArray(arr)) throw new Error('JSON 格式无效：需要数组或包含 mistakes 数组的对象');
          // validate each and collect
          const collected = [];
          const errors = [];
          for (const item of arr) {
            const m = {
              name: String(item.name ?? '').trim(),
              severity: String(item.severity ?? '').trim().toLowerCase(),
              type: String(item.type ?? '').trim(),
              description: String(item.description ?? '').trim(),
              examples: Array.isArray(item.examples) ? item.examples : []
            };
            const errs = validateMistake(m, collected);
            if (errs.length > 0) {
              errors.push(`#${m.name}: ${errs.join('; ')}`);
            } else {
              collected.push(m);
            }
          }
          if (errors.length > 0) {
            renderErrors(errorsEl, errors);
            return;
          }
          state.mistakes = collected;
          renderErrors(errorsEl, []);
          mountPanel();
        } catch (e) {
          renderErrors(errorsEl, [e.message || String(e)]);
        }
      };
      reader.readAsText(file, 'utf-8');
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const data = JSON.stringify(state.mistakes, null, 2);
      const blob = new Blob([data], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mistakes.json';
      a.click();
      URL.revokeObjectURL(url);
    });
  }
  // Add event handlers for custom select dropdowns in inline editing mode
  root.querySelectorAll('.pt-mistake-card.editing').forEach(card => {
    const severityNative = card.querySelector('.pt-mistake-severity-input');
    const severityTrigger = card.querySelector('.pt-mistake-severity-trigger');
    const severityOptions = card.querySelector('.pt-mistake-severity-options');
    
    if (severityTrigger && severityOptions) {
      severityTrigger.addEventListener('click', () => {
        const wrapper = severityTrigger.closest('.custom-select');
        wrapper?.classList.toggle('open');
      });
      
      severityOptions.addEventListener('click', (e) => {
        const opt = e.target.closest('.custom-option');
        if (!opt) return;
        const value = opt.getAttribute('data-value');
        
        // Update native select
        if (severityNative) severityNative.value = value;
        
        // Update trigger label
        if (severityTrigger) {
          const span = severityTrigger.querySelector('span');
          if (span) span.textContent = value;
        }
        
        // Update selected state
        severityOptions.querySelectorAll('.custom-option').forEach(opt => {
          opt.classList.toggle('selected', opt.getAttribute('data-value') === value);
        });
        
        // Update header color based on severity
        const header = card.querySelector('.pt-mistake-header');
        if (header) {
          // Remove all severity classes
          header.classList.remove('sev-error', 'sev-warning', 'sev-inform');
          // Add the appropriate class based on the selected value
          if (value === 'error') {
            header.classList.add('sev-error');
          } else if (value === 'warning') {
            header.classList.add('sev-warning');
          } else {
            header.classList.add('sev-inform');
          }
        }
        
        const wrapper = severityTrigger?.closest('.custom-select');
        wrapper?.classList.remove('open');
      });
    }
  });

  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    root.querySelectorAll('.custom-select.open').forEach(select => {
      if (!select.contains(e.target)) {
        select.classList.remove('open');
      }
    });
  });

}

function convertCardToEditMode(card, index) {
  const m = state.mistakes[index];
  if (!m) return;
  
  // Update state
  state.editingIndex = index;
  state.addingNewMistake = false;
  
  // Convert the card to edit mode
  card.classList.add('editing');
  
  // Get the header and replace content with edit inputs
  const header = card.querySelector('.pt-mistake-header');
  if (header) {
    // Remove all severity classes
    header.classList.remove('sev-error', 'sev-warning', 'sev-inform');
    // Add the appropriate class based on the selected value
    if (m.severity === 'error') {
      header.classList.add('sev-error');
    } else if (m.severity === 'warning') {
      header.classList.add('sev-warning');
    } else {
      header.classList.add('sev-inform');
    }
    
    header.innerHTML = `
      <input type="text" class="pt-mistake-name-input pt-input" value="${escapeHtml(m.name)}" placeholder="输入错误项名称">
      <div class="custom-select-wrapper" style="width:120px;">
        <select class="pt-mistake-severity-input" style="display:none">
          <option value="inform" ${m.severity === 'inform' ? 'selected' : ''}>inform</option>
          <option value="warning" ${m.severity === 'warning' ? 'selected' : ''}>warning</option>
          <option value="error" ${m.severity === 'error' ? 'selected' : ''}>error</option>
        </select>
        <div class="custom-select">
          <div class="custom-select-trigger pt-mistake-severity-trigger"><span>${escapeHtml(m.severity)}</span><div class="arrow"></div></div>
          <div class="custom-options pt-mistake-severity-options">
            <span class="custom-option ${m.severity === 'inform' ? 'selected':''}" data-value="inform">inform（信息）</span>
            <span class="custom-option ${m.severity === 'warning' ? 'selected':''}" data-value="warning">warning（警告）</span>
            <span class="custom-option ${m.severity === 'error' ? 'selected':''}" data-value="error">error（错误）</span>
          </div>
        </div>
      </div>
    `;
  }
  
  // Get the body and replace content with edit inputs
  const body = card.querySelector('.pt-mistake-body');
  if (body) {
    body.innerHTML = `
      <div class="pt-mistake-field">
        <label class="pt-mistake-field-label">类型</label>
        <input type="text" class="pt-mistake-type-input pt-input" value="${escapeHtml(m.type)}" placeholder="输入错误类型">
      </div>
      <div class="pt-mistake-field">
        <label class="pt-mistake-field-label">描述</label>
        <textarea class="pt-mistake-desc-input pt-textarea" placeholder="输入错误描述">${escapeHtml(m.description)}</textarea>
      </div>
      <div class="pt-mistake-field">
        <label class="pt-mistake-field-label">示例（JSON字符串数组）</label>
        <textarea class="pt-mistake-examples-input pt-textarea" placeholder='["示例1", "示例2"]'>${escapeHtml(JSON.stringify(m.examples || []))}</textarea>
      </div>
      <div class="pt-mistake-edit-errors pt-errors"></div>
    `;
  }
  
  // Get the actions and replace with save/cancel buttons
  const actions = card.querySelector('.pt-mistake-actions');
  if (actions) {
    actions.innerHTML = `
      <button class="pt-save-mistake">保存</button>
      <button class="pt-cancel-mistake">取消</button>
    `;
  }
  
  // Setup event handlers for the edit form
  setupEditFormEvents(card, index);
}

function setupEditFormEvents(card, index) {
  const saveBtn = card.querySelector('.pt-save-mistake');
  const cancelBtn = card.querySelector('.pt-cancel-mistake');
  const severityNative = card.querySelector('.pt-mistake-severity-input');
  const severityTrigger = card.querySelector('.pt-mistake-severity-trigger');
  const severityOptions = card.querySelector('.pt-mistake-severity-options');
  
  // Setup custom select
  if (severityTrigger && severityOptions) {
    severityTrigger.addEventListener('click', () => {
      const wrapper = severityTrigger.closest('.custom-select');
      wrapper?.classList.toggle('open');
    });
    
    severityOptions.addEventListener('click', (e) => {
      const opt = e.target.closest('.custom-option');
      if (!opt) return;
      const value = opt.getAttribute('data-value');
      
      // Update native select
      if (severityNative) severityNative.value = value;
      
      // Update trigger label
      if (severityTrigger) {
        const span = severityTrigger.querySelector('span');
        if (span) span.textContent = value;
      }
      
      // Update selected state
      severityOptions.querySelectorAll('.custom-option').forEach(opt => {
        opt.classList.toggle('selected', opt.getAttribute('data-value') === value);
      });
      
      // Update header color based on severity
      const header = card.querySelector('.pt-mistake-header');
      if (header) {
        // Remove all severity classes
        header.classList.remove('sev-error', 'sev-warning', 'sev-inform');
        // Add the appropriate class based on the selected value
        if (value === 'error') {
          header.classList.add('sev-error');
        } else if (value === 'warning') {
          header.classList.add('sev-warning');
        } else {
          header.classList.add('sev-inform');
        }
      }
      
      const wrapper = severityTrigger?.closest('.custom-select');
      wrapper?.classList.remove('open');
    });
  }
  
  // Setup save button
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      saveMistake(card, index);
    });
  }
  
  // Setup cancel button
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      // Just revert to view mode without full rerender
      state.editingIndex = null;
      mountPanel(); // We do need a full render here to revert properly
    });
  }
}

function setupNewMistakeFormEvents(form) {
  const saveBtn = form.querySelector('.pt-save-new-mistake');
  const cancelBtn = form.querySelector('.pt-cancel-new-mistake');
  const severityNative = form.querySelector('.pt-mistake-severity-input');
  const severityTrigger = form.querySelector('.pt-mistake-severity-trigger');
  const severityOptions = form.querySelector('.pt-mistake-severity-options');
  
  // Setup custom select
  if (severityTrigger && severityOptions) {
    severityTrigger.addEventListener('click', () => {
      const wrapper = severityTrigger.closest('.custom-select');
      wrapper?.classList.toggle('open');
    });
    
    severityOptions.addEventListener('click', (e) => {
      const opt = e.target.closest('.custom-option');
      if (!opt) return;
      const value = opt.getAttribute('data-value');
      
      // Update native select
      if (severityNative) severityNative.value = value;
      
      // Update trigger label
      if (severityTrigger) {
        const span = severityTrigger.querySelector('span');
        if (span) span.textContent = value;
      }
      
      // Update selected state
      severityOptions.querySelectorAll('.custom-option').forEach(opt => {
        opt.classList.toggle('selected', opt.getAttribute('data-value') === value);
      });
      
      // Update header color based on severity
      const header = form.querySelector('.pt-mistake-header');
      if (header) {
        // Remove all severity classes
        header.classList.remove('sev-error', 'sev-warning', 'sev-inform');
        // Add the appropriate class based on the selected value
        if (value === 'error') {
          header.classList.add('sev-error');
        } else if (value === 'warning') {
          header.classList.add('sev-warning');
        } else {
          header.classList.add('sev-inform');
        }
      }
      
      const wrapper = severityTrigger?.closest('.custom-select');
      wrapper?.classList.remove('open');
    });
  }
  
  // Setup save button
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      saveNewMistake(form);
    });
  }
  
  // Setup cancel button
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      state.addingNewMistake = false;
      form.remove();
    });
  }
}

function saveMistake(card, index) {
  const nameEl = card.querySelector('.pt-mistake-name-input');
  const sevEl = card.querySelector('.pt-mistake-severity-input');
  const typeEl = card.querySelector('.pt-mistake-type-input');
  const descEl = card.querySelector('.pt-mistake-desc-input');
  const examplesEl = card.querySelector('.pt-mistake-examples-input');
  const errEl = card.querySelector('.pt-mistake-edit-errors');

  const newMistake = {
    name: nameEl.value.trim(),
    severity: sevEl.value,
    type: typeEl.value.trim(),
    description: descEl.value.trim(),
    examples: []
  };

  try {
    const arr = JSON.parse(examplesEl.value || '[]');
    if (!Array.isArray(arr) || !arr.every(x => typeof x === 'string')) {
      throw new Error('示例必须是字符串数组（JSON）');
    }
    newMistake.examples = arr;
  } catch (e) {
    renderErrors(errEl, ['示例必须是字符串数组（JSON）']);
    return;
  }

  const errs = validateMistake(newMistake, state.mistakes.filter((_, i) => i !== index));
  if (errs.length > 0) {
    renderErrors(errEl, errs);
    return;
  }

  // Update the mistake
  state.mistakes[index] = newMistake;
  state.editingIndex = null;
  mountPanel();
  
  // Scroll to top to show the updated card in its new position - only scroll the container, not the page
  setTimeout(() => {
    const mistakesList = document.getElementById('pt-mistakes-list');
    if (mistakesList) {
      // Save the current scroll position of the parent containers
      const parentScrollPositions = [];
      let parent = mistakesList.parentElement;
      while (parent) {
        parentScrollPositions.push({
          element: parent,
          scrollTop: parent.scrollTop
        });
        parent = parent.parentElement;
      }
      
      // Scroll only the mistakes list to the top
      mistakesList.scrollTop = 0;
      
      // Restore parent scroll positions to prevent page scrolling
      parentScrollPositions.forEach(pos => {
        if (pos.element) {
          pos.element.scrollTop = pos.scrollTop;
        }
      });
    }
  }, 100);
}

function saveNewMistake(card) {
  const nameEl = card.querySelector('.pt-mistake-name-input');
  const sevEl = card.querySelector('.pt-mistake-severity-input');
  const typeEl = card.querySelector('.pt-mistake-type-input');
  const descEl = card.querySelector('.pt-mistake-desc-input');
  const examplesEl = card.querySelector('.pt-mistake-examples-input');
  const errEl = card.querySelector('.pt-mistake-edit-errors');

  const newMistake = {
    name: nameEl.value.trim(),
    severity: sevEl.value,
    type: typeEl.value.trim(),
    description: descEl.value.trim(),
    examples: []
  };

  try {
    const arr = JSON.parse(examplesEl.value || '[]');
    if (!Array.isArray(arr) || !arr.every(x => typeof x === 'string')) {
      throw new Error('示例必须是字符串数组（JSON）');
    }
    newMistake.examples = arr;
  } catch (e) {
    renderErrors(errEl, ['示例必须是字符串数组（JSON）']);
    return;
  }

  const errs = validateMistake(newMistake, state.mistakes);
  if (errs.length > 0) {
    renderErrors(errEl, errs);
    return;
  }

  // Add the new mistake
  state.mistakes.push(newMistake);
  state.addingNewMistake = false;
  
  // Full rerender after saving
  mountPanel();
  
  // Scroll to top to show the new card - only scroll the container, not the page
  setTimeout(() => {
    const mistakesList = document.getElementById('pt-mistakes-list');
    if (mistakesList) {
      // Save the current scroll position of the parent containers
      const parentScrollPositions = [];
      let parent = mistakesList.parentElement;
      while (parent) {
        parentScrollPositions.push({
          element: parent,
          scrollTop: parent.scrollTop
        });
        parent = parent.parentElement;
      }
      
      // Scroll only the mistakes list to the top
      mistakesList.scrollTop = 0;
      
      // Restore parent scroll positions to prevent page scrolling
      parentScrollPositions.forEach(pos => {
        if (pos.element) {
          pos.element.scrollTop = pos.scrollTop;
        }
      });
    }
  }, 100);
}

// Validation
function validateBasic(preset) {
  const errs = [];
  if (!preset) {
    errs.push('预设尚未加载');
    return errs;
  }
  // Concurrency
  const c = Number(preset.basic?.concurrencyLimit);
  if (!Number.isFinite(c) || c < 1) errs.push('并发上限必须是 >= 1 的整数');

  // End condition
  const ec = preset.basic?.endCondition || {};
  const type = ec.type;
  if (!['rounds','assistantRegex','userRegex'].includes(type)) {
    errs.push('结束条件类型必须为：rounds、assistantRegex、userRegex 之一');
  } else if (type === 'rounds') {
    const r = Number(ec.rounds);
    if (!Number.isFinite(r) || r < 1) errs.push('轮次必须是 >= 1 的整数');
  } else if (type === 'assistantRegex' || type === 'userRegex') {
    const key = type === 'assistantRegex' ? 'assistantRegex' : 'userRegex';
    const pattern = ec[key];
    if (!pattern || typeof pattern !== 'string') {
      errs.push(`${key} 必须是非空字符串`);
    } else {
      try {
        // best effort regex validation
        // eslint-disable-next-line no-new
        new RegExp(pattern);
      } catch (e) {
        errs.push(`${key} 不是有效的正则表达式: ${e.message}`);
      }
    }
  }

  // Evaluation numbers
  const topP = Number(preset.evaluation?.top_p);
  const temp = Number(preset.evaluation?.temperature);
  if (!Number.isFinite(topP) || topP < 0 || topP > 1) errs.push('top-p 必须在 0 到 1 之间');
  if (!Number.isFinite(temp) || temp < 0 || temp > 2) errs.push('温度必须在 0 到 2 之间');

  // Model
  const model = preset.evaluation?.model;
  if (!model || typeof model !== 'string' || model.trim().length === 0) {
    errs.push('模型名称为必填');
  }

  // Dialogue numbers
  const dialogueTopP = Number(preset.dialogue?.top_p);
  const dialogueTemp = Number(preset.dialogue?.temperature);
  if (!Number.isFinite(dialogueTopP) || dialogueTopP < 0 || dialogueTopP > 1) errs.push('对话 top-p 必须在 0 到 1 之间');
  if (!Number.isFinite(dialogueTemp) || dialogueTemp < 0 || dialogueTemp > 2) errs.push('对话温度必须在 0 到 2 之间');

  // Dialogue Model
  const dialogueModel = preset.dialogue?.model;
  if (!dialogueModel || typeof dialogueModel !== 'string' || dialogueModel.trim().length === 0) {
    errs.push('对话模型名称为必填');
  }

  return errs;
}

function validateMistake(m, others) {
  const errs = [];
  if (!m.name || !m.name.trim()) errs.push('名称为必填');
  if (!['inform','warning','error'].includes(m.severity)) errs.push('严重性必须为 inform|warning|error 之一');
  if (!m.type || !m.type.trim()) errs.push('类型为必填');
  if (!m.description || !m.description.trim()) errs.push('描述为必填');
  if (!Array.isArray(m.examples)) errs.push('示例必须为数组');
  const dup = others.find(x => x.name === m.name);
  if (dup) errs.push('名称不可重复');
  return errs;
}

// JSON loader for default mistakes
async function fetchMistakesJSON(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to fetch mistakes JSON: ${res.status} ${res.statusText}`);
  const data = await res.json();
  const arr = Array.isArray(data) ? data : (Array.isArray(data.mistakes) ? data.mistakes : []);
  if (!Array.isArray(arr)) throw new Error('错误库 JSON 格式无效：需要数组或包含 mistakes 数组的对象');
  const collected = [];
  const errors = [];
  for (const item of arr) {
    const m = {
      name: String(item.name ?? '').trim(),
      severity: String(item.severity ?? '').trim().toLowerCase(),
      type: String(item.type ?? '').trim(),
      description: String(item.description ?? '').trim(),
      examples: Array.isArray(item.examples) ? item.examples : []
    };
    const errs = validateMistake(m, collected);
    if (errs.length > 0) {
      errors.push(`#${m.name}: ${errs.join('; ')}`);
    } else {
      collected.push(m);
    }
  }
  if (errors.length > 0) {
    throw new Error('错误库 JSON 校验失败: ' + errors.join(' | '));
  }
  return collected;
}

// Helpers
function severityClass(s) {
  if (s === 'error') return 'sev-error';
  if (s === 'warning') return 'sev-warning';
  return 'sev-inform';
}

function escapeHtml(str) {
  const s = String(str ?? '');
  // Use a mapping with pre-escaped values to avoid quote parsing issues
  const map = {};
  map[String.fromCharCode(38)] = '&';   // &
  map[String.fromCharCode(60)] = '<';    // <
  map[String.fromCharCode(62)] = '>';    // >
  map[String.fromCharCode(34)] = '"';  // "
  map[String.fromCharCode(39)] = '\'';   // '
  return s.replace(/[&<>\"']/g, (ch) => map[ch] || ch);
}
function escapeAttr(str) {
  const s = String(str ?? '');
  return s.replace(/"/g, '"');
}
function renderErrors(container, errors) {
  if (!container) return;
  container.innerHTML = errors.length > 0
    ? errors.map(e => `<div class="pt-error">${escapeHtml(e)}</div>`).join('')
    : '';
}

function option(value, label, selected) {
  return `<option value="${escapeAttr(value)}" ${selected ? 'selected' : ''}>${escapeHtml(label)}</option>`;
}

async function fetchPreset(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to fetch preset: ${res.status} ${res.statusText}`);
  const data = await res.json();
  // Light validation for required keys to avoid hidden defaults
  const required = ['basic','evaluation','dialogue'];
  for (const k of required) {
    if (typeof data[k] === 'undefined') {
      throw new Error(`Preset missing required key: ${k}`);
    }
  }
  return data;
}


function showTempPreset(tempPreset, sourceTaskId = null) {
  // Activate a temporary preview preset (clone it to avoid accidental mutation).
  state.tempPreset = tempPreset ? JSON.parse(JSON.stringify(tempPreset)) : {};
  state.tempActive = true;
  state.previousActiveTab = state.activeTab;
  state.activeTab = 'basic';
  state.tempSourceTaskId = sourceTaskId;
  mountPanel();

  // Add visual indicator to panel (mountPanel will also add class, but ensure it's present)
  const root = document.getElementById(PANEL_ID);
  if (root) root.classList.add('pt-temp-active');

  // Highlight the source task bubble (if provided)
  if (sourceTaskId) {
    const el = document.querySelector(`.task-bubble[data-task-id="${sourceTaskId}"]`);
    if (el) el.classList.add('task-temp-source');
  }

  // Install a global click handler (capture phase) to handle settle/revert logic.
  const handler = (e) => {
    // If click is inside the config panel, ignore it.
    if (e.target.closest(`#${PANEL_ID}`)) return;

    // If click is on the FAB (plus), settle the preview into the real preset,
    // then let the FAB handler proceed to create tasks.
    if (e.target.closest('#task-fab')) {
      // settle then allow normal FAB click to continue
      settleTempPreset();
      return;
    }

    // If click is on the two other action buttons, ignore (keep preview open)
    if (e.target.closest('#task-delete-all') || e.target.closest('#task-export-csv')) {
      return;
    }

    // Any other click outside: revert the preview
    clearTempPreset();
  };

  document.addEventListener('click', handler, true);
  state._tempGlobalClickHandler = handler;
}

function settleTempPreset() {
  if (!state.tempActive || !state.tempPreset) return;

  // Ensure state.preset exists and copy over relevant sections.
  state.preset = state.preset || {};

  if (state.tempPreset.basic) state.preset.basic = JSON.parse(JSON.stringify(state.tempPreset.basic));
  if (state.tempPreset.evaluation) state.preset.evaluation = JSON.parse(JSON.stringify(state.tempPreset.evaluation));
  if (state.tempPreset.dialogue) state.preset.dialogue = JSON.parse(JSON.stringify(state.tempPreset.dialogue));

  // If temp preset provided a chatSystemPrompt, update the visible chatSystemPrompt state as well.
  if (typeof state.tempPreset.chatSystemPrompt !== 'undefined') {
    state.chatSystemPrompt = state.tempPreset.chatSystemPrompt;
  }

  // Update TaskUIManager's chatSystemPrompt for subsequent tasks if present
  if (window.taskUIManager) {
    window.taskUIManager.chatSystemPrompt = state.chatSystemPrompt || window.taskUIManager.chatSystemPrompt;
  }

  _clearTempInternal();
  mountPanel();
}

function clearTempPreset() {
  if (!state.tempActive) return;
  _clearTempInternal();
  // Restore previous tab (if any)
  state.activeTab = state.previousActiveTab || 'basic';
  state.previousActiveTab = null;
  mountPanel();
}

function _clearTempInternal() {
  // Remove visual indicator and cleanup handler
  state.tempActive = false;

  // Remove highlight from source task if any
  if (state.tempSourceTaskId) {
    const srcEl = document.querySelector(`.task-bubble[data-task-id="${state.tempSourceTaskId}"]`);
    if (srcEl) srcEl.classList.remove('task-temp-source');
    state.tempSourceTaskId = null;
  }

  state.tempPreset = null;
  const root = document.getElementById(PANEL_ID);
  if (root) root.classList.remove('pt-temp-active');

  if (state._tempGlobalClickHandler) {
    document.removeEventListener('click', state._tempGlobalClickHandler, true);
    state._tempGlobalClickHandler = null;
  }
}

// Original bindChatSystemPrompt function (preserved)
function bindChatSystemPrompt() {
  // Create two-way binding between main chat system prompt and parallel test tab
  // Get the chat instance from the global scope
  const chatInstance = window.chatInstance;
  
  // Function to update from main chat to parallel test tab
  const updateFromMainChat = () => {
    // When a temporary preview is active, avoid overwriting the panel's displayed system prompt.
    if (state.tempActive) return;
    if (chatInstance && chatInstance.chatService) {
      state.chatSystemPrompt = chatInstance.chatService.getSystemPrompt();
      const targetEl = document.querySelector('#pt-chat-system-prompt');
      if (targetEl) targetEl.value = state.chatSystemPrompt;
    }
  };
  
  // Function to update from parallel test tab to main chat
  const updateFromParallelTest = () => {
    const targetEl = document.querySelector('#pt-chat-system-prompt');
    if (targetEl && chatInstance && chatInstance.chatService) {
      state.chatSystemPrompt = String(targetEl.value);
      chatInstance.chatService.setSystemPrompt(state.chatSystemPrompt);
      
      // Also update the system prompt message in the chat UI if it exists
      chatInstance.renderMessages(true);
    }
  };
  
  // Initialize value from main chat
  updateFromMainChat();
  
  // Set up a MutationObserver to detect changes in the system prompt message
  if (chatInstance) {
    // Observe changes to the chat container to detect when system prompt is updated
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          // Check if system prompt message was updated
          const systemPromptMessage = document.querySelector('.system-prompt-message');
          if (systemPromptMessage) {
            updateFromMainChat();
          }
        }
      }
    });
    
    // Start observing the chat container
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer) {
      observer.observe(chatContainer, { childList: true, subtree: true });
    }
  }
  
  // Set up listener for parallel test tab (using event delegation since it's dynamically created)
  document.addEventListener('input', (e) => {
    if (e.target.id === 'pt-chat-system-prompt') {
      updateFromParallelTest();
    }
  });
}

// Function to bind scene info synchronization between scene config and parallel test tab
function bindSceneInfo() {
  // Function to update from scene config to parallel test tab
  const updateFromSceneConfig = () => {
    // When a temporary preview is active, avoid overwriting the panel's displayed scene info.
    if (state.tempActive) return;
    
    // Get the scene info from the scene config textarea
    const sceneInfoEl = document.querySelector('#generated-scene-info');
    if (sceneInfoEl) {
      state.sceneInfo = sceneInfoEl.value;
      const targetEl = document.querySelector('#pt-scene-info');
      if (targetEl) {
        targetEl.value = state.sceneInfo;
        // Also update the preset's sceneInfo if it exists
        if (state.preset) {
          state.preset.sceneInfo = state.sceneInfo;
        }
      }
    }
  };
  
  // Initialize value from scene config
  updateFromSceneConfig();
  
  // Set up a MutationObserver to detect changes in the scene info textarea
  const sceneInfoEl = document.querySelector('#generated-scene-info');
  if (sceneInfoEl) {
    // Observe changes to the scene info textarea
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' || mutation.type === 'characterData' || mutation.type === 'attributes') {
          updateFromSceneConfig();
        }
      }
    });
    
    // Start observing the scene info textarea for changes
    observer.observe(sceneInfoEl, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['value']
    });
    
    // Also listen for input events on the scene info textarea
    sceneInfoEl.addEventListener('input', updateFromSceneConfig);
    
    // Listen for custom events when scene info is generated
    document.addEventListener('sceneInfoGenerated', updateFromSceneConfig);
    
    // Also listen for property changes to the value attribute
    sceneInfoEl.addEventListener('change', updateFromSceneConfig);
    
    // Set up a more robust observer that checks for value changes
    const valueObserver = new MutationObserver((mutations) => {
      updateFromSceneConfig();
    });
    
    valueObserver.observe(sceneInfoEl, {
      attributes: true,
      attributeFilter: ['value']
    });
  }
}

async function bootstrap() {
  try {
    const [preset, mistakes] = await Promise.all([
      fetchPreset(DEFAULT_PRESET_PATH),
      fetchMistakesJSON(DEFAULT_MISTAKES_JSON_PATH)
    ]);
    state.preset = preset;
    state.mistakes = mistakes;
    state.blockingError = null;
  } catch (e) {
    state.blockingError = e.message || String(e);
  }
  mountPanel();
  bindChatSystemPrompt();
  bindSceneInfo();
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  bootstrap();

  // Tab switching integration: on navigating to parallel-tab, ensure layout exists
  const parallelTabBtn = document.querySelector('.tab-link[data-tab="parallel-tab"]');
  if (parallelTabBtn) {
    parallelTabBtn.addEventListener('click', () => {
      mountPanel();
    });
  }

  // Ensure any stray custom-selects are closed when DOM ready
  document.querySelectorAll('.custom-select.open').forEach(el => el.classList.remove('open'));
  
  // Make ConfigPanel globally accessible
  window.ConfigPanel = {
    state,
    bootstrap,
    mountPanel,
    // APIs for temporary preview behavior (used by TaskUIManager on shift-click)
    showTempPreset,
    settleTempPreset,
    clearTempPreset
  };
});