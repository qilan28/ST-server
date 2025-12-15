import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../database.sqlite');
const db = new Database(dbPath);

console.log('='.repeat(60));
console.log('强制更新所有用户的最后登录时间');
console.log('='.repeat(60));

try {
    // 1. 检查字段是否存在
    console.log('\n1. 检查数据库字段...');
    const tableInfo = db.prepare("PRAGMA table_info(users)").all();
    const hasLastLogin = tableInfo.some(col => col.name === 'last_login_at');
    
    console.log(`   last_login_at 字段: ${hasLastLogin ? '✅ 存在' : '❌ 不存在'}`);
    
    if (!hasLastLogin) {
        console.log('\n❌ 缺少 last_login_at 字段，正在添加...');
        db.exec('ALTER TABLE users ADD COLUMN last_login_at DATETIME');
        console.log('✅ last_login_at 字段添加成功');
    }
    
    // 2. 显示当前状态
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
    
    // 3. 强制更新所有用户的登录时间为当前时间
    console.log('\n3. 强制更新所有用户登录时间...');
    const updateStmt = db.prepare(`
        UPDATE users 
        SET last_login_at = CURRENT_TIMESTAMP
    `);
    const result = updateStmt.run();
    console.log(`✅ 已更新 ${result.changes} 个用户的登录时间`);
    
    // 4. 显示更新后状态
    console.log('\n4. 更新后的登录记录:');
    const usersAfter = db.prepare(`
        SELECT username, last_login_at, created_at 
        FROM users 
        ORDER BY created_at DESC
    `).all();
    
    console.table(usersAfter.map(u => ({
        用户名: u.username,
        最后登录: u.last_login_at,
        注册时间: u.created_at
    })));
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ 更新完成！');
    console.log('='.repeat(60));
    console.log('\n💡 提示：');
    console.log('   现在刷新管理员面板，应该能看到最后登录时间了');
    console.log('   以后用户登录时会自动更新登录时间');
    console.log('');
    
} catch (error) {
    console.error('\n❌ 更新失败:', error);
    console.error('   详情:', error.message);
    process.exit(1);
} finally {
    db.close();
}
