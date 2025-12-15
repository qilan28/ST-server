import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../database.sqlite');
const db = new Database(dbPath);

console.log('='.repeat(60));
console.log('数据库检查工具');
console.log('='.repeat(60));

// 检查表结构
console.log('\n1. 检查 users 表结构:');
const tableInfo = db.prepare("PRAGMA table_info(users)").all();
console.table(tableInfo.map(col => ({
    字段名: col.name,
    类型: col.type,
    默认值: col.dflt_value || '(无)',
    允许空: col.notnull === 0 ? '是' : '否'
})));

// 检查是否有最后登录时间字段
const hasLastLogin = tableInfo.some(col => col.name === 'last_login_at');

console.log('\n2. 最后登录时间字段检查:');
console.log(`   last_login_at 字段: ${hasLastLogin ? '✅ 存在' : '❌ 不存在'}`);

// 查询所有用户的登录记录
if (hasLastLogin) {
    console.log('\n3. 当前用户登录记录:');
    const users = db.prepare(`
        SELECT 
            username, 
            role, 
            last_login_at,
            created_at
        FROM users 
        ORDER BY created_at DESC
    `).all();
    
    if (users.length === 0) {
        console.log('   (暂无用户)');
    } else {
        console.table(users.map(u => ({
            用户名: u.username,
            角色: u.role === 'admin' ? '管理员' : '用户',
            最后登录: u.last_login_at || '从未登录',
            注册时间: u.created_at
        })));
    }
} else {
    console.log('\n⚠️  缺少 last_login_at 字段，请重启服务器以执行数据库迁移');
}

// 查询管理员账号
console.log('\n4. 管理员账号列表:');
const admins = db.prepare('SELECT username, email, created_at FROM users WHERE role = ?').all('admin');
if (admins.length === 0) {
    console.log('   ❌ 没有管理员账号');
} else {
    console.table(admins.map(a => ({
        用户名: a.username,
        邮箱: a.email,
        创建时间: a.created_at
    })));
}

console.log('\n' + '='.repeat(60));
console.log('检查完成！');
console.log('='.repeat(60));

db.close();
