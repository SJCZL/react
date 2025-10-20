import { getPool } from './src/config/database.js';

async function checkUserPrompts() {
  const pool = getPool();

  try {
    console.log('📋 检查 user_prompts 表的所有数据...\n');

    // 获取所有记录
    const [prompts] = await pool.execute('SELECT * FROM user_prompts ORDER BY user_id, id');

    console.log(`总记录数: ${prompts.length}\n`);

    // 按用户分组显示
    const userGroups = {};
    prompts.forEach(prompt => {
      if (!userGroups[prompt.user_id]) {
        userGroups[prompt.user_id] = [];
      }
      userGroups[prompt.user_id].push(prompt);
    });

    for (const [userId, userPrompts] of Object.entries(userGroups)) {
      console.log(`👤 用户 ID: ${userId} (${userPrompts.length} 个提示词)`);

      userPrompts.forEach((prompt, index) => {
        console.log(`  ${index + 1}. ID: ${prompt.id}`);
        console.log(`     名称: ${prompt.name}`);
        console.log(`     描述: ${prompt.description || '无'}`);
        console.log(`     标签: ${JSON.stringify(prompt.tabs)}`);
        console.log(`     文本框: ${JSON.stringify(prompt.textboxes)}`);
        console.log(`     创建时间: ${prompt.created_at}`);
        console.log(`     更新时间: ${prompt.updated_at}`);
        console.log(`     文本长度: ${prompt.text.length} 字符`);
        console.log('');
      });
    }

    // 检查特定用户的查询
    console.log('🔍 测试用户 ID=2 的查询...\n');

    const testQuery = `
      SELECT id, name, description, tabs, textboxes, text, created_at, updated_at
      FROM user_prompts
      WHERE user_id = ?
      ORDER BY updated_at DESC LIMIT 10 OFFSET 0
    `;

    console.log('执行查询:', testQuery.replace('?', '2'));

    const [testResults] = await pool.execute(testQuery, [2]);

    console.log(`查询结果: ${testResults.length} 条记录`);

    if (testResults.length > 0) {
      console.log('前3条结果:');
      testResults.slice(0, 3).forEach((result, i) => {
        console.log(`  ${i + 1}. ${result.name} (ID: ${result.id})`);
      });
    }

  } catch (error) {
    console.error('❌ 检查失败:', error.message);
    console.error('错误详情:', error);
  } finally {
    process.exit(0);
  }
}

checkUserPrompts();