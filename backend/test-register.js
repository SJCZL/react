import { getPool } from './src/config/database.js';
import bcrypt from 'bcryptjs';

async function testRegister() {
  console.log('🧪 开始测试注册功能...\n');

  const pool = getPool();

  try {
    // 测试数据
    const testUser = {
      username: 'test222',
      email: 'test222@example.com',
      password: '12345678'
    };

    console.log('📝 测试数据:', {
      username: testUser.username,
      email: testUser.email,
      password: '[HIDDEN]'
    });

    // 检查是否已存在
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [testUser.username, testUser.email]
    );

    console.log('🔍 检查是否已存在:', existingUsers.length > 0 ? '存在，跳过' : '不存在，继续');

    if (existingUsers.length > 0) {
      console.log('❌ 用户已存在，测试结束');
      return;
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(testUser.password, 12);
    console.log('🔐 密码加密完成');

    // 插入用户
    console.log('💾 准备插入用户...');
    const [result] = await pool.execute(
      'INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, NOW())',
      [testUser.username, testUser.email, hashedPassword]
    );

    const userId = result.insertId;
    console.log('✅ 用户插入成功，ID:', userId);

    // 验证插入
    const [verifyUser] = await pool.execute(
      'SELECT id, username, email, created_at FROM users WHERE id = ?',
      [userId]
    );

    console.log('🔍 验证插入结果:', verifyUser[0]);

    // 再次检查总数
    const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM users');
    console.log('📊 用户总数:', countResult[0].total);

    console.log('🎉 注册测试成功完成！');

  } catch (error) {
    console.error('❌ 注册测试失败:', error.message);
    console.error('详细错误:', error);
  }
}

testRegister().then(() => {
  console.log('🏁 测试完成');
  process.exit(0);
}).catch(err => {
  console.error('💥 测试异常退出:', err);
  process.exit(1);
});