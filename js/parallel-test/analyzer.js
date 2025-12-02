// Aggregation of parallel test results by model and simple chart rendering helpers

export function analyzeResultsByModel(results, presetId) {
  const stats = {};
  let total = 0;
  let latencySum = 0;
  let latencyCount = 0;
  let assistantLatencySum = 0;
  let assistantLatencyCount = 0;
  let assistantFirstSum = 0;
  let assistantFirstCount = 0;
  const normStr = (s) => (typeof s === 'string' ? s.trim() : String(s || 'UNKNOWN'));

  for (const item of results || []) {
    const model = item.model || 'unknown';
    if (!stats[model]) {
      stats[model] = {
        total: 0,
        pass: 0,
        fail: 0,
        passRate: 0,
        // Back-compat flat errors map used by existing charts
        errors: {},
        // New: severity aggregation and per-type-per-severity
        errorsBySeverity: { Inform: 0, Warning: 0, Error: 0, Unlisted: 0 },
        errorTypesBySeverity: { Inform: {}, Warning: {}, Error: {}, Unlisted: {} },
        _latencySum: 0,
        _latencyCount: 0,
        _assistantLatencySum: 0,
        _assistantLatencyCount: 0,
        _assistantFirstSum: 0,
        _assistantFirstCount: 0
      };
    }
    stats[model].total += 1;
    total += 1;

    const latency = Number(item.latency_ms);
    if (Number.isFinite(latency) && latency >= 0) {
      stats[model]._latencySum += latency;
      stats[model]._latencyCount += 1;
      latencySum += latency;
      latencyCount += 1;
    }

    const tech = item.tech_metrics || item.techMetrics || null;
    const assistantTurnCount = Number(tech?.assistant_turns || tech?.assistant_turn_count);
    const assistantTurnAvg = Number(tech?.assistant_avg_latency_ms);
    if (Number.isFinite(assistantTurnAvg) && Number.isFinite(assistantTurnCount) && assistantTurnCount > 0) {
      const weighted = assistantTurnAvg * assistantTurnCount;
      stats[model]._assistantLatencySum += weighted;
      stats[model]._assistantLatencyCount += assistantTurnCount;
      assistantLatencySum += weighted;
      assistantLatencyCount += assistantTurnCount;
    }
    const assistantFirstAvg = Number(tech?.assistant_first_token_avg_ms);
    if (Number.isFinite(assistantFirstAvg) && Number.isFinite(assistantTurnCount) && assistantTurnCount > 0) {
      const weightedFirst = assistantFirstAvg * assistantTurnCount;
      stats[model]._assistantFirstSum += weightedFirst;
      stats[model]._assistantFirstCount += assistantTurnCount;
      assistantFirstSum += weightedFirst;
      assistantFirstCount += assistantTurnCount;
    }

    // Prefer structured summary if present
    const sum = item.errorSummary || null;
    let flatErrors = [];
    if (sum) {
      const severities = ['Error','Warning','Inform','Unlisted'];
      let any = 0;
      let warnErrCount = 0;
      for (const sev of severities) {
        const names = Array.isArray(sum[sev]) ? sum[sev] : [];
        stats[model].errorsBySeverity[sev] += names.length;
        any += names.length;
        if (sev === 'Error' || sev === 'Warning' || sev === 'Unlisted') {
          warnErrCount += names.length;
        }
        for (const raw of names) {
          const name = normStr(raw);
          // per-type-per-severity
          stats[model].errorTypesBySeverity[sev][name] = (stats[model].errorTypesBySeverity[sev][name] || 0) + 1;
          // back-compat flat errors map
          stats[model].errors[name] = (stats[model].errors[name] || 0) + 1;
          flatErrors.push(name);
        }
      }
      if (warnErrCount === 0) stats[model].pass += 1; else stats[model].fail += 1;
    } else {
      // Fallback: use legacy item.errors flat list
      const errs = Array.isArray(item.errors) ? item.errors : [];
      if (errs.length === 0) {
        stats[model].pass += 1;
      } else {
        stats[model].fail += 1;
        for (const e of errs) {
          const name = normStr(e);
          stats[model].errors[name] = (stats[model].errors[name] || 0) + 1;
          // Unspecified severity -> count under Warning by default
          stats[model].errorsBySeverity.Warning += 1;
          stats[model].errorTypesBySeverity.Warning[name] = (stats[model].errorTypesBySeverity.Warning[name] || 0) + 1;
          flatErrors.push(name);
        }
      }
    }
  }

  for (const m of Object.keys(stats)) {
    const { total, pass, _latencySum = 0, _latencyCount = 0 } = stats[m];
    stats[m].passRate = total > 0 ? Math.round((pass / total) * 100) : 0;
    if (_latencyCount > 0) {
      stats[m].avg_latency_ms = Math.round(_latencySum / _latencyCount);
      stats[m].latency_samples = _latencyCount;
    }
    if (stats[m]._assistantLatencyCount > 0) {
      stats[m].assistant_avg_turn_latency_ms = Math.round(stats[m]._assistantLatencySum / stats[m]._assistantLatencyCount);
      stats[m].assistant_latency_samples = stats[m]._assistantLatencyCount;
    }
    if (stats[m]._assistantFirstCount > 0) {
      stats[m].assistant_first_token_avg_ms = Math.round(stats[m]._assistantFirstSum / stats[m]._assistantFirstCount);
    }
    delete stats[m]._latencySum;
    delete stats[m]._latencyCount;
    delete stats[m]._assistantLatencySum;
    delete stats[m]._assistantLatencyCount;
    delete stats[m]._assistantFirstSum;
    delete stats[m]._assistantFirstCount;
  }

  return {
    meta: {
      preset_id: presetId,
      models_tested: Object.keys(stats),
      total_samples: total,
      created_at: new Date().toISOString(),
      avg_latency_ms: latencyCount > 0 ? Math.round(latencySum / latencyCount) : undefined,
      latency_samples: latencyCount,
      avg_assistant_turn_latency_ms: assistantLatencyCount > 0 ? Math.round(assistantLatencySum / assistantLatencyCount) : undefined,
      avg_assistant_first_token_ms: assistantFirstCount > 0 ? Math.round(assistantFirstSum / assistantFirstCount) : undefined,
      assistant_latency_samples: assistantLatencyCount
    },
    statistics: stats
  };
}

