import { db } from './database.js';

// 创建友情链接表
export const createFriendsLinkTable = () => {
    db.exec(`
        CREATE TABLE IF NOT EXISTS friends_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            logo TEXT,
            description TEXT,
            is_active BOOLEAN DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
};

// 获取所有友情链接（仅活跃的）
export const getAllFriendsLinks = () => {
    return db.prepare(`
        SELECT * FROM friends_links 
        WHERE is_active = 1 
        ORDER BY sort_order ASC, id ASC
    `).all();
};

// 获取所有友情链接（包括不活跃的，管理用）
export const getAllFriendsLinksAdmin = () => {
    return db.prepare(`
        SELECT * FROM friends_links 
        ORDER BY sort_order ASC, id ASC
    `).all();
};

// 添加友情链接
export const addFriendsLink = (name, url, logo = null, description = null, sort_order = 0) => {
    const stmt = db.prepare(`
        INSERT INTO friends_links (name, url, logo, description, sort_order) 
        VALUES (?, ?, ?, ?, ?)
    `);
    return stmt.run(name, url, logo, description, sort_order);
};

// 更新友情链接
export const updateFriendsLink = (id, name, url, logo, description, is_active, sort_order) => {
    const stmt = db.prepare(`
        UPDATE friends_links 
        SET name = ?, url = ?, logo = ?, description = ?, is_active = ?, sort_order = ? 
        WHERE id = ?
    `);
    return stmt.run(name, url, logo, description, is_active, sort_order, id);
};

// 删除友情链接
export const deleteFriendsLink = (id) => {
    const stmt = db.prepare('DELETE FROM friends_links WHERE id = ?');
    return stmt.run(id);
};

// 获取单个友情链接
export const getFriendsLink = (id) => {
    return db.prepare('SELECT * FROM friends_links WHERE id = ?').get(id);
};

// 导出模块
export default {
    createFriendsLinkTable,
    getAllFriendsLinks,
    getAllFriendsLinksAdmin,
    addFriendsLink,
    updateFriendsLink,
    deleteFriendsLink,
    getFriendsLink
};
