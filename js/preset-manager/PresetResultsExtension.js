import { apiManager } from '../api-manager.js';
import {
  analyzeResultsByModel,
  renderModelCompare,
  renderSeverityStacked,
  renderErrorPie,
  renderTopErrorsTable
} from '../parallel-test/analyzer.js';

/**
 * 简洁版测试结果展示，含小型可视化与 Markdown 报告导出。
 * - 数据来源：优先 test-runs 最新汇总，其次 experiments 最新记录；失败再回退本地 __lastParallelResults。
 * - 展示：摘要、表格（含平均耗时可选）、三张小图、Top 错误表。
 * - 报告导出：生成 Markdown 文件，含模型通过/失败/通过率与错误分布。
 */
(function attachPresetResultsExtension() {
  const rootId = 'preset-details-content';
  const panelId = 'preset-test-results';
  let lastAgg = null;

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
          <button id="btn-export-report" class="preset-btn" disabled>导出报告</button>
        </div>
      </header>
      <div id="simple-result-body" style="padding:8px 0;">
        <div id="simple-result-summary">无数据</div>
        <table id="simple-result-table" style="width:100%;border-collapse:collapse;margin-top:8px;display:none;">
          <thead><tr>
            <th style="text-align:left;padding:4px;">模型</th>
            <th style="text-align:right;padding:4px;">通过</th>
            <th style="text-align:right;padding:4px;">失败</th>
            <th style="text-align:right;padding:4px;">通过率</th>
          </tr></thead>
          <tbody></tbody>
        </table>
        <div id="simple-charts" style="margin-top:12px; display:none;">
          <div id="simple-chart-model" style="width:100%;height:220px;"></div>
          <div id="simple-chart-severity" style="width:100%;height:220px;margin-top:8px;"></div>
          <div id="simple-chart-latency" style="width:100%;height:220px;margin-top:8px;"></div>
          <div id="simple-chart-metrics" style="width:100%;height:240px;margin-top:8px;"></div>
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
  const formatInt = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : null;
  };
  const formatCost = (value, digits = 4) => {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(digits) : null;
  };
  const formatDuration = (ms) => {
    const n = Number(ms);
    if (!Number.isFinite(n)) return null;
    if (n >= 1000) {
      const seconds = n / 1000;
      const precision = seconds >= 10 ? 0 : seconds >= 3 ? 1 : 2;
      return `${seconds.toFixed(precision)}s`;
    }
    return `${Math.round(n)}ms`;
  };

  const renderAggregate = (agg) => {
    lastAgg = agg;
    const summaryEl = document.getElementById('simple-result-summary');
    const table = document.getElementById('simple-result-table');
    const tbody = table?.querySelector('tbody');
    const chartsWrap = document.getElementById('simple-charts');
    const topSelect = document.getElementById('simple-top-errors-model');
    const latencyChartEl = document.getElementById('simple-chart-latency');
    const metricsChartEl = document.getElementById('simple-chart-metrics');
    if (!summaryEl || !table || !tbody) return;

    const total = agg?.meta?.total_samples ?? 0;
    const models = agg?.meta?.models_tested ?? [];
    const created = formatDateTime(agg?.meta?.created_at);
    const stats = agg?.statistics || {};
    const hasLatency = Object.keys(stats).some((m) => stats[m]?.avg_latency_ms !== undefined) || agg?.meta?.avg_latency_ms !== undefined;
    const hasAssistantLatency = Object.keys(stats).some((m) => stats[m]?.assistant_avg_turn_latency_ms !== undefined) || agg?.meta?.avg_assistant_turn_latency_ms !== undefined;
    const hasTokens = Object.keys(stats).some((m) => stats[m]?.avg_tokens !== undefined || stats[m]?.total_tokens !== undefined) ||
      agg?.meta?.avg_tokens !== undefined || agg?.meta?.total_tokens !== undefined;
    const hasCost = Object.keys(stats).some((m) => stats[m]?.avg_cost !== undefined || stats[m]?.total_cost !== undefined) ||
      agg?.meta?.avg_cost !== undefined || agg?.meta?.total_cost !== undefined;
    const latencySummary = (() => {
      if (!hasLatency) return '';
      const metaAvg = Number(agg?.meta?.avg_latency_ms);
      if (Number.isFinite(metaAvg)) {
        return ` ｜ 平均耗时：${formatDuration(metaAvg)}`;
      }
      let sum = 0;
      let count = 0;
      Object.keys(stats).forEach((m) => {
        const avg = Number(stats[m]?.avg_latency_ms);
        if (!Number.isFinite(avg)) return;
        const weight = Number(stats[m]?.latency_samples ?? stats[m]?.total ?? 0);
        if (Number.isFinite(weight) && weight > 0) {
          sum += avg * weight;
          count += weight;
        } else {
          sum += avg;
          count += 1;
        }
      });
      if (count === 0) return '';
      return ` ｜ 平均耗时：${formatDuration(sum / count)}`;
    })();
    const assistantLatencySummary = (() => {
      if (!hasAssistantLatency) return '';
      const metaAvg = Number(agg?.meta?.avg_assistant_turn_latency_ms);
      if (Number.isFinite(metaAvg)) {
        return ` ｜ AI单轮平均耗时：${formatDuration(metaAvg)}`;
      }
      let sum = 0;
      let count = 0;
      Object.keys(stats).forEach((m) => {
        const avg = Number(stats[m]?.assistant_avg_turn_latency_ms);
        if (!Number.isFinite(avg)) return;
        const weight = Number(stats[m]?.assistant_latency_samples ?? stats[m]?.total ?? 0);
        if (Number.isFinite(weight) && weight > 0) {
          sum += avg * weight;
          count += weight;
        } else {
          sum += avg;
          count += 1;
        }
      });
      if (count === 0) return '';
      return ` ｜ AI单轮平均耗时：${formatDuration(sum / count)}`;
    })();
    const tokenSummary = (() => {
      if (!hasTokens) return '';
      const totalTokensMeta = formatInt(agg?.meta?.total_tokens);
      const avgTokensMeta = formatInt(agg?.meta?.avg_tokens);
      if (totalTokensMeta !== null) {
        const avgText = avgTokensMeta !== null ? `，平均Tokens：${avgTokensMeta}` : '';
        return ` ｜ 总Tokens：${totalTokensMeta}${avgText}`;
      }
      let totalTokens = 0;
      let hasAny = false;
      Object.keys(stats).forEach((m) => {
        const val = formatInt(stats[m]?.total_tokens);
        if (val !== null) {
          totalTokens += val;
          hasAny = true;
        }
      });
      return hasAny ? ` ｜ 总Tokens：${totalTokens}` : '';
    })();
    const costSummary = (() => {
      if (!hasCost) return '';
      const totalCostMeta = Number(agg?.meta?.total_cost);
      if (Number.isFinite(totalCostMeta) && totalCostMeta > 0) {
        const avgCostMeta = Number(agg?.meta?.avg_cost);
        const avgText = Number.isFinite(avgCostMeta) ? `，平均成本：${avgCostMeta.toFixed(4)}` : '';
        return ` ｜ 总成本：${totalCostMeta.toFixed(4)}${avgText}`;
      }
      let totalCost = 0;
      let hasAny = false;
      Object.keys(stats).forEach((m) => {
        const val = Number(stats[m]?.total_cost);
        if (Number.isFinite(val)) {
          totalCost += val;
          hasAny = true;
        }
      });
      return hasAny ? ` ｜ 总成本：${totalCost.toFixed(4)}` : '';
    })();
    summaryEl.textContent = `批次时间：${created} ｜ 总用例：${total} ｜ 模型数：${models.length}${latencySummary}${assistantLatencySummary}${tokenSummary}${costSummary}`;

    // 重建表头以便动态插入耗时列
    const thead = table.querySelector('thead');
    if (thead) {
      thead.innerHTML = `<tr>
        <th style="text-align:left;padding:4px;">模型</th>
        <th style="text-align:right;padding:4px;">通过</th>
        <th style="text-align:right;padding:4px;">失败</th>
        <th style="text-align:right;padding:4px;">通过率</th>
        ${hasLatency ? '<th style="text-align:right;padding:4px;">平均耗时</th>' : ''}
        ${hasAssistantLatency ? '<th style="text-align:right;padding:4px;">AI单轮平均耗时</th>' : ''}
        ${hasTokens ? '<th style="text-align:right;padding:4px;">平均Token</th><th style="text-align:right;padding:4px;">总Token</th>' : ''}
        ${hasCost ? '<th style="text-align:right;padding:4px;">平均成本</th><th style="text-align:right;padding:4px;">总成本</th>' : ''}
      </tr>`;
    }

    tbody.innerHTML = '';
    Object.keys(stats).forEach((m) => {
      const s = stats[m] || {};
      const tr = document.createElement('tr');
      const latencyCell = hasLatency ? `<td style="padding:4px;text-align:right;">${formatDuration(s.avg_latency_ms) ?? '-'}</td>` : '';
      const assistantLatencyCell = hasAssistantLatency ? `<td style="padding:4px;text-align:right;">${formatDuration(s.assistant_avg_turn_latency_ms) ?? '-'}</td>` : '';
      const tokenCells = hasTokens ? `<td style="padding:4px;text-align:right;">${formatInt(s.avg_tokens) ?? '-'}</td><td style="padding:4px;text-align:right;">${formatInt(s.total_tokens) ?? '-'}</td>` : '';
      const costCells = hasCost ? `<td style="padding:4px;text-align:right;">${formatCost(s.avg_cost) ?? '-'}</td><td style="padding:4px;text-align:right;">${formatCost(s.total_cost) ?? '-'}</td>` : '';
      tr.innerHTML = `
        <td style="padding:4px;">${m}</td>
        <td style="padding:4px;text-align:right;">${s.pass ?? 0}</td>
        <td style="padding:4px;text-align:right;">${s.fail ?? 0}</td>
        <td style="padding:4px;text-align:right;">${s.passRate ?? 0}%</td>
        ${latencyCell}
        ${assistantLatencyCell}
        ${tokenCells}
        ${costCells}
      `;
      tbody.appendChild(tr);
    });
    table.style.display = Object.keys(stats).length ? '' : 'none';
    if (chartsWrap) {
      chartsWrap.style.display = Object.keys(stats).length ? '' : 'none';
      renderModelCompare('simple-chart-model', stats);
      renderSeverityStacked('simple-chart-severity', stats);
      renderLatencyChart(latencyChartEl, stats);
      renderMetricsChart(metricsChartEl, stats);
      renderErrorPie('simple-chart-pie', stats);
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
    const reportBtn = document.getElementById('btn-export-report');
    if (reportBtn) reportBtn.disabled = !Object.keys(stats).length;
  };

  const fetchLatestRunAggregate = async (presetId) => {
    // 优先新版 test-runs（包含 avg_latency_ms 等技指）
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

    // 退回 experiments（如无技指则仅有通过/失败）
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

  const exportReport = (agg) => {
    if (!agg) return;
    const lines = [];
    lines.push(`# 测试结果报告`);
    const meta = agg.meta || {};
    lines.push(`- 预设ID：${meta.preset_id ?? ''}`);
    lines.push(`- 创建时间：${meta.created_at ?? ''}`);
    lines.push(`- 模型数：${(meta.models_tested || []).length}`);
    lines.push(`- 总用例：${meta.total_samples ?? 0}`);
    const totalTokensMeta = formatInt(meta.total_tokens);
    if (totalTokensMeta !== null) lines.push(`- 总Tokens：${totalTokensMeta}`);
    const avgTokensMeta = formatInt(meta.avg_tokens);
    if (avgTokensMeta !== null) lines.push(`- 平均Tokens：${avgTokensMeta}`);
    const totalCostMeta = formatCost(meta.total_cost);
    if (totalCostMeta !== null) lines.push(`- 总成本：${totalCostMeta}`);
    const avgCostMeta = formatCost(meta.avg_cost);
    if (avgCostMeta !== null) lines.push(`- 平均成本：${avgCostMeta}`);
    lines.push('');
    lines.push(`## 模型统计`);
    lines.push(`| 模型 | 通过 | 失败 | 通过率 |`);
    lines.push(`| --- | --- | --- | --- |`);
    const stats = agg.statistics || {};
    Object.keys(stats).forEach((m) => {
      const s = stats[m] || {};
      const extras = [];
      const avgLatencyText = formatDuration(s.avg_latency_ms);
      if (avgLatencyText) extras.push(`平均耗时：${avgLatencyText}`);
      if (s.avg_tokens !== undefined) extras.push(`平均Tokens：${s.avg_tokens}`);
      if (s.total_tokens !== undefined) extras.push(`总Tokens：${s.total_tokens}`);
      const avgCost = formatCost(s.avg_cost);
      if (avgCost !== null) extras.push(`平均成本：${avgCost}`);
      const totalCost = formatCost(s.total_cost);
      if (totalCost !== null) extras.push(`总成本：${totalCost}`);
      lines.push(`| ${m} | ${s.pass ?? 0} | ${s.fail ?? 0} | ${(s.passRate ?? 0)}% |`);
      if (extras.length) lines.push(`> ${extras.join(' | ')}`);
    });
    lines.push('');
    lines.push(`## 错误分布（按模型）`);
    Object.keys(stats).forEach((m) => {
      const s = stats[m] || {};
      lines.push(`### ${m}`);
      const errMap = s.errors || {};
      if (!Object.keys(errMap).length) {
        lines.push(`- 无错误`);
      } else {
        Object.keys(errMap).forEach((k) => {
          lines.push(`- ${k}: ${errMap[k]}`);
        });
      }
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `preset_${meta.preset_id || 'report'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const bindButtons = () => {
    const btnRefresh = document.getElementById('btn-refresh-results');
    const btnReport = document.getElementById('btn-export-report');
    btnRefresh?.addEventListener('click', () => loadAndRenderLatest());
    btnReport?.addEventListener('click', () => {
      if (!lastAgg) return;
      exportReport(lastAgg);
    });
  };

  const renderLatencyChart = (el, statistics) => {
    if (!el || !window.echarts) return;
    const models = Object.keys(statistics || {});
    if (!models.length) return;
    const avgLat = models.map((m) => statistics[m]?.avg_latency_ms ?? null);
    const avgTurn = models.map((m) => statistics[m]?.assistant_avg_turn_latency_ms ?? null);
    const chart = window.echarts.init(el);
    chart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['平均耗时', 'AI单轮'] },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: models },
      yAxis: { type: 'value', name: 'ms' },
      series: [
        { name: '平均耗时', type: 'bar', data: avgLat },
        { name: 'AI单轮', type: 'line', data: avgTurn, smooth: true }
      ]
    });
  };

  const renderMetricsChart = (el, statistics) => {
    if (!el || !window.echarts) return;
    const models = Object.keys(statistics || {});
    if (!models.length) return;
    const avgTokens = models.map((m) => statistics[m]?.avg_tokens ?? null);
    const totalTokens = models.map((m) => statistics[m]?.total_tokens ?? null);
    const avgCost = models.map((m) => statistics[m]?.avg_cost ?? null);
    const hasTokens = avgTokens.some((v) => v !== null) || totalTokens.some((v) => v !== null);
    const hasCost = avgCost.some((v) => v !== null);
    if (!hasTokens && !hasCost) return;
    const chart = window.echarts.init(el);
    chart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['平均Token', '总Token', '平均成本'] },
      grid: { left: '5%', right: '8%', bottom: '8%', containLabel: true },
      xAxis: { type: 'category', data: models },
      yAxis: [
        { type: 'value', name: 'Token', position: 'left' },
        { type: 'value', name: '成本', position: 'right' }
      ],
      series: [
        hasTokens ? { name: '平均Token', type: 'bar', yAxisIndex: 0, data: avgTokens } : null,
        hasTokens ? { name: '总Token', type: 'bar', yAxisIndex: 0, data: totalTokens, barGap: '5%' } : null,
        hasCost ? { name: '平均成本', type: 'line', yAxisIndex: 1, data: avgCost, smooth: true } : null
      ].filter(Boolean)
    });
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