export function renderModelCompare(domId, statistics) {
  if (!window.echarts) return;
  const el = document.getElementById(domId);
  if (!el) return;
  const models = Object.keys(statistics || {});
  const pass = models.map(m => (statistics[m]?.pass || 0));
  const fail = models.map(m => (statistics[m]?.fail || 0));
  const chart = window.echarts.init(el);
  chart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['通过', '失败'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: [{ type: 'category', data: models }],
    yAxis: [{ type: 'value' }],
    series: [
      { name: '通过', type: 'bar', stack: 'total', emphasis: { focus: 'series' }, data: pass },
      { name: '失败', type: 'bar', stack: 'total', emphasis: { focus: 'series' }, data: fail }
    ]
  });
  return chart;
}

// Render severity stacked bars per model (Inform/Warning/Error/Unlisted)
export function renderSeverityStacked(domId, statistics) {
  if (!window.echarts) return;
  const el = document.getElementById(domId);
  if (!el) return;
  const models = Object.keys(statistics || {});
  const bySev = (sev) => models.map(m => (statistics[m]?.errorsBySeverity?.[sev] || 0));
  const series = [
    { name: 'Inform', type: 'bar', stack: 'sev', data: bySev('Inform') },
    { name: 'Warning', type: 'bar', stack: 'sev', data: bySev('Warning') },
    { name: 'Error', type: 'bar', stack: 'sev', data: bySev('Error') },
    { name: 'Unlisted', type: 'bar', stack: 'sev', data: bySev('Unlisted') }
  ];
  const chart = window.echarts.init(el);
  chart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['Inform','Warning','Error','Unlisted'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: [{ type: 'category', data: models }],
    yAxis: [{ type: 'value' }],
    series
  });
  return chart;
}

// Compute top error types across all models or a specific model
export function computeTopErrors(statistics, { model = 'ALL', limit = 10 } = {}) {
  const acc = {};
  const addCounts = (map) => {
    for (const name of Object.keys(map || {})) {
      acc[name] = (acc[name] || 0) + (map[name] || 0);
    }
  };
  const appendModel = (m) => {
    const sevMaps = (statistics[m]?.errorTypesBySeverity) || {};
    addCounts(sevMaps.Inform || {});
    addCounts(sevMaps.Warning || {});
    addCounts(sevMaps.Error || {});
    addCounts(sevMaps.Unlisted || {});
  };
  if (model && model !== 'ALL') {
    if (statistics[model]) appendModel(model);
  } else {
    for (const m of Object.keys(statistics || {})) appendModel(m);
  }
  const rows = Object.keys(acc).map(name => ({ name, count: acc[name] })).sort((a,b) => b.count - a.count);
  return rows.slice(0, limit);
}

// Render a simple Top Errors table (DOM only)
export function renderTopErrorsTable(domId, statistics, { model = 'ALL', limit = 10 } = {}) {
  const el = document.getElementById(domId);
  if (!el) return;
  const rows = computeTopErrors(statistics, { model, limit });
  const html = [
    '<table class="top-errors-table" style="width:100%;border-collapse:collapse;">',
    '<thead><tr><th style="text-align:left;">错误类型</th><th style="text-align:right;">次数</th></tr></thead>',
    '<tbody>',
    ...rows.map(r => `<tr><td>${escapeHtml(r.name)}</td><td style="text-align:right;">${r.count}</td></tr>`),
    '</tbody></table>'
  ].join('');
  el.innerHTML = html;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderErrorPie(domId, statistics) {
  if (!window.echarts) return;
  const el = document.getElementById(domId);
  if (!el) return;
  const errorMap = {};
  for (const m of Object.keys(statistics || {})) {
    const errs = statistics[m]?.errors || {};
    for (const k of Object.keys(errs)) {
      errorMap[k] = (errorMap[k] || 0) + errs[k];
    }
  }
  const data = Object.keys(errorMap).map(k => ({ name: k, value: errorMap[k] }));

  const chart = window.echarts.init(el);
  chart.setOption({
    tooltip: { trigger: 'item' },
    legend: { top: 'bottom' },
    series: [
      {
        name: '错误类型',
        type: 'pie',
        radius: '55%',
        center: ['50%', '50%'],
        data,
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } }
      }
    ]
  });
  return chart;
}

export function exportStatsToCSV(agg) {
  const rows = [['model', 'total', 'pass', 'fail', 'passRate', 'errors_json']];
  const stats = agg?.statistics || {};
  for (const m of Object.keys(stats)) {
    const errJson = JSON.stringify(stats[m].errors || {});
    rows.push([
      m,
      stats[m].total ?? 0,
      stats[m].pass ?? 0,
      stats[m].fail ?? 0,
      stats[m].passRate ?? 0,
      errJson
    ]);
  }
  const csv = rows.map(r => r.map(v => csvEscape(preventCsvInjection(String(v ?? '')))).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `experiment_stats_${agg?.meta?.preset_id || 'unknown'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('\n') || s.includes('"')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function preventCsvInjection(s) {
  if (!s) return s;
  const first = s[0];
  if (first === '=' || first === '+' || first === '-' || first === '@') {
    return "'" + s; // prefix single quote
  }
  return s;
}
