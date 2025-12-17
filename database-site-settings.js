// 为数据库添加站点设置表和相关函数

// 创建站点设置表
export const createSiteSettingsTable = (db) => {
    db.exec(`
        CREATE TABLE IF NOT EXISTS site_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            project_name TEXT,
            site_name TEXT,
            favicon_path TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 检查是否需要初始化数据
    const checkStmt = db.prepare('SELECT COUNT(*) as count FROM site_settings');
    const { count } = checkStmt.get();
    
    if (count === 0) {
        // 插入默认值
        const insertStmt = db.prepare(`
            INSERT INTO site_settings (id, project_name, site_name, favicon_path)
            VALUES (1, '公益云酒馆多开管理平台', 'SillyTavern 多开管理平台', '/favicon.ico')
        `);
        insertStmt.run();
        console.log('[Database] ✅ 初始化站点设置');
    }
};

// 获取站点设置
export const getSiteSettings = (db) => {
    try {
        const stmt = db.prepare('SELECT * FROM site_settings WHERE id = 1');
        const settings = stmt.get();
        return settings || {
            project_name: '公益云酒馆多开管理平台', 
            site_name: 'SillyTavern 多开管理平台', 
            favicon_path: '/favicon.ico'
        };
    } catch (error) {
        console.error('[Database] 获取站点设置失败:', error);
        return {
            project_name: '公益云酒馆多开管理平台', 
            site_name: 'SillyTavern 多开管理平台', 
            favicon_path: '/favicon.ico'
        };
    }
};

// 更新站点设置
export const updateSiteSettings = (db, projectName, siteName, faviconPath) => {
    try {
        const stmt = db.prepare(`
            UPDATE site_settings 
            SET 
                project_name = COALESCE(?, project_name),
                site_name = COALESCE(?, site_name),
                favicon_path = COALESCE(?, favicon_path),
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = 1
        `);
        
        const result = stmt.run(projectName, siteName, faviconPath);
        return result.changes > 0;
    } catch (error) {
        console.error('[Database] 更新站点设置失败:', error);
        return false;
    }
};
