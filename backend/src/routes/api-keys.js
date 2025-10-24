import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getApiKeys,
  getApiKey,
  saveApiKey,
  deleteApiKey
} from '../controllers/apiKeyController.js';

const router = express.Router();

// 所有路由都需要认证
router.use(authenticateToken);

// 支持JSON和表单数据
router.use(express.urlencoded({ extended: true }));
router.use(express.json());

// 获取用户的API密钥列表
router.get('/', getApiKeys);

// 获取指定提供商的API密钥
router.get('/:provider', getApiKey);

// 保存API密钥
router.post('/', saveApiKey);

// 删除API密钥
router.delete('/:provider', deleteApiKey);

export default router;