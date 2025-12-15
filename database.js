import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

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

// 迁移：添加登录状态字段
const migrateAddLoginFields = () => {
    try {
        const checkColumn = db.prepare("PRAGMA table_info(users)");
        const columns = checkColumn.all();
        const hasLastLogin = columns.some(col => col.name === 'last_login_at');
        const hasIsOnline = columns.some(col => col.name === 'is_online');
        
        if (!hasLastLogin) {
            console.log('[Database] 添加 last_login_at 字段...');
            db.exec(`ALTER TABLE users ADD COLUMN last_login_at DATETIME`);
            console.log('[Database] ✅ last_login_at 字段添加成功');
        } else {
            console.log('[Database] ℹ️  last_login_at 字段已存在');
        }
        
        if (!hasIsOnline) {
            console.log('[Database] 添加 is_online 字段...');
            db.exec(`ALTER TABLE users ADD COLUMN is_online INTEGER DEFAULT 0`);
            console.log('[Database] ✅ is_online 字段添加成功');
        } else {
            console.log('[Database] ℹ️  is_online 字段已存在');
        }
    } catch (error) {
        console.error('[Database] ❌ 迁移失败:', error);
    }
};

// 初始化数据库
export const initDatabase = () => {
    createUsersTable();
    migrateAddRoleField();
    migrateAddLoginFields();
    fixAdminUserPorts();
    setAllUsersOffline(); // 服务器启动时将所有用户设置为离线
    console.log('Database initialized successfully');
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
               role, status, st_setup_status, created_at 
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

// 更新用户登录状态
export const updateUserLogin = (username) => {
    try {
        const stmt = db.prepare(`
            UPDATE users 
            SET last_login_at = CURRENT_TIMESTAMP, is_online = 1 
            WHERE username = ?
        `);
        const result = stmt.run(username);
        console.log(`[Database] ✅ 更新用户 ${username} 登录状态: ${result.changes} 行受影响`);
        
        // 验证更新结果
        const checkStmt = db.prepare('SELECT is_online, last_login_at FROM users WHERE username = ?');
        const user = checkStmt.get(username);
        console.log(`[Database] 验证: is_online=${user.is_online}, last_login_at=${user.last_login_at}`);
        
        return result;
    } catch (error) {
        console.error(`[Database] ❌ 更新登录状态失败:`, error);
        throw error;
    }
};

// 更新用户在线状态
export const updateUserOnlineStatus = (username, isOnline) => {
    const stmt = db.prepare('UPDATE users SET is_online = ? WHERE username = ?');
    return stmt.run(isOnline ? 1 : 0, username);
};

// 设置所有用户为离线（服务器启动时调用）
export const setAllUsersOffline = () => {
    try {
        const stmt = db.prepare('UPDATE users SET is_online = 0');
        const result = stmt.run();
        console.log(`[Database] ℹ️  已将所有用户设置为离线状态 (${result.changes} 个用户)`);
        return result;
    } catch (error) {
        console.error('[Database] ⚠️  设置用户离线状态失败:', error.message);
        return null;
    }
};

// 删除用户
export const deleteUser = (username) => {
    const stmt = db.prepare('DELETE FROM users WHERE username = ?');
    return stmt.run(username);
};

// 导出数据库实例（用于事务等高级操作）
export { db };

// 初始化数据库
initDatabase();
