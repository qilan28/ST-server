// 为数据库添加站点设置表和相关函数

// 创建站点设置表
export const createSiteSettingsTable = (db) => {
    db.exec(`
        CREATE TABLE IF NOT EXISTS site_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            project_name TEXT,
            site_name TEXT,
            favicon_path TEXT,
            max_users INTEGER DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 检查是否需要初始化数据
    const checkStmt = db.prepare('SELECT COUNT(*) as count FROM site_settings');
    const { count } = checkStmt.get();
    
    if (count === 0) {
        // 插入默认值
        const insertStmt = db.prepare(`
            INSERT INTO site_settings (id, project_name, site_name, favicon_path, max_users)
            VALUES (1, '公益云酒馆多开管理平台', 'SillyTavern 多开管理平台', '/favicon.ico', 0)
        `);
        insertStmt.run();
        console.log('[Database] ✅ 初始化站点设置');
    }
    
    // 检查是否需要添加 max_users 字段
    try {
        const checkColumn = db.prepare("PRAGMA table_info(site_settings)");
        const columns = checkColumn.all();
        const hasMaxUsers = columns.some(col => col.name === 'max_users');
        
        if (!hasMaxUsers) {
            console.log('[Database] 添加 max_users 字段...');
            db.exec(`ALTER TABLE site_settings ADD COLUMN max_users INTEGER DEFAULT 0`);
            console.log('[Database] ✅ max_users 字段添加成功');
        }
    } catch (error) {
        console.error('[Database] ❌ 添加 max_users 字段失败:', error);
    }
};

// 获取站点设置
export const getSiteSettings = (db) => {
    try {
        const stmt = db.prepare('SELECT * FROM site_settings WHERE id = 1');
        const settings = stmt.get();
        
        if (!settings) {
            return {
                project_name: '公益云酒馆多开管理平台', 
                site_name: 'SillyTavern 多开管理平台', 
                favicon_path: '/favicon.ico',
                max_users: 0
            };
        }
        
        // 确保 max_users 为数字类型
        const parsedMaxUsers = settings.max_users !== undefined && settings.max_users !== null ? 
            parseInt(settings.max_users, 10) : 0;
        
        console.log(`[Database] 获取到的 max_users 值: ${settings.max_users}, 类型: ${typeof settings.max_users}, 解析后: ${parsedMaxUsers}`);
        
        // 返回一个新对象，确保 max_users 是数字
        return {
            ...settings,
            max_users: parsedMaxUsers
        };
    } catch (error) {
        console.error('[Database] 获取站点设置失败:', error);
        return {
            project_name: '公益云酒馆多开管理平台', 
            site_name: 'SillyTavern 多开管理平台', 
            favicon_path: '/favicon.ico',
            max_users: 0
        };
    }
};

// 更新站点设置
export const updateSiteSettings = (db, projectName, siteName, faviconPath, maxUsers) => {
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
                    INSERT INTO site_settings (id, project_name, site_name, favicon_path, max_users)
                    VALUES (1, ?, ?, ?, ?)
                `);
                const insertResult = insertStmt.run(
                    projectName || '公益云酒馆多开管理平台', 
                    siteName || 'SillyTavern 多开管理平台', 
                    faviconPath || '/favicon.ico',
                    maxUsers !== undefined ? maxUsers : 0
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
        console.log(`[Database:${logId}] 参数: maxUsers=${maxUsers !== undefined ? maxUsers : '未提供'} (类型: ${typeof maxUsers})`);
        
        // 确保 maxUsers 是一个有效的整数
        let parsedMaxUsers = maxUsers;
        if (maxUsers !== undefined) {
            if (typeof maxUsers !== 'number') {
                parsedMaxUsers = parseInt(maxUsers, 10);
                if (isNaN(parsedMaxUsers)) {
                    console.error(`[Database:${logId}] maxUsers 值无法解析为整数: ${maxUsers}`);
                    parsedMaxUsers = 0; // 默认设置为 0 (无限)
                }
                console.log(`[Database:${logId}] 将 maxUsers 从 ${maxUsers} 解析为 ${parsedMaxUsers}`);
            }
        }
        
        const stmt = db.prepare(`
            UPDATE site_settings 
            SET 
                project_name = COALESCE(?, project_name),
                site_name = COALESCE(?, site_name),
                favicon_path = COALESCE(?, favicon_path),
                max_users = ?,
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = 1
        `);
        
        // 确保我们始终有一个有效的 maxUsers 值来更新，即使它是 0
        const finalMaxUsers = parsedMaxUsers !== undefined ? parsedMaxUsers : 0;
        console.log(`[Database:${logId}] 执行 SQL 更新数据: finalMaxUsers=${finalMaxUsers}`);
        const result = stmt.run(projectName, siteName, faviconPath, finalMaxUsers);
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
