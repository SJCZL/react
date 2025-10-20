import express from 'express';
import { register, login, getProfile } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// 支持JSON和表单数据
router.use(express.urlencoded({ extended: true }));
router.use(express.json());

// 注册路由
router.post('/register', register);

// 登录路由
router.post('/login', login);

// 获取用户信息路由（需要认证）
router.get('/profile', authenticateToken, getProfile);

export default router;