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
    await connection.query(migrationSQL);

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

-- 创建索引以提高查询性能
CREATE INDEX idx_user_prompts_user_id ON user_prompts(user_id);
CREATE INDEX idx_user_prompts_updated_at ON user_prompts(updated_at);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
`;

// 写入迁移文件
const migrationFilePath = path.join(migrationsDir, 'migrations.sql');
fs.writeFileSync(migrationFilePath, migrationSQL.trim());

console.log('🚀 开始数据库初始化...');
initDatabase();