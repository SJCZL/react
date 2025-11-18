import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection, getPool } from './config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 路由
import authRoutes from './routes/auth.js';
import promptRoutes from './routes/prompts.js';
import apiKeyRoutes from './routes/api-keys.js';
import experimentRoutes from './routes/experiments.js';
import testRunRoutes from './routes/test-runs.js';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8000',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 请求日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/prompts', promptRoutes);
app.use('/api/api-keys', apiKeyRoutes);
app.use('/api/experiments', experimentRoutes);
app.use('/api/test-runs', testRunRoutes);

// 健康检查路由
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '服务器运行正常',
    timestamp: new Date().toISOString()
  });
});

// 404 处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误'
  });
});

// 启动服务器
const startServer = async () => {
  try {
    // 测试数据库连接
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ 数据库连接失败，请检查数据库配置');
      process.exit(1);
    }

    // 运行数据库迁移（确保必要的表存在）
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const migrationsPath = path.resolve(__dirname, '../database/migrations.sql');
      if (fs.existsSync(migrationsPath)) {
        const sqlRaw = fs.readFileSync(migrationsPath, 'utf8');
        // Remove full-line comments and inline trailing comments (starting with --)
        const cleaned = sqlRaw
          .split('\n')
          .map(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('--')) return '';
            const idx = line.indexOf('--');
            return idx >= 0 ? line.slice(0, idx) : line;
          })
          .join('\n');
        const statements = cleaned
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0);
        const pool = getPool();
        for (const stmt of statements) {
          try {
            await pool.query(stmt);
          } catch (e) {
            const msg = String(e?.message || '').toLowerCase();
            if (msg.includes('duplicate') || msg.includes('already exists')) {
              continue;
            }
            throw e;
          }
        }
        console.log('数据库迁移检查完成');
      }
    } catch (mErr) {
      console.error('运行数据库迁移失败:', mErr);
      process.exit(1);
    }

    app.listen(PORT, () => {
      console.log(`🚀 服务器已启动，监听端口 ${PORT}`);
      console.log(`📊 健康检查: http://localhost:${PORT}/health`);
      console.log(`🔐 认证API: http://localhost:${PORT}/api/auth`);
      console.log(`📝 提示词API: http://localhost:${PORT}/api/prompts`);
      console.log(`🔑 API密钥API: http://localhost:${PORT}/api/api-keys`);
      console.log(`🧪 测试运行API: http://localhost:${PORT}/api/test-runs`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
};

startServer();

export default app;
