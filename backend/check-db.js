import { getPool } from './src/config/database.js';

async function checkDatabase() {
  const pool = getPool();

  try {
    console.log('📋 检查数据库表结构...\n');

    // 显示所有表
    const [tables] = await pool.execute('SHOW TABLES');
    console.log('📋 数据库中的表:');
    tables.forEach((row, index) => {
      console.log(`${index + 1}. ${Object.values(row)[0]}`);
    });

    console.log('\n' + '='.repeat(50) + '\n');

    // 检查每个表的结构
    for (const row of tables) {
      const tableName = Object.values(row)[0];
      console.log(`📋 表: ${tableName}`);

      // 显示表结构
      const [columns] = await pool.execute(`DESCRIBE ${tableName}`);
      console.log('  字段:');
      columns.forEach(col => {
        console.log(`    - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : ''} ${col.Key ? `(${col.Key})` : ''} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
      });

      // 显示索引
      const [indexes] = await pool.execute(`SHOW INDEX FROM ${tableName}`);
      if (indexes.length > 0) {
        console.log('  索引:');
        indexes.forEach(idx => {
          console.log(`    - ${idx.Key_name}: ${idx.Column_name} (${idx.Index_type})`);
        });
      }

      // 显示记录数
      const [count] = await pool.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
      console.log(`  记录数: ${count[0].count}`);

      // 显示前几条记录（如果有）
      if (count[0].count > 0) {
        const [records] = await pool.execute(`SELECT * FROM ${tableName} LIMIT 3`);
        console.log('  示例记录:');
        records.forEach((record, i) => {
          console.log(`    ${i + 1}.`, record);
        });
      }

      console.log('');
    }

  } catch (error) {
    console.error('❌ 数据库检查失败:', error.message);
  } finally {
    process.exit(0);
  }
}

checkDatabase();