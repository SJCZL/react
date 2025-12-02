// Lightweight runner that uses TaskOrchestrator directly to run a single
// end-to-end evaluation based on current Parallel Test panel config.
// Exposes window.runParallelTestForPreset(preset) and records window.__lastParallelResults

import { TaskOrchestrator } from './TaskOrchestrator.js';
import { modelConfig } from '../config/ModelConfig.js';

function pick(value, fallback) {
  return (value !== undefined && value !== null && value !== '') ? value : fallback;
}

// Map assessment artifacts into a compact errors[] list for aggregation
function extractErrorSummary(assessment) {
  const getNames = (arr) => {
    const out = [];
    try { for (const item of (arr || [])) { const n = (item?.name || '').toString().trim(); if (n) out.push(n); } } catch {}
    return out;
  };
  return {
    Inform: getNames(assessment?.Inform),
    Warning: getNames(assessment?.Warning),
    Error: getNames(assessment?.Error),
    Unlisted: getNames(assessment?.Unlisted)
  };
}

function computeAssistantLatency(conversation = []) {
  const msgs = Array.isArray(conversation) ? conversation : [];
  const latencies = [];
  const firsts = [];
  for (const msg of msgs) {
    if ((msg?.role || '').toLowerCase() !== 'assistant') continue;
    const m = msg?.metrics || {};
    const started = Number(m.startedAt);
    const ended = Number(m.endedAt);
    const latency = Number.isFinite(m.latencyMs)
      ? m.latencyMs
      : (Number.isFinite(started) && Number.isFinite(ended) ? ended - started : null);
    if (Number.isFinite(latency)) latencies.push(latency);
    const firstToken = Number.isFinite(m.firstTokenLatencyMs)
      ? m.firstTokenLatencyMs
      : (Number.isFinite(started) && Number.isFinite(m.firstTokenAt) ? m.firstTokenAt - started : null);
    if (Number.isFinite(firstToken)) firsts.push(firstToken);
  }
  const avg = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : undefined;
  const firstAvg = firsts.length ? Math.round(firsts.reduce((a, b) => a + b, 0) / firsts.length) : undefined;
  return {
    assistant_avg_latency_ms: avg,
    assistant_first_token_avg_ms: firstAvg,
    assistant_turns: latencies.length || undefined
  };
}

