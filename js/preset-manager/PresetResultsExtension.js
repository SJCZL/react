import { apiManager } from '../api-manager.js';
import {
  analyzeResultsByModel,
  renderModelCompare,
  renderSeverityStacked,
  renderErrorPie,
  renderTopErrorsTable
} from '../parallel-test/analyzer.js';

/**
 * 精简版结果展示：
 * - 不再渲染底部“大面板”和图表
 * - 点击“显示测试结果”按钮时，直接从数据库拉取最新结果并在一个简洁卡片内显示
 */
(function attachPresetResultsExtension() {
  const rootId = 'preset-details-content';
  const panelId = 'preset-test-results';

  const waitForElement = (selector, { timeout = 10000 } = {}) =>
    new Promise((resolve, reject) => {
      const existing = document.querySelector(selector);
      if (existing) return resolve(existing);
      const obs = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          obs.disconnect();
          resolve(el);
        }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      if (timeout) {
        setTimeout(() => {
          obs.disconnect();
          reject(new Error(`Timeout waiting for ${selector}`));
        }, timeout);
      }
    });

  const ensureSection = () => {
    const container = document.getElementById(rootId);
    if (!container) return null;
    let section = container.querySelector('#' + panelId);
    if (section) return section;
    section = document.createElement('section');
    section.id = panelId;
    section.className = 'card';
    section.style.marginTop = '12px';
    section.innerHTML = `
      <header class="card-header" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <h3 style="margin:0;">在线测试结果</h3>
        <div class="actions" style="display:flex;gap:8px;">
          <button id="btn-refresh-results" class="preset-btn">刷新</button>
        </div>
      </header>
      <div id="simple-result-body" style="padding:8px 0;">
        <div id="simple-result-summary">无数据</div>
        <table id="simple-result-table" style="width:100%;border-collapse:collapse;margin-top:8px;display:none;">
          <thead><tr><th style="text-align:left;padding:4px;">模型</th><th style="text-align:right;padding:4px;">通过</th><th style="text-align:right;padding:4px;">失败</th><th style="text-align:right;padding:4px;">通过率</th></tr></thead>
          <tbody></tbody>
        </table>
        <div id="simple-charts" style="margin-top:12px; display:none;">
          <div id="simple-chart-model" style="width:100%;height:220px;"></div>
          <div id="simple-chart-severity" style="width:100%;height:220px;margin-top:8px;"></div>
          <div id="simple-chart-pie" style="width:100%;height:220px;margin-top:8px;"></div>
          <div style="margin-top:8px;">
            <label style="font-weight:bold;">Top错误（按模型）：</label>
            <select id="simple-top-errors-model" style="padding:4px 8px;margin-left:8px;"></select>
            <div id="simple-top-errors-table" style="margin-top:6px;"></div>
          </div>
        </div>
      </div>
    `;
    container.appendChild(section);
    return section;
  };

  const formatDateTime = (value) => {
    if (!value) return '-';
    try { return new Date(value).toLocaleString(); } catch { return value; }
  };

  const renderAggregate = (agg) => {
    const summaryEl = document.getElementById('simple-result-summary');
    const table = document.getElementById('simple-result-table');
    const tbody = table?.querySelector('tbody');
    const chartsWrap = document.getElementById('simple-charts');
    const topSelect = document.getElementById('simple-top-errors-model');
    if (!summaryEl || !table || !tbody) return;

    const total = agg?.meta?.total_samples ?? 0;
    const models = agg?.meta?.models_tested ?? [];
    const created = formatDateTime(agg?.meta?.created_at);
    summaryEl.textContent = `批次时间：${created} ｜ 总用例：${total} ｜ 模型数：${models.length}`;

    tbody.innerHTML = '';
    const stats = agg?.statistics || {};
    Object.keys(stats).forEach((m) => {
      const s = stats[m] || {};
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="padding:4px;">${m}</td>
        <td style="padding:4px;text-align:right;">${s.pass ?? 0}</td>
        <td style="padding:4px;text-align:right;">${s.fail ?? 0}</td>
        <td style="padding:4px;text-align:right;">${s.passRate ?? 0}%</td>
      `;
      tbody.appendChild(tr);
    });
    table.style.display = Object.keys(stats).length ? '' : 'none';
    if (chartsWrap) {
      chartsWrap.style.display = Object.keys(stats).length ? '' : 'none';
      renderModelCompare('simple-chart-model', stats);
      renderSeverityStacked('simple-chart-severity', stats);
      renderErrorPie('simple-chart-pie', stats);
      // Top errors select
      if (topSelect) {
        topSelect.innerHTML = '';
        const optAll = document.createElement('option');
        optAll.value = 'ALL';
        optAll.textContent = '全部模型';
        topSelect.appendChild(optAll);
        Object.keys(stats).forEach((m) => {
          const opt = document.createElement('option');
          opt.value = m;
          opt.textContent = m;
          topSelect.appendChild(opt);
        });
        const renderTop = () => renderTopErrorsTable('simple-top-errors-table', stats, { model: topSelect.value || 'ALL', limit: 10 });
        topSelect.onchange = renderTop;
        renderTop();
      }
    }
  };

  const fetchLatestRunAggregate = async (presetId) => {
    // 优先新版 test-runs
    try {
      const res = await apiManager.listTestRuns({ preset_id: presetId, limit: 1, page: 1 });
      const runs = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      if (runs.length > 0) {
        const runId = runs[0].id;
        const detail = await apiManager.getTestRunSummary(runId);
        const agg = detail?.data?.aggregate;
        if (agg) return agg;
      }
    } catch (e) {
      console.warn('[PresetResultsExtension] 获取 test-runs 失败', e);
    }

    // 退回 experiments
    try {
      const res = await apiManager.listExperiments({ preset_id: presetId, limit: 1, offset: 0 });
      const items = res?.items || [];
      if (items.length > 0) {
        const item = items[0];
        return {
          meta: {
            preset_id: item.preset_id,
            models_tested: Object.keys(item.statistics || {}),
            total_samples: Object.values(item.statistics || {}).reduce((s, v) => s + (v?.total || 0), 0),
            created_at: item.created_at
          },
          statistics: item.statistics || {}
        };
      }
    } catch (e2) {
      console.warn('[PresetResultsExtension] 获取 experiments 失败', e2);
    }
    return null;
  };

  const loadAndRenderLatest = async () => {
    const presetId = Number(window.presetUIManager?.currentPreset?.id || 0);
    const summaryEl = document.getElementById('simple-result-summary');
    if (!presetId) {
      if (summaryEl) summaryEl.textContent = '请先保存预设或选择一个已有的预设';
      return;
    }
    if (summaryEl) summaryEl.textContent = '加载中...';
    try {
      const agg = await fetchLatestRunAggregate(presetId);
      if (agg) {
        renderAggregate(agg);
        return;
      }
      // DB没有结果时，回落到最近一次前端缓存结果
      const local = Array.isArray(window.__lastParallelResults) ? window.__lastParallelResults : null;
      if (local && local.length) {
        const derived = analyzeResultsByModel(local, presetId);
        renderAggregate(derived);
        summaryEl.textContent += '（显示本地最近一次测试结果）';
        return;
      }
      summaryEl.textContent = '未找到数据库中的测试结果，请先运行并行测试';
      const table = document.getElementById('simple-result-table');
      if (table) table.style.display = 'none';
    } catch (err) {
      console.warn('[PresetResultsExtension] 拉取测试结果失败', err);
      const msg = err?.message || '服务端返回错误';
      const local = Array.isArray(window.__lastParallelResults) ? window.__lastParallelResults : null;
      if (local && local.length) {
        const derived = analyzeResultsByModel(local, presetId);
        renderAggregate(derived);
        summaryEl.textContent = `服务端错误：${msg}，已显示本地最近一次测试结果`;
      } else if (summaryEl) {
        summaryEl.textContent = `服务端错误：${msg}`;
      }
    }
  };

  const bindButtons = () => {
    const btnRefresh = document.getElementById('btn-refresh-results');
    btnRefresh?.addEventListener('click', () => loadAndRenderLatest());
  };

  document.addEventListener('presetResultsShowClicked', () => {
    ensureSection();
    bindButtons();
    loadAndRenderLatest();
    const section = document.getElementById(panelId);
    if (section) {
      section.style.display = '';
      try { section.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
    }
  });

  const boot = () => {
    ensureSection();
    bindButtons();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => waitForElement('#' + rootId, { timeout: 15000 }).then(boot).catch(boot));
  } else {
    waitForElement('#' + rootId, { timeout: 15000 }).then(boot).catch(boot);
  }
})();
