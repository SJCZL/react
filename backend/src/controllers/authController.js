import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { getPool } from '../config/database.js';
import { generateToken } from '../middleware/auth.js';

export const register = [
  // 验证规则
  body('username')
    .isLength({ min: 3, max: 20 })
    .withMessage('用户名长度应为3-20个字符')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('用户名只能包含字母、数字和下划线'),
  body('email')
    .isEmail()
    .withMessage('请输入有效的邮箱地址')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('密码长度至少为6个字符'),

  body('confirmPassword')
    .optional(),

  async (req, res) => {
    try {
      // 检查验证结果
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: '输入数据验证失败',
          errors: errors.array()
        });
      }

      const { username, email, password, confirmPassword } = req.body;

      const pool = getPool();

      // 检查用户名是否已存在
      const [existingUsers] = await pool.execute(
        'SELECT id FROM users WHERE username = ? OR email = ?',
        [username, email]
      );

      if (existingUsers.length > 0) {
        return res.status(409).json({
          success: false,
          message: '用户名或邮箱已被注册'
        });
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 12);

      // 创建用户
      const [result] = await pool.execute(
        'INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, NOW())',
        [username, email, hashedPassword]
      );

      const userId = result.insertId;

      // 生成JWT令牌
      const token = generateToken({
        id: userId,
        username,
        email
      });

      res.status(201).json({
        success: true,
        message: '用户注册成功',
        data: {
          user: {
            id: userId,
            username,
            email
          },
          token
        }
      });

    } catch (error) {
      console.error('注册错误:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }
];

export const login = [
  // 验证规则
  body('username').notEmpty().withMessage('请输入用户名'),
  body('password').notEmpty().withMessage('请输入密码'),

  async (req, res) => {
    try {
      // 检查验证结果
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: '输入数据验证失败',
          errors: errors.array()
        });
      }

      const { username, password } = req.body;

      const pool = getPool();

      // 查找用户
      const [users] = await pool.execute(
        'SELECT id, username, email, password_hash FROM users WHERE username = ? OR email = ?',
        [username, username]
      );

      if (users.length === 0) {
        return res.status(401).json({
          success: false,
          message: '用户名或密码错误'
        });
      }

      const user = users[0];

      // 验证密码
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: '用户名或密码错误'
        });
      }

      // 生成JWT令牌
      const token = generateToken({
        id: user.id,
        username: user.username,
        email: user.email
      });

      res.json({
        success: true,
        message: '登录成功',
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email
          },
          token
        }
      });

    } catch (error) {
      console.error('登录错误:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误'
      });
    }
  }
];

export const getProfile = async (req, res) => {
  try {
    const pool = getPool();

    const [users] = await pool.execute(
      'SELECT id, username, email, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const user = users[0];

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          created_at: user.created_at
        }
      }
    });

  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};