// 修复数据库文件不同步的问题
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库路径
const dbPath = path.join(__dirname, 'database.sqlite');

console.log('=== 数据库文件修复工具 ===');

// 检查数据库文件是否存在
if (!fs.existsSync(dbPath)) {
    console.log(`数据库文件不存在: ${dbPath}`);
    console.log('正在创建新的数据库文件...');
    
    try {
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
        console.log('✅ 数据库连接已关闭');
    } catch (error) {
        console.error('❌ 创建数据库失败:', error);
    }
} else {
    console.log(`数据库文件已存在: ${dbPath}`);
    
    try {
        // 打开数据库
        const db = new Database(dbPath);
        
        // 检查站点设置表
        const checkTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='site_settings'");
        const tableExists = checkTable.get();
        
        if (!tableExists) {
            console.log('站点设置表不存在，正在创建...');
            
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
            
            console.log('✅ 站点设置表已创建并插入默认值');
        } else {
            // 检查站点设置记录
            const checkSettings = db.prepare("SELECT * FROM site_settings WHERE id = 1");
            const settings = checkSettings.get();
            
            if (!settings) {
                console.log('站点设置记录不存在，正在插入默认值...');
                
                // 插入默认值
                db.prepare(`
                    INSERT INTO site_settings (id, project_name, site_name, favicon_path)
                    VALUES (1, '公益云酒馆多开管理平台', 'SillyTavern 多开管理平台', '/favicon.ico')
                `).run();
                
                console.log('✅ 默认站点设置记录已插入');
            } else {
                console.log('现有站点设置:');
                console.log(`项目名称: ${settings.project_name}`);
                console.log(`网站名称: ${settings.site_name}`);
                console.log(`图标路径: ${settings.favicon_path}`);
                console.log(`上次更新: ${settings.updated_at}`);
            }
        }
        
        // 关闭数据库连接
        db.close();
        console.log('✅ 数据库检查完成，连接已关闭');
    } catch (error) {
        console.error('❌ 检查数据库失败:', error);
    }
}

console.log('=== 数据库文件修复工具运行完成 ===');
console.log('请重启服务器以应用更改');
