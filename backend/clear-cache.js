import { getPool } from './src/config/database.js';

async function clearFrontendCache() {
  const pool = getPool();

  try {
    console.log('🧹 开始清理前端缓存...');

    // 注意：由于这是后端脚本，无法直接删除浏览器localStorage
    // 这里我们创建一个前端脚本，用户需要在浏览器控制台执行

    console.log('📋 请在浏览器控制台执行以下代码来清理前端缓存：');
    console.log('');
    console.log('```javascript');
    console.log('// 清理模型配置缓存');
    console.log('localStorage.removeItem(\'modelConfig\');');
    console.log('');
    console.log('// 清理认证信息缓存（如果需要）');
    console.log('localStorage.removeItem(\'auth_token\');');
    console.log('localStorage.removeItem(\'auth_user\');');
    console.log('');
    console.log('// 验证清理结果');
    console.log('console.log(\'modelConfig:\', localStorage.getItem(\'modelConfig\'));');
    console.log('console.log(\'auth_token:\', localStorage.getItem(\'auth_token\'));');
    console.log('console.log(\'auth_user:\', localStorage.getItem(\'auth_user\'));');
    console.log('```');

    console.log('');
    console.log('🎯 清理完成后，请刷新页面重新登录，系统将自动从数据库加载API密钥。');

  } catch (error) {
    console.error('❌ 缓存清理脚本执行失败:', error.message);
  }
}

clearFrontendCache().then(() => {
  console.log('🏁 缓存清理脚本执行完成');
}).catch(err => {
  console.error('💥 脚本异常退出:', err);
});