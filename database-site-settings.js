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
        // 生成日志 ID
        const logId = Date.now().toString(36);
        console.log(`[Database:${logId}] 开始更新站点设置...`);
        console.log(`[Database:${logId}] 参数: projectName=${projectName}, siteName=${siteName}, faviconPath=${faviconPath || 'null'}`);
        
        // 试图获取当前设置
        try {
            const current = db.prepare('SELECT * FROM site_settings WHERE id = 1').get();
            console.log(`[Database:${logId}] 当前设置:`, current || '未找到记录');
        } catch (readError) {
            console.error(`[Database:${logId}] 无法读取当前设置:`, readError);
        }
        
        // 检查是否需要创建记录
        const recordExists = db.prepare('SELECT COUNT(*) as count FROM site_settings WHERE id = 1').get();
        if (recordExists && recordExists.count === 0) {
            console.log(`[Database:${logId}] 记录不存在，尝试创建...`);
            try {
                const insertStmt = db.prepare(`
                    INSERT INTO site_settings (id, project_name, site_name, favicon_path)
                    VALUES (1, ?, ?, ?)
                `);
                const insertResult = insertStmt.run(
                    projectName || '公益云酒馆多开管理平台', 
                    siteName || 'SillyTavern 多开管理平台', 
                    faviconPath || '/favicon.ico'
                );
                console.log(`[Database:${logId}] 新记录创建结果:`, insertResult);
                return true;
            } catch (insertError) {
                console.error(`[Database:${logId}] 创建记录失败:`, insertError);
                return false;
            }
        }
        
        // 更新记录
        console.log(`[Database:${logId}] 执行更新操作...`);
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
        console.log(`[Database:${logId}] 更新结果: changes=${result.changes}`);
        
        // 查询更新后的记录
        try {
            const updated = db.prepare('SELECT * FROM site_settings WHERE id = 1').get();
            console.log(`[Database:${logId}] 更新后的设置:`, updated);
        } catch (readError) {
            console.error(`[Database:${logId}] 无法读取更新后的设置:`, readError);
        }
        
        // 即使没有更改也返回成功，因为可能是相同的值
        return true;
    } catch (error) {
        console.error('[Database] 更新站点设置失败:', error);
        return false;
    }
};
