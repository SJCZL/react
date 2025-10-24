import db from '../config/database.js';

const pool = db();

/**
 * 获取用户的API密钥列表
 */
export const getApiKeys = async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT id, provider, api_key, created_at, updated_at
      FROM user_api_keys
      WHERE user_id = ?
      ORDER BY updated_at DESC
    `;

    const [rows] = await pool.execute(query, [userId]);

    // 隐藏实际的API密钥，只返回部分信息用于前端显示
    const apiKeys = rows.map(key => ({
      id: key.id,
      provider: key.provider,
      masked_key: `****${key.api_key.slice(-4)}`,
      created_at: key.created_at,
      updated_at: key.updated_at
    }));

    res.json({
      success: true,
      data: apiKeys
    });
  } catch (error) {
    console.error('获取API密钥失败:', error);
    res.status(500).json({
      success: false,
      message: '获取API密钥失败'
    });
  }
};

/**
 * 获取指定提供商的API密钥
 */
export const getApiKey = async (req, res) => {
  try {
    const userId = req.user.id;
    const { provider } = req.params;

    const query = `
      SELECT api_key
      FROM user_api_keys
      WHERE user_id = ? AND provider = ?
    `;

    const [rows] = await pool.execute(query, [userId, provider]);

    if (rows.length === 0) {
      return res.json({
        success: true,
        data: { api_key: '' }
      });
    }

    res.json({
      success: true,
      data: { api_key: rows[0].api_key }
    });
  } catch (error) {
    console.error('获取API密钥失败:', error);
    res.status(500).json({
      success: false,
      message: '获取API密钥失败'
    });
  }
};

/**
 * 保存API密钥
 */
export const saveApiKey = async (req, res) => {
  try {
    const userId = req.user.id;
    const { provider, api_key } = req.body;

    if (!provider || !api_key) {
      return res.status(400).json({
        success: false,
        message: '提供商和API密钥都是必需的'
      });
    }

    // 先检查是否已存在
    const checkQuery = `
      SELECT id FROM user_api_keys
      WHERE user_id = ? AND provider = ?
    `;

    const [existing] = await pool.execute(checkQuery, [userId, provider]);

    if (existing.length > 0) {
      // 更新现有记录
      const updateQuery = `
        UPDATE user_api_keys
        SET api_key = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND provider = ?
      `;
      await pool.execute(updateQuery, [api_key, userId, provider]);
    } else {
      // 插入新记录
      const insertQuery = `
        INSERT INTO user_api_keys (user_id, provider, api_key)
        VALUES (?, ?, ?)
      `;
      await pool.execute(insertQuery, [userId, provider, api_key]);
    }

    res.json({
      success: true,
      message: 'API密钥保存成功'
    });
  } catch (error) {
    console.error('保存API密钥失败:', error);
    res.status(500).json({
      success: false,
      message: '保存API密钥失败'
    });
  }
};

/**
 * 删除API密钥
 */
export const deleteApiKey = async (req, res) => {
  try {
    const userId = req.user.id;
    const { provider } = req.params;

    const query = `
      DELETE FROM user_api_keys
      WHERE user_id = ? AND provider = ?
    `;

    const [result] = await pool.execute(query, [userId, provider]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'API密钥不存在'
      });
    }

    res.json({
      success: true,
      message: 'API密钥删除成功'
    });
  } catch (error) {
    console.error('删除API密钥失败:', error);
    res.status(500).json({
      success: false,
      message: '删除API密钥失败'
    });
  }
};