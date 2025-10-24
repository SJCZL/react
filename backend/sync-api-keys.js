import { getPool } from './src/config/database.js';

async function syncApiKeysToUser() {
  const pool = getPool();
  const userId = 2; // wss37用户的ID

  // 从本地存储读取缓存的API密钥数据
  // 注意：这里需要通过浏览器控制台执行获取数据，然后手动填入
  const cachedApiKeys = {
    aliyun: 'sk-1234567890abcdef',
    openai: 'sk-proj-1234567890abcdef',
    claude: 'sk-ant-api03-1234567890abcdef',
    gemini: 'AIzaSyD1234567890abcdef',
    deepseek: 'sk-1234567890abcdef',
    zhipu: '1234567890abcdef',
    doubao: 'db-1234567890abcdef'
  };

  console.log('🎯 开始为用户ID 2 (wss37) 同步API密钥...');
  console.log('📝 将要保存的API密钥:', cachedApiKeys);

  try {
    // 清空用户现有的API密钥
    await pool.execute('DELETE FROM user_api_keys WHERE user_id = ?', [userId]);
    console.log('🗑️ 已清空用户现有的API密钥');

    // 插入新的API密钥
    for (const [provider, apiKey] of Object.entries(cachedApiKeys)) {
      await pool.execute(
        'INSERT INTO user_api_keys (user_id, provider, api_key) VALUES (?, ?, ?)',
        [userId, provider, apiKey]
      );
      console.log(`✅ 已保存 ${provider} 的API密钥`);
    }

    // 验证插入结果
    const [results] = await pool.execute(
      'SELECT provider, LEFT(api_key, 10) as api_key_prefix FROM user_api_keys WHERE user_id = ?',
      [userId]
    );

    console.log('🔍 验证插入结果:');
    results.forEach(row => {
      console.log(`  ${row.provider}: ${row.api_key_prefix}...`);
    });

    console.log('🎉 API密钥同步完成！');

  } catch (error) {
    console.error('❌ 同步失败:', error.message);
  }
}

syncApiKeysToUser().then(() => {
  console.log('🏁 同步脚本执行完成');
  process.exit(0);
}).catch(err => {
  console.error('💥 脚本异常退出:', err);
  process.exit(1);
});