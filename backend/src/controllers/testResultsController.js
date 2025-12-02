import { body, validationResult, query, param } from 'express-validator';
import { getPool } from '../config/database.js';

const TEST_RUN_STATUSES = ['pending', 'running', 'completed', 'failed'];
const CASE_SEVERITIES = ['inform', 'warning', 'error', 'fatal', 'unlisted'];
const SUMMARY_LIMIT = 1000; // 防止单次聚合读取过多记录

const SEVERITY_MAP = {
  inform: 'Inform',
  warning: 'Warning',
  error: 'Error',
  fatal: 'Error',
  unlisted: 'Unlisted'
};

const normalizeSeverity = (value) => {
  if (!value) return 'Unlisted';
  const key = String(value).toLowerCase();
  return SEVERITY_MAP[key] || 'Unlisted';
};

const createEmptyStats = () => ({
  total: 0,
  pass: 0,
  fail: 0,
  passRate: 0,
  errors: {},
  errorsBySeverity: { Inform: 0, Warning: 0, Error: 0, Unlisted: 0 },
  errorTypesBySeverity: {
    Inform: {},
    Warning: {},
    Error: {},
    Unlisted: {}
  }
});

const safeParseJSON = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const handleValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: '输入数据验证失败',
      errors: errors.array()
    });
    return false;
  }
  return true;
};

const mapRunRow = (row) => ({
  id: row.id,
  name: row.name,
  preset_id: row.preset_id,
  models: safeParseJSON(row.models, []),
  total_cases: row.total_cases,
  status: row.status,
  metadata: safeParseJSON(row.metadata, {}),
  started_at: row.started_at,
  ended_at: row.ended_at,
  created_at: row.created_at,
  updated_at: row.updated_at
});

const mapCaseRow = (row) => ({
  id: row.id,
  test_run_id: row.test_run_id,
  model: row.model,
  prompt_ref: row.prompt_ref,
  passed: row.passed === 1,
  severity: row.severity,
  error_type: row.error_type,
  error_message: row.error_message,
  turn_count: row.turn_count,
  latency_ms: row.latency_ms,
  input_tokens: row.input_tokens,
  output_tokens: row.output_tokens,
  cost: row.cost,
  worker_id: row.worker_id,
  meta: safeParseJSON(row.meta, {}),
  started_at: row.started_at,
  ended_at: row.ended_at,
  created_at: row.created_at,
  updated_at: row.updated_at
});

const ensureRunOwnership = async (pool, runId, userId) => {
  const [rows] = await pool.execute(
    'SELECT id FROM test_runs WHERE id = ? AND user_id = ?',
    [runId, userId]
  );
  return rows.length > 0;
};

