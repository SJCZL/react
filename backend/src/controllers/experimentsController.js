import { validationResult, body, query, param } from 'express-validator';
import { getPool } from '../config/database.js';

export const validateCreate = [
  body('preset_id').isInt({ min: 1 }).withMessage('preset_id 必须为正整数'),
  body('models').isArray({ min: 1 }).withMessage('models 必须为数组'),
  body('statistics').notEmpty().withMessage('statistics 不能为空'),
];

export const createExperiment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '输入数据验证失败', errors: errors.array() });
    }

    const userId = req.user.id;
    const { preset_id, models, statistics } = req.body;

    const pool = getPool();
    const [result] = await pool.execute(
      'INSERT INTO experiment_results (user_id, preset_id, models, statistics, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
      [Number(userId), Number(preset_id), JSON.stringify(models), JSON.stringify(statistics)]
    );

    return res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    console.error('保存实验结果失败:', error);
    return res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

export const validateList = [
  query('preset_id').isInt({ min: 1 }).withMessage('preset_id 必须提供'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit 不合法'),
  query('offset').optional().isInt({ min: 0 }).withMessage('offset 不合法'),
];

export const listExperiments = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '输入数据验证失败', errors: errors.array() });
    }

    // 强制转换并校验数值，避免 MySQL 预处理参数类型错误
    const userId = Number(req.user?.id);
    const presetId = Number.parseInt(req.query.preset_id, 10);
    const limit = Number.parseInt(req.query.limit || '10', 10);
    const offset = Number.parseInt(req.query.offset || '0', 10);

    if (!Number.isFinite(userId)) {
      return res.status(401).json({ success: false, message: '未授权用户' });
    }
    if (!Number.isFinite(presetId) || !Number.isFinite(limit) || !Number.isFinite(offset)) {
      return res.status(400).json({ success: false, message: '参数解析失败' });
    }

    const pool = getPool();
    // 避免部分 MySQL 版本对 LIMIT/OFFSET 占位符报错，limit/offset 直接插值（已做数值校验）
    const sql = `
      SELECT id, user_id, preset_id, models, statistics, created_at, updated_at
      FROM experiment_results
      WHERE user_id = ? AND preset_id = ?
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const [rows] = await pool.execute(sql, [userId, presetId]);

    const items = rows.map(r => ({
      id: r.id,
      preset_id: r.preset_id,
      models: safeParseJSON(r.models, []),
      statistics: safeParseJSON(r.statistics, {}),
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    return res.json({ success: true, items });
  } catch (error) {
    console.error('获取实验结果失败:', error);
    return res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

export const validateDelete = [
  param('id').isInt({ min: 1 }).withMessage('id 不合法'),
];

export const deleteExperiment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: '输入数据验证失败', errors: errors.array() });
    }

    const userId = req.user.id;
    const id = Number(req.params.id);

    const pool = getPool();
    const [ret] = await pool.execute(
      'DELETE FROM experiment_results WHERE id = ? AND user_id = ?',
      [id, Number(userId)]
    );

    if (ret.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('删除实验结果失败:', error);
    return res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

function safeParseJSON(text, fallback) {
  try { return JSON.parse(text); } catch { return fallback; }
}
