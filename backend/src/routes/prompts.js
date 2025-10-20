import express from 'express';
import {
  getUserPrompts,
  getPromptById,
  createPrompt,
  updatePrompt,
  deletePrompt,
  exportPrompts,
  importPrompts
} from '../controllers/promptController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// 所有提示词路由都需要认证
router.use(authenticateToken);

// 获取用户提示词列表
router.get('/', getUserPrompts);

// 获取单个提示词详情
router.get('/:id', getPromptById);

// 创建新提示词
router.post('/', createPrompt);

// 更新提示词
router.put('/:id', updatePrompt);

// 删除提示词
router.delete('/:id', deletePrompt);

// 导出提示词
router.get('/export/all', exportPrompts);

// 导入提示词
router.post('/import', importPrompts);

export default router;