export const createTestRun = [
  body('name').optional().isString().isLength({ max: 255 }).trim(),
  body('preset_id').optional().isInt({ min: 1 }),
  body('models').optional().isArray(),
  body('total_cases').optional().isInt({ min: 0 }),
  body('status').optional().isIn(TEST_RUN_STATUSES),
  body('metadata').optional().isObject(),
  body('started_at').optional().isISO8601(),
  body('ended_at').optional().isISO8601(),
  async (req, res) => {
    if (!handleValidation(req, res)) return;

    try {
      const pool = getPool();
      const {
        name = null,
        preset_id,
        models = [],
        total_cases = 0,
        status = 'running',
        metadata = null,
        started_at,
        ended_at
      } = req.body;

      const [result] = await pool.execute(
        `INSERT INTO test_runs (user_id, name, preset_id, models, total_cases, status, metadata, started_at, ended_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          name || null,
          preset_id ? Number(preset_id) : null,
          models.length ? JSON.stringify(models) : null,
          Number(total_cases) || 0,
          status,
          metadata ? JSON.stringify(metadata) : null,
          started_at ? new Date(started_at) : (status === 'pending' ? null : new Date()),
          ended_at ? new Date(ended_at) : null
        ]
      );

      const [rows] = await pool.execute(
        'SELECT * FROM test_runs WHERE id = ?',
        [result.insertId]
      );

      res.status(201).json({
        success: true,
        data: mapRunRow(rows[0])
      });
    } catch (error) {
      console.error('创建测试运行失败:', error);
      res.status(500).json({
        success: false,
        message: '创建测试运行失败'
      });
    }
  }
];

export const listTestRuns = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(TEST_RUN_STATUSES),
  query('preset_id').optional().isInt({ min: 1 }),
  async (req, res) => {
    if (!handleValidation(req, res)) return;

    try {
      const pool = getPool();
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const offset = (page - 1) * limit;
      const filters = ['user_id = ?'];
      const params = [Number(req.user?.id)];

      if (!Number.isFinite(params[0])) {
        return res.status(401).json({ success: false, message: '未授权用户' });
      }

      if (req.query.status) {
        filters.push('status = ?');
        params.push(req.query.status);
      }

      if (req.query.preset_id) {
        const presetId = Number.parseInt(req.query.preset_id, 10);
        if (!Number.isFinite(presetId)) {
          return res.status(400).json({ success: false, message: 'preset_id 参数无效' });
        }
        filters.push('preset_id = ?');
        params.push(presetId);
      }

      const whereClause = filters.join(' AND ');

      // 避免部分 MySQL 版本对 LIMIT/OFFSET 占位符报错，limit/offset 直接插值（已做数值校验）
      const sql = `
        SELECT * FROM test_runs
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      const [rows] = await pool.execute(sql, params);

      const [[countRow]] = await pool.execute(
        `SELECT COUNT(*) as total FROM test_runs WHERE ${whereClause}`,
        params
      );

      res.json({
        success: true,
        data: rows.map(mapRunRow),
        pagination: {
          page,
          limit,
          total: countRow.total,
          pages: Math.ceil(countRow.total / limit)
        }
      });
    } catch (error) {
      console.error('获取测试运行列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取测试运行列表失败'
      });
    }
  }
];

