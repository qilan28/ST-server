import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../database.sqlite');

console.log('='.repeat(60));
console.log('站点设置修复工具');
console.log('='.repeat(60));

// 检查数据库文件是否存在
if (!fs.existsSync(dbPath)) {
    console.log('❌ 数据库文件不存在，将创建新文件');
    try {
        // 创建空文件确保文件夹权限正确
        fs.writeFileSync(dbPath, '');
        console.log('✅ 创建了空的数据库文件');
    } catch (error) {
        console.error('❌ 创建数据库文件失败:', error);
        console.error('请检查服务器对数据库文件夹的写入权限');
        process.exit(1);
    }
}

// 设置数据库文件权限
try {
    fs.chmodSync(dbPath, 0o666);
    console.log('✅ 已设置数据库文件权限为 666 (所有用户可读写)');
} catch (error) {
    console.error('⚠️ 无法设置数据库文件权限:', error);
    console.log('继续执行，但可能会遇到权限问题');
}

// 尝试打开数据库
let db;
try {
    db = new Database(dbPath);
    console.log('✅ 成功连接到数据库');
} catch (error) {
    console.error('❌ 连接数据库失败:', error);
    process.exit(1);
}

try {
    // 检查site_settings表是否存在
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='site_settings'").get();
    
    if (!tableCheck) {
        console.log('⚠️ site_settings 表不存在，将创建新表');
        
        // 创建表
        db.exec(`
            CREATE TABLE IF NOT EXISTS site_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                project_name TEXT,
                site_name TEXT,
                favicon_path TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ site_settings 表创建成功');
    } else {
        console.log('✅ site_settings 表已存在');
    }
    
    // 检查是否有记录
    const recordCheck = db.prepare('SELECT COUNT(*) as count FROM site_settings').get();
    
    if (recordCheck.count === 0) {
        console.log('⚠️ site_settings 表中没有记录，将插入默认值');
        
        // 插入默认记录
        db.prepare(`
            INSERT INTO site_settings (id, project_name, site_name, favicon_path)
            VALUES (1, '公益云酒馆多开管理平台', 'SillyTavern 多开管理平台', '/favicon.ico')
        `).run();
        console.log('✅ 默认设置记录插入成功');
    } else {
        console.log('✅ site_settings 表中已有记录');
    }
    
    // 查询并显示当前设置
    const settings = db.prepare('SELECT * FROM site_settings').get();
    console.log('\n当前站点设置:');
    console.log('项目名称:', settings.project_name);
    console.log('网站名称:', settings.site_name);
    console.log('图标路径:', settings.favicon_path);
    console.log('更新时间:', settings.updated_at);
    
    // 测试更新功能
    console.log('\n测试数据库更新功能...');
    const testUpdate = db.prepare(`
        UPDATE site_settings
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
    `).run();
    
    if (testUpdate.changes === 0) {
        console.log('⚠️ 更新测试未生效，但这可能只是因为时间戳没有变化');
    } else {
        console.log('✅ 更新测试成功');
    }
    
    // 再次查询并显示当前设置
    const updatedSettings = db.prepare('SELECT * FROM site_settings').get();
    console.log('\n更新后的站点设置:');
    console.log('项目名称:', updatedSettings.project_name);
    console.log('网站名称:', updatedSettings.site_name);
    console.log('图标路径:', updatedSettings.favicon_path);
    console.log('更新时间:', updatedSettings.updated_at);
    
} catch (error) {
    console.error('❌ 操作数据库时发生错误:', error);
} finally {
    if (db) {
        db.close();
        console.log('\n✅ 数据库连接已关闭');
    }
}

console.log('\n='.repeat(60));
console.log('站点设置修复工具执行完毕');
console.log('请重启服务器以应用更改');
console.log('='.repeat(60));
