import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../database.sqlite');
const db = new Database(dbPath);

console.log('='.repeat(60));
console.log('修复在线状态工具');
console.log('='.repeat(60));

try {
    // 检查字段是否存在
    console.log('\n1. 检查数据库字段...');
    const tableInfo = db.prepare("PRAGMA table_info(users)").all();
    const hasLastLogin = tableInfo.some(col => col.name === 'last_login_at');
    
    console.log(`   last_login_at: ${hasLastLogin ? '✅ 存在' : '❌ 不存在'}`);
    
    if (!hasLastLogin) {
        console.log('\n❌ 缺少必要字段，开始添加...');
        console.log('   添加 last_login_at 字段...');
        db.exec('ALTER TABLE users ADD COLUMN last_login_at DATETIME');
        console.log('   ✅ last_login_at 添加成功');
    }
    
    // 显示当前状态
    console.log('\n2. 当前用户登录记录:');
    const users = db.prepare(`
        SELECT username, last_login_at, created_at 
        FROM users 
        ORDER BY created_at DESC
    `).all();
    
    console.table(users.map(u => ({
        用户名: u.username,
        最后登录: u.last_login_at || '从未登录',
        注册时间: u.created_at
    })));
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ 修复完成！');
    console.log('='.repeat(60));
    console.log('\n💡 下一步：');
    console.log('   1. 重启服务器: pm2 restart st-manager');
    console.log('   2. 用户重新登录');
    console.log('   3. 查看管理员面板确认状态');
    console.log('');
    
} catch (error) {
    console.error('\n❌ 修复失败:', error);
    console.error('   详情:', error.message);
    process.exit(1);
} finally {
    db.close();
}
