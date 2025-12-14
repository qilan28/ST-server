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
            status TEXT DEFAULT 'stopped',
            st_setup_status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
};

// 初始化数据库
export const initDatabase = () => {
    createUsersTable();
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

// 删除用户
export const deleteUser = (username) => {
    const stmt = db.prepare('DELETE FROM users WHERE username = ?');
    return stmt.run(username);
};

// 导出数据库实例（用于事务等高级操作）
export { db };

// 初始化数据库
initDatabase();
