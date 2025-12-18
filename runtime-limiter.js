// SillyTavern 实例运行时长限制模块
import { db } from './database.js';
import { stopInstance } from './pm2-manager.js';
import { findUserByUsername } from './database.js';

// 创建运行时长限制配置表
export const createRuntimeLimitTable = () => {
    try {
        console.log('[Database] 创建运行时长限制表...');
        db.exec(`
            CREATE TABLE IF NOT EXISTS runtime_limits (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                enabled INTEGER DEFAULT 0,
                max_runtime_minutes INTEGER DEFAULT 120,
                warning_minutes INTEGER DEFAULT 5,
                check_interval_seconds INTEGER DEFAULT 60,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // 创建实例启动时间表
        db.exec(`
            CREATE TABLE IF NOT EXISTS instance_start_times (
                username TEXT PRIMARY KEY,
                start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                warning_sent INTEGER DEFAULT 0
            )
        `);
        
        // 插入默认配置（如果不存在）
        const checkConfig = db.prepare('SELECT COUNT(*) as count FROM runtime_limits');
        const { count } = checkConfig.get();
        if (count === 0) {
            db.prepare(`
                INSERT INTO runtime_limits (id, enabled, max_runtime_minutes, warning_minutes, check_interval_seconds)
                VALUES (1, 0, 120, 5, 60)
            `).run();
            console.log('[Database] ✅ 运行时长限制默认配置已创建');
        }
        
        console.log('[Database] ✅ 运行时长限制表创建成功');
    } catch (error) {
        console.error('[Database] ❌ 创建运行时长限制表失败:', error);
    }
};

// 获取运行时长限制配置
export const getRuntimeLimitConfig = () => {
    try {
        const stmt = db.prepare('SELECT * FROM runtime_limits WHERE id = 1');
        return stmt.get();
    } catch (error) {
        console.error('[Runtime Limiter] 获取运行时长限制配置失败:', error);
        return {
            enabled: 0,
            max_runtime_minutes: 120,
            warning_minutes: 5,
            check_interval_seconds: 60
        };
    }
};

// 更新运行时长限制配置
export const updateRuntimeLimitConfig = (enabled, maxRuntimeMinutes, warningMinutes, checkIntervalSeconds) => {
    try {
        const stmt = db.prepare(`
            UPDATE runtime_limits 
            SET enabled = ?, 
                max_runtime_minutes = ?, 
                warning_minutes = ?,
                check_interval_seconds = ?,
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = 1
        `);
        
        const result = stmt.run(
            enabled ? 1 : 0, 
            maxRuntimeMinutes, 
            warningMinutes,
            checkIntervalSeconds
        );
        
        // 如果设置已启用，立即开始计时器
        if (enabled) {
            startRuntimeLimitCheck();
        } else {
            stopRuntimeLimitCheck();
        }
        
        return result;
    } catch (error) {
        console.error('[Runtime Limiter] 更新运行时长限制配置失败:', error);
        throw error;
    }
};

// 记录实例启动时间
export const recordInstanceStart = (username) => {
    try {
        // 先删除旧记录（如果存在）
        db.prepare('DELETE FROM instance_start_times WHERE username = ?').run(username);
        
        // 插入新记录
        const stmt = db.prepare(`
            INSERT INTO instance_start_times (username, start_time, warning_sent)
            VALUES (?, CURRENT_TIMESTAMP, 0)
        `);
        return stmt.run(username);
    } catch (error) {
        console.error(`[Runtime Limiter] 记录 ${username} 的实例启动时间失败:`, error);
    }
};

// 删除实例启动时间记录（实例停止时调用）
export const removeInstanceStartTime = (username) => {
    try {
        const stmt = db.prepare('DELETE FROM instance_start_times WHERE username = ?');
        return stmt.run(username);
    } catch (error) {
        console.error(`[Runtime Limiter] 删除 ${username} 的实例启动时间记录失败:`, error);
    }
};

// 标记已发送警告
export const markWarningSent = (username) => {
    try {
        const stmt = db.prepare(`
            UPDATE instance_start_times 
            SET warning_sent = 1
            WHERE username = ?
        `);
        return stmt.run(username);
    } catch (error) {
        console.error(`[Runtime Limiter] 标记 ${username} 的警告状态失败:`, error);
    }
};

// 获取超时实例列表
export const getTimeoutInstances = (maxRuntimeMinutes, warningMinutes) => {
    try {
        // 获取运行时间超过最大限制的实例
        const timeoutStmt = db.prepare(`
            SELECT i.username, i.start_time,
                   (julianday('now') - julianday(i.start_time)) * 24 * 60 AS runtime_minutes,
                   i.warning_sent
            FROM instance_start_times i
            JOIN users u ON i.username = u.username
            WHERE u.status = 'running' 
              AND (julianday('now') - julianday(i.start_time)) * 24 * 60 >= ?
        `);
        const timeoutInstances = timeoutStmt.all(maxRuntimeMinutes);
        
        // 获取需要发送警告的实例（还未超时但接近超时，且未发送过警告）
        const warningStmt = db.prepare(`
            SELECT i.username, i.start_time,
                   (julianday('now') - julianday(i.start_time)) * 24 * 60 AS runtime_minutes
            FROM instance_start_times i
            JOIN users u ON i.username = u.username
            WHERE u.status = 'running'
              AND i.warning_sent = 0
              AND (julianday('now') - julianday(i.start_time)) * 24 * 60 >= ? - ?
              AND (julianday('now') - julianday(i.start_time)) * 24 * 60 < ?
        `);
        const warningInstances = warningStmt.all(maxRuntimeMinutes, warningMinutes, maxRuntimeMinutes);
        
        return { timeoutInstances, warningInstances };
    } catch (error) {
        console.error('[Runtime Limiter] 获取超时实例失败:', error);
        return { timeoutInstances: [], warningInstances: [] };
    }
};

// 发送超时警告（可以通过WebSocket等方式实现）
const sendTimeoutWarning = (username, timeLeft) => {
    console.log(`[Runtime Limiter] 向用户 ${username} 发送超时警告: 还剩 ${timeLeft} 分钟`);
    // TODO: 实现WebSocket通知功能
};

// 检查并处理超时实例
export const checkTimeoutInstances = async () => {
    try {
        // 获取配置
        const config = getRuntimeLimitConfig();
        if (!config || !config.enabled) {
            return;
        }
        
        const { maxRuntimeMinutes, warningMinutes } = config;
        
        // 获取超时实例和警告实例
        const { timeoutInstances, warningInstances } = getTimeoutInstances(
            maxRuntimeMinutes, 
            warningMinutes
        );
        
        // 处理超时实例
        for (const instance of timeoutInstances) {
            console.log(`[Runtime Limiter] 实例 ${instance.username} 已运行 ${Math.floor(instance.runtime_minutes)} 分钟，超过限制 ${maxRuntimeMinutes} 分钟，正在停止...`);
            
            try {
                await stopInstance(instance.username);
                console.log(`[Runtime Limiter] 已自动停止超时实例: ${instance.username}`);
                removeInstanceStartTime(instance.username);
            } catch (error) {
                console.error(`[Runtime Limiter] 停止超时实例 ${instance.username} 失败:`, error);
            }
        }
        
        // 处理需要警告的实例
        for (const instance of warningInstances) {
            const timeLeft = Math.floor(maxRuntimeMinutes - instance.runtime_minutes);
            console.log(`[Runtime Limiter] 实例 ${instance.username} 即将超时，还剩 ${timeLeft} 分钟`);
            
            // 发送警告
            sendTimeoutWarning(instance.username, timeLeft);
            
            // 标记已发送警告
            markWarningSent(instance.username);
        }
    } catch (error) {
        console.error('[Runtime Limiter] 检查超时实例时出错:', error);
    }
};

// 运行时长检查定时器
let runtimeCheckInterval = null;

// 启动运行时长检查
export const startRuntimeLimitCheck = () => {
    // 首先停止现有的定时器
    stopRuntimeLimitCheck();
    
    // 获取配置
    const config = getRuntimeLimitConfig();
    if (!config || !config.enabled) {
        console.log('[Runtime Limiter] 运行时长限制未启用，不启动检查器');
        return;
    }
    
    const intervalSeconds = config.check_interval_seconds || 60;
    
    console.log(`[Runtime Limiter] 启动运行时长检查器，间隔 ${intervalSeconds} 秒`);
    runtimeCheckInterval = setInterval(checkTimeoutInstances, intervalSeconds * 1000);
    
    // 立即执行一次检查
    checkTimeoutInstances();
};

// 停止运行时长检查
export const stopRuntimeLimitCheck = () => {
    if (runtimeCheckInterval) {
        clearInterval(runtimeCheckInterval);
        runtimeCheckInterval = null;
        console.log('[Runtime Limiter] 已停止运行时长检查器');
    }
};

// 系统启动时初始化
export const initRuntimeLimiter = () => {
    // 创建必要的数据库表
    createRuntimeLimitTable();
    
    // 获取配置
    const config = getRuntimeLimitConfig();
    
    // 如果功能已启用，启动检查器
    if (config && config.enabled) {
        startRuntimeLimitCheck();
    }
};
