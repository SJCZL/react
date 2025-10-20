import { getPool } from './src/config/database.js';

async function debugQuery() {
  const pool = getPool();

  try {
    console.log('🔧 调试查询参数...\n');

    // 模拟前端发送的请求参数
    const userId = 2; // 从JWT中获取
    const page = 1;
    const limit = 10;
    const search = '';
    const tab = '';
    const textbox = '';

    console.log('输入参数:');
    console.log(`  userId: ${userId} (类型: ${typeof userId})`);
    console.log(`  page: ${page} (类型: ${typeof page})`);
    console.log(`  limit: ${limit} (类型: ${typeof limit})`);
    console.log(`  search: '${search}'`);
    console.log(`  tab: '${tab}'`);
    console.log(`  textbox: '${textbox}'`);
    console.log('');

    // 构建查询 - 复制controller中的逻辑
    let query = `
      SELECT id, name, description, tabs, textboxes, text, created_at, updated_at
      FROM user_prompts
      WHERE user_id = ?
    `;
    let params = [Number(userId)];
    let conditions = [];

    // 搜索条件
    if (search) {
      conditions.push('(name LIKE ? OR description LIKE ? OR text LIKE ?)');
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (tab) {
      conditions.push('JSON_CONTAINS(tabs, ?)');
      params.push(`"${tab}"`);
    }

    if (textbox) {
      conditions.push('JSON_CONTAINS(textboxes, ?)');
      params.push(`"${textbox}"`);
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    query += ' ORDER BY updated_at DESC';

    // 分页 - 使用模板字符串而不是占位符
    const offset = (parseInt(page) - 1) * parseInt(limit);
    if (offset > 0) {
      query += ` LIMIT ${parseInt(limit)} OFFSET ${offset}`;
    } else {
      query += ` LIMIT ${parseInt(limit)}`;
    }

    console.log('最终SQL查询:');
    console.log(query);
    console.log('');
    console.log('参数数组:');
    console.log(params);
    console.log('');
    console.log('参数详情:');
    params.forEach((param, index) => {
      console.log(`  [${index}]: ${param} (类型: ${typeof param})`);
    });
    console.log('');

    // 执行查询
    console.log('执行查询...');
    const [prompts] = await pool.execute(query, params);
    console.log(`查询成功！返回 ${prompts.length} 条记录`);

    if (prompts.length > 0) {
      console.log('第一条记录:');
      console.log(prompts[0]);
    }

  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    console.error('错误详情:', error);
  } finally {
    process.exit(0);
  }
}

debugQuery();