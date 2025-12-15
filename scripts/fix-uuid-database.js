import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../database.sqlite');
const db = new Database(dbPath);

console.log('====================================');
console.log('  修复数据库中的 UUID');
console.log('====================================\n');

// 查询所有非管理员用户
const users = db.prepare(`
    SELECT id, username, path_uuid 
    FROM users 
    WHERE role != 'admin' OR role IS NULL
`).all();

console.log(`找到 ${users.length} 个用户需要检查\n`);

const updateStmt = db.prepare('UPDATE users SET path_uuid = ? WHERE id = ?');

let fixedCount = 0;
let skippedCount = 0;

users.forEach(user => {
    const currentUuid = user.path_uuid;
    
    // 检查 UUID 是否有效（应该是32个十六进制字符）
    const isValid = currentUuid && /^[a-f0-9]{32}$/i.test(currentUuid);
    
    if (!isValid) {
        // 生成新的32位UUID
        const newUuid = randomUUID().replace(/-/g, '');
        updateStmt.run(newUuid, user.id);
        
        console.log(`✅ 修复用户 ${user.username}:`);
        console.log(`   旧UUID: ${currentUuid || '(空)'}`);
        console.log(`   新UUID: ${newUuid}\n`);
        
        fixedCount++;
    } else {
        console.log(`✓ 用户 ${user.username} 的 UUID 正常: ${currentUuid}`);
        skippedCount++;
    }
});

console.log('\n====================================');
console.log('  修复完成');
console.log('====================================');
console.log(`✅ 修复: ${fixedCount} 个用户`);
console.log(`✓ 跳过: ${skippedCount} 个用户（UUID正常）`);
console.log('\n请重新生成 Nginx 配置并重载：');
console.log('  npm run generate-nginx');
console.log('  sudo nginx -s reload');

db.close();
