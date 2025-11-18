import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true
};

async function initDatabase() {
  let connection;

  try {
    console.log('🔄 正在连接到MySQL服务器...');
    connection = await mysql.createConnection(dbConfig);

    const databaseName = process.env.DB_NAME || 'prompt_system';

    // 创建数据库（如果不存在）
    console.log(`📦 创建数据库 "${databaseName}"...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

    // 切换到数据库
    await connection.query(`USE \`${databaseName}\``);

    // 读取并执行SQL迁移文件
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations.sql');
    console.log('📄 读取数据库迁移文件...');

    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ 迁移文件不存在: ${migrationPath}`);
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('⚡ 执行数据库迁移...');
    try {
      await connection.query(migrationSQL);
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('ℹ️ 索引已存在，跳过创建');
      } else {
        throw error;
      }
    }

    console.log('✅ 数据库初始化完成！');

    // 验证表是否创建成功
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('📋 已创建的表:', tables.map(row => Object.values(row)[0]));

  } catch (error) {
    console.error('❌ 数据库初始化失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 创建database/migrations目录
const migrationsDir = path.join(__dirname, '..', 'database');
if (!fs.existsSync(migrationsDir)) {
  fs.mkdirSync(migrationsDir, { recursive: true });
}

// 创建迁移文件
const migrationSQL = `
-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 用户提示词表
CREATE TABLE IF NOT EXISTS user_prompts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  tabs JSON,
  textboxes JSON,
  text LONGTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_prompt (user_id, name)
);

-- 用户API密钥表
CREATE TABLE IF NOT EXISTS user_api_keys (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  provider VARCHAR(50) NOT NULL,
  api_key VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_provider (user_id, provider)
);

-- 创建索引以提高查询性能
CREATE INDEX idx_user_prompts_user_id ON user_prompts(user_id);
CREATE INDEX idx_user_prompts_updated_at ON user_prompts(updated_at);
CREATE INDEX idx_user_api_keys_user_id ON user_api_keys(user_id);
CREATE INDEX idx_user_api_keys_provider ON user_api_keys(provider);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

-- 实验结果存档表（按预设、按模型聚合的统计结果）
CREATE TABLE IF NOT EXISTS experiment_results (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  preset_id INT NOT NULL,
  models JSON NOT NULL,
  statistics LONGTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 创建索引（实验结果）
CREATE INDEX idx_experiment_preset_id ON experiment_results(preset_id);
CREATE INDEX idx_experiment_user_id ON experiment_results(user_id);
CREATE INDEX idx_experiment_created_at ON experiment_results(created_at);

-- 并行测试运行记录
CREATE TABLE IF NOT EXISTS test_runs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  name VARCHAR(255),
  preset_id INT,
  models JSON,
  total_cases INT DEFAULT 0,
  status ENUM('pending', 'running', 'completed', 'failed') DEFAULT 'pending',
  metadata JSON,
  started_at TIMESTAMP NULL DEFAULT NULL,
  ended_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_test_runs_user_id ON test_runs(user_id);
CREATE INDEX idx_test_runs_status ON test_runs(status);
CREATE INDEX idx_test_runs_preset_id ON test_runs(preset_id);

-- 并行测试用例数据
CREATE TABLE IF NOT EXISTS test_cases (
  id INT PRIMARY KEY AUTO_INCREMENT,
  test_run_id INT NOT NULL,
  model VARCHAR(100) NOT NULL,
  prompt_ref VARCHAR(255),
  passed TINYINT(1) DEFAULT 0,
  severity ENUM('inform', 'warning', 'error', 'fatal', 'unlisted') DEFAULT 'unlisted',
  error_type VARCHAR(150),
  error_message TEXT,
  turn_count INT DEFAULT 0,
  latency_ms INT,
  input_tokens INT,
  output_tokens INT,
  cost DECIMAL(12,6),
  worker_id VARCHAR(100),
  meta JSON,
  started_at TIMESTAMP NULL DEFAULT NULL,
  ended_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (test_run_id) REFERENCES test_runs(id) ON DELETE CASCADE
);

CREATE INDEX idx_test_cases_run_id ON test_cases(test_run_id);
CREATE INDEX idx_test_cases_run_model ON test_cases(test_run_id, model);
CREATE INDEX idx_test_cases_run_error ON test_cases(test_run_id, error_type);
CREATE INDEX idx_test_cases_run_severity ON test_cases(test_run_id, severity);
`;

// 写入迁移文件
const migrationFilePath = path.join(migrationsDir, 'migrations.sql');
fs.writeFileSync(migrationFilePath, migrationSQL.trim());

console.log('🚀 开始数据库初始化...');
initDatabase();