export const addTestCases = [
  param('id').isInt({ min: 1 }),
  body('cases').isArray({ min: 1 }),
  body('cases.*.model').isString().notEmpty(),
  body('cases.*.prompt_ref').optional().isString(),
  body('cases.*.passed').optional().isBoolean(),
  body('cases.*.severity').optional().isIn(CASE_SEVERITIES),
  body('cases.*.error_type').optional().isString(),
  body('cases.*.error_message').optional().isString(),
  body('cases.*.turn_count').optional().isInt({ min: 0 }),
  body('cases.*.latency_ms').optional().isInt({ min: 0 }),
  body('cases.*.input_tokens').optional().isInt({ min: 0 }),
  body('cases.*.output_tokens').optional().isInt({ min: 0 }),
  body('cases.*.cost').optional().isFloat({ min: 0 }),
  body('cases.*.worker_id').optional().isString(),
  body('cases.*.meta').optional().isObject(),
  body('cases.*.started_at').optional().isISO8601(),
  body('cases.*.ended_at').optional().isISO8601(),
  async (req, res) => {
    if (!handleValidation(req, res)) return;

    const runId = Number(req.params.id);

    try {
      const pool = getPool();
      const ownsRun = await ensureRunOwnership(pool, runId, req.user.id);

      if (!ownsRun) {
        return res.status(404).json({
          success: false,
          message: '测试运行不存在'
        });
      }

      const cases = req.body.cases;
      const connection = await pool.getConnection();

      try {
        await connection.beginTransaction();

        const placeholders = cases.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').join(', ');
        const values = cases.flatMap((testCase) => ([
          runId,
          testCase.model,
          testCase.prompt_ref || null,
          testCase.passed ? 1 : 0,
          testCase.severity || 'unlisted',
          testCase.error_type || null,
          testCase.error_message || null,
          typeof testCase.turn_count === 'number' ? testCase.turn_count : 0,
          typeof testCase.latency_ms === 'number' ? testCase.latency_ms : null,
          typeof testCase.input_tokens === 'number' ? testCase.input_tokens : null,
          typeof testCase.output_tokens === 'number' ? testCase.output_tokens : null,
          typeof testCase.cost === 'number' ? testCase.cost : null,
          testCase.worker_id || null,
          testCase.meta ? JSON.stringify(testCase.meta) : null,
          testCase.started_at ? new Date(testCase.started_at) : null,
          testCase.ended_at ? new Date(testCase.ended_at) : null
        ]));

        await connection.query(
          `INSERT INTO test_cases (
            test_run_id, model, prompt_ref, passed, severity, error_type, error_message,
            turn_count, latency_ms, input_tokens, output_tokens, cost, worker_id, meta,
            started_at, ended_at
          ) VALUES ${placeholders}`,
          values
        );

        await connection.query(
          'UPDATE test_runs SET updated_at = NOW() WHERE id = ?',
          [runId]
        );

        await connection.commit();

        res.status(201).json({
          success: true,
          message: `已写入 ${cases.length} 条测试用例`
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('写入测试用例失败:', error);
      res.status(500).json({
        success: false,
        message: '写入测试用例失败'
      });
    }
  }
];

export const listTestCases = [
  param('id').isInt({ min: 1 }),
  query('model').optional().isString(),
  query('severity').optional().isIn(CASE_SEVERITIES),
  query('error_type').optional().isString(),
  query('passed').optional().isBoolean().toBoolean(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 200 }),
  async (req, res) => {
    if (!handleValidation(req, res)) return;

    const runId = Number(req.params.id);

    try {
      const pool = getPool();
      const ownsRun = await ensureRunOwnership(pool, runId, req.user.id);

      if (!ownsRun) {
        return res.status(404).json({
          success: false,
          message: '测试运行不存在'
        });
      }

      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      const offset = (page - 1) * limit;
      const filters = ['test_run_id = ?'];
      const params = [runId];

      if (req.query.model) {
        filters.push('model = ?');
        params.push(req.query.model);
      }

      if (req.query.severity) {
        filters.push('severity = ?');
        params.push(req.query.severity);
      }

      if (req.query.error_type) {
        filters.push('error_type = ?');
        params.push(req.query.error_type);
      }

      if (typeof req.query.passed !== 'undefined') {
        filters.push('passed = ?');
        params.push(req.query.passed ? 1 : 0);
      }

      const whereClause = filters.join(' AND ');

      const [rows] = await pool.execute(
        `SELECT * FROM test_cases
         WHERE ${whereClause}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      const [[countRow]] = await pool.execute(
        `SELECT COUNT(*) as total FROM test_cases WHERE ${whereClause}`,
        params
      );

      res.json({
        success: true,
        data: rows.map(mapCaseRow),
        pagination: {
          page,
          limit,
          total: countRow.total,
          pages: Math.ceil(countRow.total / limit)
        }
      });
    } catch (error) {
      console.error('获取测试用例列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取测试用例列表失败'
      });
    }
  }
];

export const getRunSummary = [
  param('id').isInt({ min: 1 }),
  async (req, res) => {
    if (!handleValidation(req, res)) return;

    const runId = Number(req.params.id);

    try {
      const pool = getPool();
      const ownsRun = await ensureRunOwnership(pool, runId, req.user.id);

      if (!ownsRun) {
        return res.status(404).json({
          success: false,
          message: '测试运行不存在'
        });
      }

      const [[runRow]] = await pool.execute(
        'SELECT * FROM test_runs WHERE id = ?',
        [runId]
      );

      if (!runRow) {
        return res.status(404).json({
          success: false,
          message: '测试运行不存在'
        });
      }

      const [[totals]] = await pool.execute(
        `SELECT
            COUNT(*) AS total,
            SUM(passed = 1) AS passed,
            SUM(passed = 0) AS failed
         FROM test_cases
         WHERE test_run_id = ?`,
        [runId]
      );

      const [
        [severityRows],
        [typeRows],
        [modelRows],
        [turnHistRows],
        [latencyRows],
        [timelineRows],
        [modelSeverityRows],
        [modelErrorTypeRows]
      ] = await Promise.all([
        pool.execute(
          `SELECT severity, COUNT(*) AS count
           FROM test_cases
           WHERE test_run_id = ?
           GROUP BY severity`,
          [runId]
        ),
        pool.execute(
          `SELECT error_type, COUNT(*) AS count
           FROM test_cases
           WHERE test_run_id = ? AND error_type IS NOT NULL AND error_type != ''
           GROUP BY error_type
           ORDER BY count DESC
           LIMIT 20`,
          [runId]
        ),
        pool.execute(
          `SELECT model,
                  COUNT(*) AS total,
                  SUM(passed = 1) AS passed,
                  AVG(latency_ms) AS avg_latency_ms,
                  AVG(COALESCE(input_tokens,0) + COALESCE(output_tokens,0)) AS avg_tokens,
                  SUM(COALESCE(input_tokens,0) + COALESCE(output_tokens,0)) AS total_tokens,
                  AVG(cost) AS avg_cost,
                  SUM(COALESCE(cost,0)) AS total_cost
           FROM test_cases
           WHERE test_run_id = ?
           GROUP BY model`,
          [runId]
        ),
        pool.execute(
          `SELECT
              LEAST(turn_count, ?) AS bin,
              COUNT(*) AS count
           FROM test_cases
           WHERE test_run_id = ?
           GROUP BY bin
           ORDER BY bin`,
          [50, runId]
        ),
        pool.execute(
          `SELECT
              CASE
                WHEN latency_ms IS NULL THEN NULL
                WHEN latency_ms >= 60000 THEN 60000
                ELSE FLOOR(latency_ms / 1000) * 1000
              END AS bin,
              COUNT(*) AS count
           FROM test_cases
           WHERE test_run_id = ?
           GROUP BY bin
           ORDER BY bin`,
          [runId]
        ),
        pool.execute(
          `SELECT
              DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS bucket,
              COUNT(*) AS count
           FROM test_cases
           WHERE test_run_id = ?
           GROUP BY bucket
           ORDER BY bucket`,
          [runId]
        ),
        pool.execute(
          `SELECT
              model,
              COALESCE(severity, 'unlisted') AS severity,
              COUNT(*) AS count
           FROM test_cases
           WHERE test_run_id = ?
           GROUP BY model, severity`,
          [runId]
        ),
        pool.execute(
          `SELECT
              model,
              COALESCE(severity, 'unlisted') AS severity,
              error_type,
              COUNT(*) AS count
           FROM test_cases
           WHERE test_run_id = ? AND error_type IS NOT NULL AND error_type != ''
           GROUP BY model, severity, error_type`,
          [runId]
        )
      ]);

      const passRate = totals.total ? Number((totals.passed / totals.total).toFixed(4)) : 0;
      const totalStats = {
        total: totals.total || 0,
        passed: totals.passed || 0,
        failed: totals.failed || 0,
        passRate
      };

      const statistics = {};
      const ensureStats = (modelName) => {
        const key = modelName || 'unknown';
        if (!statistics[key]) {
          statistics[key] = createEmptyStats();
        }
        return statistics[key];
      };

      let latencySum = 0;
      let latencyCount = 0;
      let tokenSum = 0;
      let costSum = 0;
      let hasTokenData = false;
      let hasCostData = false;

      modelRows.forEach(row => {
        const model = row.model || 'unknown';
        const stats = ensureStats(model);
        const total = Number(row.total) || 0;
        const passed = Number(row.passed || 0);
        stats.total = total;
        stats.pass = passed;
        stats.fail = total - passed;
        stats.passRate = total ? Math.round((passed / total) * 100) : 0;
        if (row.avg_latency_ms !== null && row.avg_latency_ms !== undefined) {
          stats.avg_latency_ms = Number(row.avg_latency_ms);
          if (total > 0) {
            latencySum += Number(row.avg_latency_ms) * total;
            latencyCount += total;
          }
        }
        if (row.avg_tokens !== null && row.avg_tokens !== undefined) {
          stats.avg_tokens = Number(row.avg_tokens);
        }
        if (row.total_tokens !== null && row.total_tokens !== undefined) {
          stats.total_tokens = Number(row.total_tokens);
          tokenSum += Number(row.total_tokens);
          hasTokenData = true;
        } else if (row.avg_tokens !== null && row.avg_tokens !== undefined && total > 0) {
          tokenSum += Number(row.avg_tokens) * total;
          hasTokenData = true;
        }
        if (row.avg_cost !== null && row.avg_cost !== undefined) {
          stats.avg_cost = Number(row.avg_cost);
          hasCostData = true;
        }
        if (row.total_cost !== null && row.total_cost !== undefined) {
          stats.total_cost = Number(row.total_cost);
          costSum += Number(row.total_cost);
          hasCostData = true;
        } else if (row.avg_cost !== null && row.avg_cost !== undefined && total > 0) {
          costSum += Number(row.avg_cost) * total;
          hasCostData = true;
        }
      });

      const aggregateAvgLatency = latencyCount ? Number((latencySum / latencyCount).toFixed(0)) : undefined;
      const aggregateAvgTokens = hasTokenData && totalStats.total ? Number((tokenSum / totalStats.total).toFixed(0)) : undefined;
      const aggregateAvgCost = hasCostData && totalStats.total ? Number((costSum / totalStats.total).toFixed(6)) : undefined;

      modelSeverityRows.forEach(row => {
        const model = row.model || 'unknown';
        const stats = ensureStats(model);
        const severityKey = normalizeSeverity(row.severity);
        stats.errorsBySeverity[severityKey] += Number(row.count || 0);
      });

      modelErrorTypeRows.forEach(row => {
        if (!row.error_type) return;
        const model = row.model || 'unknown';
        const stats = ensureStats(model);
        const severityKey = normalizeSeverity(row.severity);
        const count = Number(row.count || 0);
        stats.errorTypesBySeverity[severityKey][row.error_type] =
          (stats.errorTypesBySeverity[severityKey][row.error_type] || 0) + count;
        stats.errors[row.error_type] = (stats.errors[row.error_type] || 0) + count;
      });

      const aggregate = {
        meta: {
          test_run_id: runRow.id,
          preset_id: runRow.preset_id,
          total_samples: totalStats.total,
          models_tested: Object.keys(statistics),
          created_at: runRow.created_at,
          status: runRow.status,
          avg_latency_ms: aggregateAvgLatency,
          avg_tokens: aggregateAvgTokens,
          total_tokens: hasTokenData ? tokenSum : undefined,
          avg_cost: aggregateAvgCost,
          total_cost: hasCostData ? Number(costSum.toFixed(6)) : undefined
        },
        statistics
      };

      const response = {
        run: mapRunRow(runRow),
        totals: totalStats,
        severityDistribution: severityRows.map(row => ({
          severity: normalizeSeverity(row.severity),
          count: Number(row.count)
        })),
        errorTypes: typeRows.map(row => ({
          error_type: row.error_type,
          count: Number(row.count)
        })),
        models: modelRows.map(row => ({
          model: row.model,
          total: Number(row.total),
          passed: Number(row.passed || 0),
          passRate: row.total ? Number(((row.passed || 0) / row.total).toFixed(4)) : 0,
          avg_latency_ms: row.avg_latency_ms !== null && row.avg_latency_ms !== undefined ? Number(row.avg_latency_ms) : null,
          avg_tokens: row.avg_tokens !== null && row.avg_tokens !== undefined ? Number(row.avg_tokens) : null,
          total_tokens: row.total_tokens !== null && row.total_tokens !== undefined ? Number(row.total_tokens) : null,
          avg_cost: row.avg_cost !== null && row.avg_cost !== undefined ? Number(row.avg_cost) : null,
          total_cost: row.total_cost !== null && row.total_cost !== undefined ? Number(row.total_cost) : null
        })),
        turnHistogram: turnHistRows.map(row => ({
          bin: Number(row.bin),
          count: Number(row.count)
        })),
        latencyHistogram: latencyRows
          .filter(row => row.bin !== null)
          .map(row => ({
            bin: Number(row.bin),
            count: Number(row.count)
        })),
        timeline: timelineRows.map(row => ({
          bucket: row.bucket,
          count: Number(row.count)
        })),
        aggregate
      };

      res.json({
        success: true,
        data: response
      });
    } catch (error) {
      console.error('获取测试运行汇总失败:', error);
      res.status(500).json({
        success: false,
        message: '获取测试运行汇总失败'
      });
    }
  }
];
