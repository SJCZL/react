import { body, validationResult } from 'express-validator';
import { getPool } from '../config/database.js';

export const getUserPrompts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, search = '', tab = '', textbox = '' } = req.query;

    const pool = getPool();
    let query = `
      SELECT id, name, description, tabs, textboxes, text, created_at, updated_at
      FROM user_prompts
      WHERE user_id = ?
    `;
    let params = [Number(userId)];
    let conditions = [];

    // 搜索条件
    if (search) {
      conditions.push('(name LIKE ? OR description LIKE ? OR text LIKE ?)');
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (tab) {
      conditions.push('JSON_CONTAINS(tabs, ?)');
      params.push(`"${tab}"`);
    }

    if (textbox) {
      conditions.push('JSON_CONTAINS(textboxes, ?)');
      params.push(`"${textbox}"`);
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    query += ' ORDER BY updated_at DESC';

    // 分页 - 使用模板字符串而不是占位符
    const offset = (parseInt(page) - 1) * parseInt(limit);
    if (offset > 0) {
      query += ` LIMIT ${parseInt(limit)} OFFSET ${offset}`;
    } else {
      query += ` LIMIT ${parseInt(limit)}`;
    }

    console.log('SQL:', query);
    console.log('Params:', params);

    const [prompts] = await pool.execute(query, params);

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM user_prompts WHERE user_id = ?';
    let countParams = [Number(userId)];

    if (conditions.length > 0) {
      countQuery += ' AND ' + conditions.join(' AND ');
      // 搜索参数在 params.slice(1, params.length)
      countParams = countParams.concat(params.slice(1));
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        prompts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('获取用户提示词错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

export const getPromptById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const pool = getPool();
    const [prompts] = await pool.execute(
      'SELECT id, name, description, tabs, textboxes, text, created_at, updated_at FROM user_prompts WHERE id = ? AND user_id = ?',
      [id, Number(userId)]
    );

    if (prompts.length === 0) {
      return res.status(404).json({
        success: false,
        message: '提示词不存在'
      });
    }

    res.json({
      success: true,
      data: { prompt: prompts[0] }
    });

  } catch (error) {
    console.error('获取提示词详情错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

export const createPrompt = [
  // 验证规则
  body('name').notEmpty().withMessage('提示词名称不能为空'),
  body('text').notEmpty().withMessage('提示词内容不能为空'),
  body('tabs').isArray().withMessage('标签必须是数组'),
  body('textboxes').isArray().withMessage('文本框必须是数组'),

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: '输入数据验证失败',
          errors: errors.array()
        });
      }

      const { name, description = '', tabs, textboxes, text } = req.body;
      const userId = req.user.id;

      const pool = getPool();

      // 检查名称是否重复
      const [existing] = await pool.execute(
        'SELECT id FROM user_prompts WHERE user_id = ? AND name = ?',
        [Number(userId), name]
      );

      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          message: '提示词名称已存在'
        });
      }

      const [result] = await pool.execute(
        'INSERT INTO user_prompts (user_id, name, description, tabs, textboxes, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
        [Number(userId), name, description, JSON.stringify(tabs), JSON.stringify(textboxes), text]
      );

      res.status(201).json({
        success: true,
        message: '提示词创建成功',
        data: {
          prompt: {
            id: result.insertId,
            name,
            description,
            tabs,
            textboxes,
            text
          }
        }
      });

    } catch (error) {
      console.error('创建提示词错误:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }
];

export const updatePrompt = [
  // 验证规则
  body('name').optional().notEmpty().withMessage('提示词名称不能为空'),
  body('text').optional().notEmpty().withMessage('提示词内容不能为空'),
  body('tabs').optional().isArray().withMessage('标签必须是数组'),
  body('textboxes').optional().isArray().withMessage('文本框必须是数组'),

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: '输入数据验证失败',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const userId = req.user.id;
      const updates = req.body;

      const pool = getPool();

      // 检查提示词是否存在
      const [existing] = await pool.execute(
        'SELECT id FROM user_prompts WHERE id = ? AND user_id = ?',
        [id, Number(userId)]
      );

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          message: '提示词不存在'
        });
      }

      // 如果更新名称，检查是否与其他提示词重复
      if (updates.name) {
        const [nameCheck] = await pool.execute(
          'SELECT id FROM user_prompts WHERE user_id = ? AND name = ? AND id != ?',
          [Number(userId), updates.name, id]
        );

        if (nameCheck.length > 0) {
          return res.status(409).json({
            success: false,
            message: '提示词名称已存在'
          });
        }
      }

      // 构建更新语句
      const updateFields = [];
      const params = [];

      Object.keys(updates).forEach(key => {
        if (['tabs', 'textboxes'].includes(key)) {
          updateFields.push(`${key} = ?`);
          params.push(JSON.stringify(updates[key]));
        } else if (['name', 'description', 'text'].includes(key)) {
          updateFields.push(`${key} = ?`);
          params.push(updates[key]);
        }
      });

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          message: '没有需要更新的字段'
        });
      }

      updateFields.push('updated_at = NOW()');
      params.push(id, Number(userId));

      const query = `UPDATE user_prompts SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`;

      await pool.execute(query, params);

      res.json({
        success: true,
        message: '提示词更新成功'
      });

    } catch (error) {
      console.error('更新提示词错误:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }
];

export const deletePrompt = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const pool = getPool();

    const [result] = await pool.execute(
      'DELETE FROM user_prompts WHERE id = ? AND user_id = ?',
      [id, Number(userId)]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '提示词不存在'
      });
    }

    res.json({
      success: true,
      message: '提示词删除成功'
    });

  } catch (error) {
    console.error('删除提示词错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

export const exportPrompts = async (req, res) => {
  try {
    const userId = req.user.id;

    const pool = getPool();
    const [prompts] = await pool.execute(
      'SELECT name, description, tabs, textboxes, text FROM user_prompts WHERE user_id = ? ORDER BY updated_at DESC',
      [Number(userId)]
    );

    // 转换数据格式以匹配前端期望
    const exportData = {
      presets: prompts.map(p => ({
        name: p.name,
        description: p.description,
        tabs: JSON.parse(p.tabs || '[]'),
        textboxes: JSON.parse(p.textboxes || '[]'),
        text: p.text
      })),
      exportDate: new Date().toISOString(),
      version: '1.0'
    };

    res.json({
      success: true,
      data: exportData
    });

  } catch (error) {
    console.error('导出提示词错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

export const importPrompts = [
  body('presets').isArray().withMessage('预设数据必须是数组'),

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: '输入数据验证失败',
          errors: errors.array()
        });
      }

      const { presets } = req.body;
      const userId = req.user.id;

      const pool = getPool();

      // 开始事务
      const connection = await pool.getConnection();
      await connection.beginTransaction();

      try {
        for (const preset of presets) {
          // 检查是否已存在相同名称的提示词
          const [existing] = await connection.execute(
            'SELECT id FROM user_prompts WHERE user_id = ? AND name = ?',
            [Number(userId), preset.name]
          );

          if (existing.length > 0) {
            // 更新现有提示词
            await connection.execute(
              'UPDATE user_prompts SET description = ?, tabs = ?, textboxes = ?, text = ?, updated_at = NOW() WHERE user_id = ? AND name = ?',
              [
                preset.description || '',
                JSON.stringify(preset.tabs || []),
                JSON.stringify(preset.textboxes || []),
                preset.text || '',
                Number(userId),
                preset.name
              ]
            );
          } else {
            // 创建新提示词
            await connection.execute(
              'INSERT INTO user_prompts (user_id, name, description, tabs, textboxes, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
              [
                Number(userId),
                preset.name,
                preset.description || '',
                JSON.stringify(preset.tabs || []),
                JSON.stringify(preset.textboxes || []),
                preset.text || ''
              ]
            );
          }
        }

        await connection.commit();

        res.json({
          success: true,
          message: `成功导入 ${presets.length} 个提示词`
        });

      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

    } catch (error) {
      console.error('导入提示词错误:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }
];