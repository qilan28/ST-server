// 修复数据库权限
// 创建一个无需import的普通版本，以避免可能的模块导入问题

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// 数据库路径
const dbPath = path.join(__dirname, 'database.sqlite');

console.log('=== 数据库文件修复工具（普通版本）===');

// 检查数据库文件是否存在
if (!fs.existsSync(dbPath)) {
    console.log(`数据库文件不存在: ${dbPath}`);
    console.log('正在创建新的数据库文件...');
    
    try {
        // 尝试创建空文件
        fs.writeFileSync(dbPath, '');
        console.log(`✅ 创建了空的数据库文件: ${dbPath}`);
        
        // 设置权限
        fs.chmodSync(dbPath, 0o666);
        console.log('✅ 已设置数据库文件权限');
        
        // 创建空的数据库文件
        const db = new Database(dbPath);
        
        // 创建站点设置表
        db.exec(`
            CREATE TABLE IF NOT EXISTS site_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                project_name TEXT,
                site_name TEXT,
                favicon_path TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // 插入默认值
        db.prepare(`
            INSERT INTO site_settings (id, project_name, site_name, favicon_path)
            VALUES (1, '公益云酒馆多开管理平台', 'SillyTavern 多开管理平台', '/favicon.ico')
        `).run();
        
        console.log('✅ 数据库文件和站点设置表已创建');
        
        // 关闭数据库连接
        db.close();
    } catch (error) {
        console.error('❌ 创建数据库失败:', error);
    }
} else {
    console.log(`数据库文件已存在: ${dbPath}`);
    
    try {
        // 设置权限
        fs.chmodSync(dbPath, 0o666);
        console.log('✅ 已设置数据库文件权限');
        
        // 打开数据库
        const db = new Database(dbPath);
        
        // 尝试更新站点设置
        try {
            db.exec(`
                CREATE TABLE IF NOT EXISTS site_settings (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    project_name TEXT,
                    site_name TEXT,
                    favicon_path TEXT,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // 检查是否已有记录
            const checkStmt = db.prepare('SELECT COUNT(*) as count FROM site_settings');
            const { count } = checkStmt.get();
            
            if (count === 0) {
                // 插入默认值
                db.prepare(`
                    INSERT INTO site_settings (id, project_name, site_name, favicon_path)
                    VALUES (1, '公益云酒馆多开管理平台', 'SillyTavern 多开管理平台', '/favicon.ico')
                `).run();
                console.log('✅ 已插入默认站点设置');
            } else {
                // 测试更新
                const stmt = db.prepare(`
                    UPDATE site_settings 
                    SET project_name = ?, site_name = ? 
                    WHERE id = 1
                `);
                
                stmt.run('公益云酒馆多开管理平台', 'SillyTavern 多开管理平台');
                console.log('✅ 已测试站点设置更新功能');
            }
        } catch (error) {
            console.error('❌ 站点设置操作失败:', error);
        }
        
        // 关闭数据库连接
        db.close();
    } catch (error) {
        console.error('❌ 修改数据库权限或访问数据库失败:', error);
    }
}

console.log('=== 数据库文件修复工具运行完成 ===');
console.log('请重启服务器以应用更改');