async function runOnceWithCurrentConfig(preset) {
  // Build inputs from ConfigPanel state with sane fallbacks
  const cp = (window.ConfigPanel && window.ConfigPanel.state) ? window.ConfigPanel.state : {};
  const p = cp.preset || {};

  const chatSystemPrompt = (preset && preset.text) || '';
  const autoresponseSystemPrompt = pick(p?.basic?.autoResponsePrompt, '');
  const initialMessage = pick(p?.basic?.initialMessage, '你好');
  const sceneInfo = pick(cp.sceneInfo, '');
  // To avoid excessive requests and rate limits, default to a very short
  // deterministic run: 2 rounds. Users can still configure different end
  // conditions in the Parallel Test panel.
  const endType = pick(p?.basic?.endCondition?.type, 'rounds');
  const endRounds = pick(p?.basic?.endCondition?.rounds, 2);
  const endAssistant = pick(p?.basic?.endCondition?.assistantRegex, '<\\?END_CHAT>');
  const endUser = pick(p?.basic?.endCondition?.userRegex, '<\\?END_CHAT>');

  const dialogueProviderId = pick(p?.dialogue?.provider, modelConfig.currentProvider);
  const evalProviderId = pick(p?.evaluation?.provider, dialogueProviderId);
  const resolveDefaultModel = (providerId) => {
    const provider = modelConfig.getProviderConfig(providerId);
    return provider?.models?.[0]?.id || modelConfig.currentModel;
  };
  const modelName = pick(p?.dialogue?.model, resolveDefaultModel(dialogueProviderId));
  const temperature = pick(p?.dialogue?.temperature, 0.97);
  const topP = pick(p?.dialogue?.top_p, 0.3);

  const evalModel = pick(p?.evaluation?.model, resolveDefaultModel(evalProviderId));
  const evalTopP = pick(p?.evaluation?.top_p, 0.97);
  const evalTemp = pick(p?.evaluation?.temperature, 0.75);
  const emitUnlisted = p?.assessmentOptions?.includeUnlistedIssues !== false;
  // 将错误库数组转换为按名称/ID索引的字典
  const mistakeLibrary = (() => {
    const lib = {};
    try {
      for (const m of (cp.mistakes || [])) {
        const key = (m.id || m.name || '').toString().trim();
        if (!key) continue;
        lib[key] = { name: m.name || key, severity: m.severity || 'Warning', description: m.description || '' };
      }
    } catch {}
    return lib;
  })();

  // Prepare orchestrator
  const dialogueApiKey = modelConfig.getApiKeyForProvider(dialogueProviderId);
  if (!dialogueApiKey) {
    throw new Error(`缺少 ${dialogueProviderId} 的 API 密钥，请先在“模型设置”中配置`);
  }
  const evalApiKey = modelConfig.getApiKeyForProvider(evalProviderId);
  if (!evalApiKey) {
    throw new Error(`缺少 ${evalProviderId} 的 API 密钥，请先在“模型设置”中配置`);
  }

  const orchestrator = new TaskOrchestrator(dialogueApiKey);
  const inputs = {
    cgsInputs: {
      chatSystemPrompt,
      autoresponseSystemPrompt,
      initialMessage,
      sceneInfo,
      endCondition: {
        type: endType,
        value: endType === 'rounds' ? endRounds : (endType === 'assistantRegex' ? endAssistant : endUser)
      },
      modelName,
      temperature,
      topP,
      providerId: dialogueProviderId,
      apiKeyOverride: dialogueApiKey
    },
    assessmentConfig: {
      llmConfig: {
        model: evalModel,
        top_p: evalTopP,
        temperature: evalTemp,
        providerId: evalProviderId,
        apiKey: evalApiKey
      },
      mistakeLibrary,
      emitUnlistedIssues: emitUnlisted
    },
    ratingConfig: {
      llmConfig: {
        model: evalModel,
        top_p: evalTopP,
        temperature: evalTemp,
        providerId: evalProviderId,
        apiKey: evalApiKey
      }
    }
  };

  const startedAt = Date.now();
  // Await completion via a Promise wrapper
  const result = await new Promise((resolve, reject) => {
    const onError = (err) => reject(err);
    const onComplete = (payload) => resolve(payload);
    try {
      orchestrator.on('error', onError);
      orchestrator.on('complete', onComplete);
      orchestrator.start(inputs);
    } catch (e) {
      reject(e);
    }
  });

  // Build a single-sample result compatible with analyzer
  const sampleId = 's-001';
  const errorSummary = extractErrorSummary(result?.assessmentResult || {});
  const errors = [...errorSummary.Error, ...errorSummary.Warning, ...errorSummary.Inform, ...errorSummary.Unlisted];
  const latencyMs = Date.now() - startedAt;
  const techMetrics = computeAssistantLatency(result?.chatRecord?.conversation || []);
  return [{
    preset_id: preset?.id || 0,
    model: modelName || modelConfig.currentModel,
    sample_id: sampleId,
    errors,
    errorSummary,
    errorCounts: {
      Inform: errorSummary.Inform.length,
      Warning: errorSummary.Warning.length,
      Error: errorSummary.Error.length,
      Unlisted: errorSummary.Unlisted.length
    },
    score: (typeof result?.ratingResult?.finalScore === 'number') ? result.ratingResult.finalScore : undefined,
    latency_ms: Number.isFinite(latencyMs) ? Math.round(latencyMs) : undefined,
    tech_metrics: techMetrics
  }];
}

window.runParallelTestForPreset = async function(preset) {
  const results = await runOnceWithCurrentConfig(preset);
  window.__lastParallelResults = results;
  return results;
};

console.log('[parallel-test/runner] window.runParallelTestForPreset ready');
