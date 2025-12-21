import { db } from './database.js';

/**
 * 创建实例转发配置表
 */
export const createInstanceForwardingConfigTable = () => {
    // 主配置表 - 存储全局配置
    db.exec(`
        CREATE TABLE IF NOT EXISTS instance_forwarding_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            enabled INTEGER DEFAULT 1,
            main_port INTEGER DEFAULT 7091,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // 插入默认配置（如果不存在）
    const checkConfig = db.prepare('SELECT COUNT(*) as count FROM instance_forwarding_config');
    const { count } = checkConfig.get();
    if (count === 0) {
        db.prepare(`
            INSERT INTO instance_forwarding_config (id, enabled, main_port)
            VALUES (1, 1, 7091)
        `).run();
    }
    
    // 实例转发地址表 - 存储多个转发地址
    db.exec(`
        CREATE TABLE IF NOT EXISTS instance_forwarding_servers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            address TEXT NOT NULL,
            port INTEGER NOT NULL,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
};

/**
 * 获取转发配置
 */
export const getForwardingConfig = () => {
    try {
        const stmt = db.prepare('SELECT * FROM instance_forwarding_config WHERE id = 1');
        const config = stmt.get();
        // 强制返回启用状态
        return {...config, enabled: 1};
    } catch (error) {
        console.error('获取转发配置失败:', error.message);
        // 返回默认配置
        return { enabled: 1, main_port: 7091 };
    }
};

/**
 * 更新转发配置
 * @param {Object} config 要更新的配置项
 */
export const updateForwardingConfig = (config) => {
    // 获取当前配置
    const current = getForwardingConfig();
    
    // 忽略启用/禁用状态，始终强制为启用
    const newEnabled = 1; // 始终为启用状态
    const newMainPort = config.main_port !== undefined ? config.main_port : current.main_port;
    
    const stmt = db.prepare(`
        UPDATE instance_forwarding_config 
        SET enabled = ?, main_port = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = 1
    `);
    return stmt.run(newEnabled, newMainPort);
};

/**
 * 获取所有转发服务器
 */
export const getAllForwardingServers = () => {
    const stmt = db.prepare(`
        SELECT id, address, port, is_active, created_at, updated_at
        FROM instance_forwarding_servers
        ORDER BY created_at DESC
    `);
    return stmt.all();
};

/**
 * 获取活跃的转发服务器
 */
export const getActiveForwardingServers = () => {
    try {
        const stmt = db.prepare(`
            SELECT id, address, port
            FROM instance_forwarding_servers
            WHERE is_active = 1
            ORDER BY created_at DESC
        `);
        return stmt.all();
    } catch (err) {
        console.error('警告: 获取转发服务器失败:', err.message);
        // 返回空列表
        return [];
    }
};

/**
 * 通过ID查找转发服务器
 */
export const findForwardingServerById = (id) => {
    const stmt = db.prepare('SELECT * FROM instance_forwarding_servers WHERE id = ?');
    return stmt.get(id);
};

/**
 * 添加新的转发服务器
 */
export const addForwardingServer = (address, port) => {
    // 去除地址尾部斜杠，但保留协议前缀
    const cleanAddress = address
        .replace(/\/$/, ''); // 只移除尾部斜杠
    
    const stmt = db.prepare(`
        INSERT INTO instance_forwarding_servers (address, port, is_active)
        VALUES (?, ?, 1)
    `);
    const result = stmt.run(cleanAddress, port);
    return result.lastInsertRowid;
};

/**
 * 更新转发服务器
 */
export const updateForwardingServer = (id, address, port, isActive) => {
    // 去除地址尾部斜杠，但保留协议前缀
    const cleanAddress = address
        .replace(/\/$/, ''); // 只移除尾部斜杠

    const stmt = db.prepare(`
        UPDATE instance_forwarding_servers
        SET address = ?, port = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);
    return stmt.run(cleanAddress, port, isActive ? 1 : 0, id);
};

/**
 * 切换转发服务器状态
 */
export const toggleForwardingServerStatus = (id) => {
    const stmt = db.prepare(`
        UPDATE instance_forwarding_servers
        SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);
    return stmt.run(id);
};

/**
 * 删除转发服务器
 */
export const deleteForwardingServer = (id) => {
    const stmt = db.prepare('DELETE FROM instance_forwarding_servers WHERE id = ?');
    return stmt.run(id);
};
