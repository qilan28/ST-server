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
    const hasIsOnline = tableInfo.some(col => col.name === 'is_online');
    
    console.log(`   last_login_at: ${hasLastLogin ? '✅ 存在' : '❌ 不存在'}`);
    console.log(`   is_online: ${hasIsOnline ? '✅ 存在' : '❌ 不存在'}`);
    
    if (!hasLastLogin || !hasIsOnline) {
        console.log('\n❌ 缺少必要字段，开始添加...');
        
        if (!hasLastLogin) {
            console.log('   添加 last_login_at 字段...');
            db.exec('ALTER TABLE users ADD COLUMN last_login_at DATETIME');
            console.log('   ✅ last_login_at 添加成功');
        }
        
        if (!hasIsOnline) {
            console.log('   添加 is_online 字段...');
            db.exec('ALTER TABLE users ADD COLUMN is_online INTEGER DEFAULT 0');
            console.log('   ✅ is_online 添加成功');
        }
    }
    
    // 显示当前状态
    console.log('\n2. 当前用户状态:');
    const users = db.prepare(`
        SELECT username, is_online, last_login_at, created_at 
        FROM users 
        ORDER BY created_at DESC
    `).all();
    
    console.table(users.map(u => ({
        用户名: u.username,
        在线状态: u.is_online === 1 ? '🟢 在线' : '⚫ 离线',
        最后登录: u.last_login_at || '从未登录',
        注册时间: u.created_at
    })));
    
    // 提供修复选项
    console.log('\n3. 修复选项:');
    console.log('   [1] 将所有用户设置为离线（推荐）');
    console.log('   [2] 将所有用户设置为在线（仅用于测试）');
    console.log('   [3] 手动指定用户状态');
    console.log('');
    
    // 执行默认修复：将所有用户设置为离线
    console.log('执行默认操作：将所有用户设置为离线...');
    const result = db.prepare('UPDATE users SET is_online = 0').run();
    console.log(`✅ 已更新 ${result.changes} 个用户为离线状态`);
    
    // 显示修复后状态
    console.log('\n4. 修复后状态:');
    const usersAfter = db.prepare(`
        SELECT username, is_online, last_login_at 
        FROM users 
        ORDER BY created_at DESC
    `).all();
    
    console.table(usersAfter.map(u => ({
        用户名: u.username,
        在线状态: u.is_online === 1 ? '🟢 在线' : '⚫ 离线',
        最后登录: u.last_login_at || '从未登录'
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
