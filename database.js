import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createSiteSettingsTable } from './database-site-settings.js';
import { createFriendsLinkTable } from './database-friends.js';
import { createRuntimeLimitTable } from './runtime-limiter.js';
import { createInstanceForwardingConfigTable } from './database-instance-forwarding.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 初始化数据库连接
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

// 函数声明必须在这里，先于导出

// 启用外键约束
db.pragma('foreign_keys = ON');

// 创建用户表
const createUsersTable = () => {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            port INTEGER UNIQUE NOT NULL,
            data_dir TEXT NOT NULL,
            st_dir TEXT,
            st_version TEXT,
            subdomain TEXT,
            role TEXT DEFAULT 'user',
            status TEXT DEFAULT 'stopped',
            st_setup_status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
};

// 迁移：添加 role 字段（如果不存在）
const migrateAddRoleField = () => {
    try {
        const checkColumn = db.prepare("PRAGMA table_info(users)");
        const columns = checkColumn.all();
        const hasRole = columns.some(col => col.name === 'role');
        
        if (!hasRole) {
            console.log('Adding role column to users table...');
            db.exec(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'`);
            console.log('Role column added successfully');
        }
    } catch (error) {
        console.error('Migration error:', error);
    }
};

// 迁移：添加最后登录时间字段
const migrateAddLoginFields = () => {
    try {
        const checkColumn = db.prepare("PRAGMA table_info(users)");
        const columns = checkColumn.all();
        const hasLastLogin = columns.some(col => col.name === 'last_login_at');
        
        if (!hasLastLogin) {
            console.log('[Database] 添加 last_login_at 字段...');
            db.exec(`ALTER TABLE users ADD COLUMN last_login_at DATETIME`);
            console.log('[Database] ✅ last_login_at 字段添加成功');
        } else {
            console.log('[Database] ℹ️  last_login_at 字段已存在');
        }
    } catch (error) {
        console.error('[Database] ❌ 迁移失败:', error);
    }
};

// 迁移：添加 Hugging Face 备份配置字段
const migrateAddHFFields = () => {
    try {
        const checkColumn = db.prepare("PRAGMA table_info(users)");
        const columns = checkColumn.all();
        const hasHFToken = columns.some(col => col.name === 'hf_token');
        const hasHFRepo = columns.some(col => col.name === 'hf_repo');
        const hasHFEmail = columns.some(col => col.name === 'hf_email');
        
        if (!hasHFToken) {
            console.log('[Database] 添加 hf_token 字段...');
            db.exec(`ALTER TABLE users ADD COLUMN hf_token TEXT`);
            console.log('[Database] ✅ hf_token 字段添加成功');
        }
        
        if (!hasHFRepo) {
            console.log('[Database] 添加 hf_repo 字段...');
            db.exec(`ALTER TABLE users ADD COLUMN hf_repo TEXT`);
            console.log('[Database] ✅ hf_repo 字段添加成功');
        }
        
        if (!hasHFEmail) {
            console.log('[Database] 添加 hf_email 字段...');
            db.exec(`ALTER TABLE users ADD COLUMN hf_email TEXT`);
            console.log('[Database] ✅ hf_email 字段添加成功');
        }
    } catch (error) {
        console.error('[Database] ❌ HF 字段迁移失败:', error);
    }
};

// 创建公告表
const createAnnouncementsTable = () => {
    db.exec(`
        CREATE TABLE IF NOT EXISTS announcements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
};

// 创建自动备份配置表
const createAutoBackupConfigTable = () => {
    db.exec(`
        CREATE TABLE IF NOT EXISTS auto_backup_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            enabled INTEGER DEFAULT 0,
            interval_hours INTEGER DEFAULT 24,
            backup_type TEXT DEFAULT 'all',
            last_run_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // 插入默认配置（如果不存在）
    const checkConfig = db.prepare('SELECT COUNT(*) as count FROM auto_backup_config');
    const { count } = checkConfig.get();
    if (count === 0) {
        db.prepare(`
            INSERT INTO auto_backup_config (id, enabled, interval_hours, backup_type)
            VALUES (1, 0, 24, 'all')
        `).run();
    }
};

// 迁移：添加用户自动备份偏好字段
const migrateAddAutoBackupPreference = () => {
    try {
        const checkColumn = db.prepare("PRAGMA table_info(users)");
        const columns = checkColumn.all();
        const hasAutoBackup = columns.some(col => col.name === 'auto_backup_enabled');
        
        if (!hasAutoBackup) {
            console.log('[Database] 添加 auto_backup_enabled 字段...');
            db.exec(`ALTER TABLE users ADD COLUMN auto_backup_enabled INTEGER DEFAULT 1`);
            console.log('[Database] ✅ auto_backup_enabled 字段添加成功');
        } else {
            console.log('[Database] ℹ️  auto_backup_enabled 字段已存在');
        }
    } catch (error) {
        console.error('[Database] ❌ 迁移失败:', error);
    }
};

// 站点设置相关函数已在文件顶部导入

// 初始化数据库 - 增强错误处理和恢复机制
export const initDatabase = () => {
    try {
        console.log('[Database] 开始初始化数据库...');

        // 检查数据库文件是否可写
        try {
            const testStmt = db.prepare('PRAGMA user_version');
            testStmt.get();
            console.log('[Database] ✅ 数据库连接测试成功');
        } catch (error) {
            console.error('[Database] ⚠️ 数据库连接测试失败:', error);
            console.error('[Database] 请确保服务器对数据库文件有读写权限');
        }

        // 创建表和迁移数据库
        createUsersTable();
        createAnnouncementsTable();
        createAutoBackupConfigTable();
        createFriendsLinkTable();
        
        // 创建运行时长限制表
        try {
            createRuntimeLimitTable();
            console.log('[Database] ✅ 运行时长限制表已初始化');
        } catch (error) {
            console.error('[Database] ❌ 创建运行时长限制表失败:', error);
        }
        
        // 创建实例转发配置表
        try {
            createInstanceForwardingConfigTable();
            console.log('[Database] ✅ 实例转发配置表已初始化');
        } catch (error) {
            console.error('[Database] ❌ 创建实例转发配置表失败:', error);
        }
        
        // 创建站点设置表并测试写入
        try {
            createSiteSettingsTable(db);
            console.log('[Database] ✅ 站点设置表已初始化');
            
            // 测试读写
            const testSettings = db.prepare('SELECT * FROM site_settings WHERE id = 1').get();
            if (testSettings) {
                console.log('[Database] ✅ 站点设置读取测试成功:', 
                    `project_name=${testSettings.project_name}, ` +
                    `site_name=${testSettings.site_name}`);
            }
            
            // 测试更新
            const updateTest = db.prepare(`
                UPDATE site_settings 
                SET updated_at = CURRENT_TIMESTAMP 
                WHERE id = 1
            `).run();
            
            console.log('[Database] ✅ 站点设置更新测试完成:', updateTest.changes > 0 ? '成功' : '无变更');
            
        } catch (error) {
            console.error('[Database] ❗ 站点设置表操作失败:', error);
        }
        
        // 其他数据库操作
        migrateAddRoleField();
        migrateAddLoginFields();
        migrateAddHFFields();
        migrateAddAutoBackupPreference();
        fixAdminUserPorts();
        
        console.log('[Database] ✅ 数据库初始化成功');
    } catch (error) {
        console.error('[Database] ❌ 数据库初始化失败:', error);
        console.error('请检查服务器对数据库文件夹和文件的读写权限');
    }
};

// 查找可用端口（3001-4000）
export const findAvailablePort = () => {
    const stmt = db.prepare('SELECT port FROM users ORDER BY port ASC');
    const usedPorts = stmt.all().map(row => row.port);
    
    for (let port = 3001; port <= 4000; port++) {
        if (!usedPorts.includes(port)) {
            return port;
        }
    }
    
    throw new Error('No available ports');
};

// 创建用户
export const createUser = (username, hashedPassword, email) => {
    const port = findAvailablePort();
    const dataDir = path.join(__dirname, 'data', username);
    
    // 创建用户数据目录
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const stmt = db.prepare(`
        INSERT INTO users (username, password, email, port, data_dir)
        VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(username, hashedPassword, email, port, dataDir);
    
    return {
        id: result.lastInsertRowid,
        username,
        email,
        port,
        dataDir
    };
};

// 通过用户名查找用户
export const findUserByUsername = (username) => {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username);
};

// 通过邮箱查找用户
export const findUserByEmail = (email) => {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email);
};

// 通过ID查找用户
export const findUserById = (id) => {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id);
};

// 更新用户状态
export const updateUserStatus = (username, status) => {
    const stmt = db.prepare('UPDATE users SET status = ? WHERE username = ?');
    stmt.run(status, username);
};

// 更新用户 ST 信息
export const updateUserSTInfo = (username, stDir, stVersion, setupStatus = 'completed') => {
    const stmt = db.prepare(`
        UPDATE users 
        SET st_dir = ?, st_version = ?, st_setup_status = ?
        WHERE username = ?
    `);
    stmt.run(stDir, stVersion, setupStatus, username);
};

// 更新 ST 安装状态
export const updateSTSetupStatus = (username, status) => {
    const stmt = db.prepare('UPDATE users SET st_setup_status = ? WHERE username = ?');
    stmt.run(status, username);
};

// 获取所有用户
export const getAllUsers = () => {
    const stmt = db.prepare('SELECT id, username, email, port, status, created_at FROM users');
    return stmt.all();
};

// 获取所有用户（包含完整信息，仅供管理员使用）
export const getAllUsersAdmin = () => {
    const stmt = db.prepare(`
        SELECT id, username, email, port, data_dir, st_dir, st_version, 
               role, status, st_setup_status, created_at, last_login_at 
        FROM users 
        ORDER BY created_at DESC
    `);
    return stmt.all();
};

// 检查用户是否为管理员
export const isAdmin = (username) => {
    const stmt = db.prepare('SELECT role FROM users WHERE username = ?');
    const user = stmt.get(username);
    return user && user.role === 'admin';
};

// 创建管理员用户（管理员不需要 SillyTavern 实例）
export const createAdminUser = (username, hashedPassword, email) => {
    // 管理员不需要端口和数据目录，使用占位值
    const stmt = db.prepare(`
        INSERT INTO users (username, password, email, port, data_dir, role, st_setup_status)
        VALUES (?, ?, ?, 0, 'N/A', 'admin', 'N/A')
    `);
    
    const result = stmt.run(username, hashedPassword, email);
    
    return {
        id: result.lastInsertRowid,
        username,
        email,
        role: 'admin'
    };
};

// 更新用户角色
export const updateUserRole = (username, role) => {
    const stmt = db.prepare('UPDATE users SET role = ? WHERE username = ?');
    return stmt.run(role, username);
};

// 更新用户端口
export const updateUserPort = (username, port) => {
    const stmt = db.prepare('UPDATE users SET port = ? WHERE username = ?');
    return stmt.run(port, username);
};

// 更新用户安装状态
export const updateUserSetupStatus = (username, status) => {
    const stmt = db.prepare('UPDATE users SET st_setup_status = ? WHERE username = ?');
    return stmt.run(status, username);
};

// 修复管理员用户数据（确保端口为0）
const fixAdminUserPorts = () => {
    try {
        const stmt = db.prepare(`
            UPDATE users 
            SET port = 0, data_dir = 'N/A', st_setup_status = 'N/A'
            WHERE role = 'admin' AND port != 0
        `);
        const result = stmt.run();
        if (result.changes > 0) {
            console.log(`Fixed ${result.changes} admin user(s) port configuration`);
        }
    } catch (error) {
        console.error('Error fixing admin user ports:', error);
    }
};

// 更新用户登录时间
export const updateUserLogin = (username) => {
    try {
        const stmt = db.prepare(`
            UPDATE users 
            SET last_login_at = CURRENT_TIMESTAMP 
            WHERE username = ?
        `);
        const result = stmt.run(username);
        
        if (result.changes > 0) {
            // 获取更新后的登录时间
            const checkStmt = db.prepare('SELECT last_login_at FROM users WHERE username = ?');
            const user = checkStmt.get(username);
            console.log(`[Database] ✅ 用户 ${username} 最后登录时间: ${user.last_login_at}`);
        }
        
        return result;
    } catch (error) {
        console.error(`[Database] ❌ 更新登录时间失败:`, error);
        throw error;
    }
};

// 删除用户
export const deleteUser = (username) => {
    const stmt = db.prepare('DELETE FROM users WHERE username = ?');
    return stmt.run(username);
};

// ==================== Hugging Face 备份配置 ====================

// 更新用户的 Hugging Face 配置
export const updateUserHFConfig = (username, hfToken, hfRepo, hfEmail) => {
    const stmt = db.prepare(`
        UPDATE users 
        SET hf_token = ?, hf_repo = ?, hf_email = ? 
        WHERE username = ?
    `);
    return stmt.run(hfToken, hfRepo, hfEmail, username);
};

// 获取用户的 Hugging Face 配置
export const getUserHFConfig = (username) => {
    const stmt = db.prepare(`
        SELECT hf_token, hf_repo, hf_email 
        FROM users 
        WHERE username = ?
    `);
    return stmt.get(username);
};

// ==================== 公告管理 ====================

// 获取所有公告（管理员用）
export const getAllAnnouncements = () => {
    const stmt = db.prepare(`
        SELECT id, type, title, content, is_active, created_at, updated_at 
        FROM announcements 
        ORDER BY created_at DESC
    `);
    return stmt.all();
};

// 获取指定类型的活跃公告（前端用）
export const getActiveAnnouncements = (type) => {
    const stmt = db.prepare(`
        SELECT id, type, title, content, created_at 
        FROM announcements 
        WHERE type = ? AND is_active = 1 
        ORDER BY created_at DESC
    `);
    return stmt.all(type);
};

// 创建公告
export const createAnnouncement = (type, title, content) => {
    const stmt = db.prepare(`
        INSERT INTO announcements (type, title, content, is_active) 
        VALUES (?, ?, ?, 1)
    `);
    const result = stmt.run(type, title, content);
    return result.lastInsertRowid;
};

// 更新公告
export const updateAnnouncement = (id, title, content, isActive) => {
    const stmt = db.prepare(`
        UPDATE announcements 
        SET title = ?, content = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `);
    return stmt.run(title, content, isActive, id);
};

// 删除公告
export const deleteAnnouncement = (id) => {
    const stmt = db.prepare('DELETE FROM announcements WHERE id = ?');
    return stmt.run(id);
};

// 切换公告状态
export const toggleAnnouncementStatus = (id) => {
    const stmt = db.prepare(`
        UPDATE announcements 
        SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `);
    return stmt.run(id);
};

// ==================== 自动备份配置管理 ====================

// 获取自动备份配置
export const getAutoBackupConfig = () => {
    const stmt = db.prepare('SELECT * FROM auto_backup_config WHERE id = 1');
    return stmt.get();
};

// 更新自动备份配置
export const updateAutoBackupConfig = (enabled, intervalHours, backupType) => {
    // 获取当前配置
    const current = getAutoBackupConfig();
    
    // 只更新提供的字段
    const newEnabled = enabled !== undefined ? enabled : current.enabled;
    const newIntervalHours = intervalHours !== undefined ? intervalHours : current.interval_hours;
    const newBackupType = backupType !== undefined ? backupType : current.backup_type;
    
    const stmt = db.prepare(`
        UPDATE auto_backup_config 
        SET enabled = ?, interval_hours = ?, backup_type = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = 1
    `);
    return stmt.run(newEnabled, newIntervalHours, newBackupType);
};

// 更新最后运行时间
export const updateAutoBackupLastRun = () => {
    const stmt = db.prepare(`
        UPDATE auto_backup_config 
        SET last_run_at = CURRENT_TIMESTAMP 
        WHERE id = 1
    `);
    return stmt.run();
};

// 获取需要自动备份的用户列表
export const getUsersForAutoBackup = (backupType, showAll = false) => {
    let baseQuery;
    
    if (showAll) {
        // 仅过滤普通用户，显示所有潜在用户（即使未设置备份或未启用）
        baseQuery = `
            SELECT * FROM users 
            WHERE role = 'user'
        `;
    } else {
        // 原来的查询，只包含符合所有备份条件的用户
        baseQuery = `
            SELECT * FROM users 
            WHERE role = 'user' 
            AND auto_backup_enabled = 1
            AND hf_token IS NOT NULL 
            AND hf_repo IS NOT NULL
        `;
    }
    
    let query = baseQuery;
    
    // 根据备份类型添加额外条件
    if (!showAll) {
        if (backupType === 'logged_in_today') {
            // 当日登录过的用户
            query += ` AND DATE(last_login_at) = DATE('now')`;
        } else if (backupType === 'running') {
            // 运行中的实例
            query += ` AND status = 'running'`;
        }
    }
    // backupType === 'all' 不需要额外条件
    
    const stmt = db.prepare(query);
    return stmt.all();
};

// 更新用户自动备份偏好
export const updateUserAutoBackupPreference = (username, enabled) => {
    const stmt = db.prepare(`
        UPDATE users 
        SET auto_backup_enabled = ? 
        WHERE username = ?
    `);
    return stmt.run(enabled ? 1 : 0, username);
};

// 获取用户自动备份偏好
export const getUserAutoBackupPreference = (username) => {
    const stmt = db.prepare(`
        SELECT auto_backup_enabled 
        FROM users 
        WHERE username = ?
    `);
    const result = stmt.get(username);
    return result ? Boolean(result.auto_backup_enabled) : false;
};

// 初始化数据库
initDatabase();

// 初始化完成后再导出数据库实例
export { db };
