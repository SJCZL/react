import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'prompt_system'
};

async function checkApiKeysTable() {
  let connection;

  try {
    console.log('🔄 连接到数据库...');
    connection = await mysql.createConnection(dbConfig);

    // 检查user_api_keys表是否存在
    const [tables] = await connection.execute("SHOW TABLES LIKE 'user_api_keys'");
    if (tables.length > 0) {
      console.log('✅ user_api_keys表已存在');

      // 显示表结构
      const [columns] = await connection.execute('DESCRIBE user_api_keys');
      console.log('📋 表结构:');
      columns.forEach(col => {
        console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : ''} ${col.Key ? `(${col.Key})` : ''}`);
      });
    } else {
      console.log('❌ user_api_keys表不存在，正在创建...');

      // 创建表
      await connection.execute(`
        CREATE TABLE user_api_keys (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          provider VARCHAR(50) NOT NULL,
          api_key VARCHAR(500) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE KEY unique_user_provider (user_id, provider)
        )
      `);

      console.log('✅ user_api_keys表创建成功');

      // 创建索引
      await connection.execute('CREATE INDEX idx_user_api_keys_user_id ON user_api_keys(user_id)');
      await connection.execute('CREATE INDEX idx_user_api_keys_provider ON user_api_keys(provider)');

      console.log('✅ 索引创建成功');
    }

    // 显示所有表
    const [allTables] = await connection.execute('SHOW TABLES');
    console.log('📋 数据库中的所有表:');
    allTables.forEach(table => {
      console.log(`  - ${Object.values(table)[0]}`);
    });

  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkApiKeysTable();