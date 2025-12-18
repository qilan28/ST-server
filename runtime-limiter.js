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
                auto_restart_after_stop INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // 创建实例启动时间表
        db.exec(`
            CREATE TABLE IF NOT EXISTS instance_start_times (
                username TEXT PRIMARY KEY,
                start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                warning_sent INTEGER DEFAULT 0,
                restart_count INTEGER DEFAULT 0
            )
        `);
        
        // 创建用户谁免表
        db.exec(`
            CREATE TABLE IF NOT EXISTS runtime_exemptions (
                username TEXT PRIMARY KEY,
                is_exempt INTEGER DEFAULT 1,
                reason TEXT,
                added_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // 创建运行时间历史记录表
        db.exec(`
            CREATE TABLE IF NOT EXISTS runtime_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                start_time DATETIME NOT NULL,
                end_time DATETIME NOT NULL,
                duration_minutes INTEGER NOT NULL,
                stop_reason TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // 检查并更新表结构
        migrateRuntimeLimitTable();
        
        // 插入默认配置（如果不存在）
        const checkConfig = db.prepare('SELECT COUNT(*) as count FROM runtime_limits');
        const { count } = checkConfig.get();
        if (count === 0) {
            db.prepare(`
                INSERT INTO runtime_limits (id, enabled, max_runtime_minutes, warning_minutes, check_interval_seconds, auto_restart_after_stop)
                VALUES (1, 0, 120, 5, 60, 0)
            `).run();
            console.log('[Database] ✅ 运行时长限制默认配置已创建');
        }
        
        console.log('[Database] ✅ 运行时长限制表创建成功');
    } catch (error) {
        console.error('[Database] ❌ 创建运行时长限制表失败:', error);
    }
};

// 数据库结构迁移函数 - 确保所有必要列存在
export const migrateRuntimeLimitTable = () => {
    try {
        console.log('[Database] 检查运行时长限制表结构...');
        
        // 检查auto_restart_after_stop列是否存在
        const tableInfo = db.prepare("PRAGMA table_info(runtime_limits)").all();
        const columns = tableInfo.map(col => col.name);
        
        // 如果不存在auto_restart_after_stop列，添加它
        if (!columns.includes('auto_restart_after_stop')) {
            console.log('[Database] 开始添加auto_restart_after_stop列...');
            db.exec(`ALTER TABLE runtime_limits ADD COLUMN auto_restart_after_stop INTEGER DEFAULT 0`);
            console.log('[Database] ✅ auto_restart_after_stop列添加成功');
        }
        
        // 检查restart_count列在instance_start_times表中是否存在
        const startTimeInfo = db.prepare("PRAGMA table_info(instance_start_times)").all();
        const startTimeColumns = startTimeInfo.map(col => col.name);
        
        if (!startTimeColumns.includes('restart_count')) {
            console.log('[Database] 开始添加restart_count列...');
            db.exec(`ALTER TABLE instance_start_times ADD COLUMN restart_count INTEGER DEFAULT 0`);
            console.log('[Database] ✅ restart_count列添加成功');
        }
        
        console.log('[Database] 表结构检查与迁移完成');
    } catch (error) {
        console.error('[Database] ❌ 表结构迁移失败:', error);
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
            check_interval_seconds: 60,
            auto_restart_after_stop: 0
        };
    }
};

// 获取运行时间统计数据
export const getRuntimeStats = () => {
    try {
        // 获取总运行实例数
        const runningInstancesStmt = db.prepare(`
            SELECT COUNT(*) as count
            FROM instance_start_times i
            JOIN users u ON i.username = u.username
            WHERE u.status = 'running'
        `);
        const { count: runningCount } = runningInstancesStmt.get();

        // 获取当前谁免实例数
        const exemptInstancesStmt = db.prepare(`
            SELECT COUNT(*) as count
            FROM instance_start_times i
            JOIN users u ON i.username = u.username
            JOIN runtime_exemptions e ON i.username = e.username
            WHERE u.status = 'running' AND e.is_exempt = 1
        `);
        const { count: exemptCount } = exemptInstancesStmt.get();

        // 获取历史运行时长统计
        const historyStatsStmt = db.prepare(`
            SELECT 
                COUNT(*) as total_sessions,
                AVG(duration_minutes) as avg_duration,
                MAX(duration_minutes) as max_duration,
                SUM(duration_minutes) as total_runtime
            FROM runtime_history
        `);
        const historyStats = historyStatsStmt.get();

        // 获取今日统计数据
        const todayStatsStmt = db.prepare(`
            SELECT 
                COUNT(*) as today_sessions,
                AVG(duration_minutes) as today_avg_duration,
                SUM(duration_minutes) as today_runtime
            FROM runtime_history
            WHERE date(created_at) = date('now')
        `);
        const todayStats = todayStatsStmt.get();

        return {
            running_instances: runningCount,
            exempt_instances: exemptCount,
            watched_instances: runningCount - exemptCount,
            total_sessions: historyStats.total_sessions,
            avg_duration: historyStats.avg_duration || 0,
            max_duration: historyStats.max_duration || 0,
            total_runtime: historyStats.total_runtime || 0,
            today_sessions: todayStats.today_sessions,
            today_avg_duration: todayStats.today_avg_duration || 0,
            today_runtime: todayStats.today_runtime || 0
        };
    } catch (error) {
        console.error('[Runtime Limiter] 获取运行时间统计失败:', error);
        return {
            running_instances: 0,
            exempt_instances: 0,
            watched_instances: 0,
            total_sessions: 0,
            avg_duration: 0,
            max_duration: 0,
            total_runtime: 0,
            today_sessions: 0,
            today_avg_duration: 0,
            today_runtime: 0
        };
    }
};

// 更新运行时长限制配置
export const updateRuntimeLimitConfig = (enabled, maxRuntimeMinutes, warningMinutes, checkIntervalSeconds, autoRestart = false) => {
    try {
        const stmt = db.prepare(`
            UPDATE runtime_limits 
            SET enabled = ?, 
                max_runtime_minutes = ?, 
                warning_minutes = ?,
                check_interval_seconds = ?,
                auto_restart_after_stop = ?,
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = 1
        `);
        
        const result = stmt.run(
            enabled ? 1 : 0, 
            maxRuntimeMinutes, 
            warningMinutes,
            checkIntervalSeconds,
            autoRestart ? 1 : 0
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
        if (!username) {
            console.error('[Runtime Limiter] 无法记录启动时间：用户名为空');
            return null;
        }

        console.log(`[Runtime Limiter] 记录用户 ${username} 的实例启动时间`);

        // 先删除旧记录（如果存在）
        const deleteResult = db.prepare('DELETE FROM instance_start_times WHERE username = ?').run(username);
        console.log(`[Runtime Limiter] 删除用户 ${username} 的旧记录结果:`, deleteResult);
        
        // 插入新记录
        const stmt = db.prepare(`
            INSERT INTO instance_start_times (username, start_time, warning_sent, restart_count)
            VALUES (?, CURRENT_TIMESTAMP, 0, 0)
        `);
        const result = stmt.run(username);
        console.log(`[Runtime Limiter] 用户 ${username} 实例启动时间记录成功`);
        return result;
    } catch (error) {
        console.error(`[Runtime Limiter] 记录 ${username} 的实例启动时间失败:`, error);
        return null;
    }
};

// 删除实例启动时间记录（实例停止时调用）
export const removeInstanceStartTime = (username) => {
    try {
        if (!username) {
            console.error('[Runtime Limiter] 无法删除启动时间记录：用户名为空');
            return null;
        }

        // 删除记录
        const result = db.prepare('DELETE FROM instance_start_times WHERE username = ?').run(username);
        console.log(`[Runtime Limiter] 用户 ${username} 的启动时间记录已删除`);
        return result;
    } catch (error) {
        console.error(`[Runtime Limiter] 删除 ${username} 的实例启动时间记录失败:`, error);
        return null;
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
        // 获取运行时间超过最大限制的实例，排除谁免用户
        const timeoutStmt = db.prepare(`
            SELECT i.username, i.start_time, i.restart_count,
                   (julianday('now') - julianday(i.start_time)) * 24 * 60 AS runtime_minutes,
                   i.warning_sent
            FROM instance_start_times i
            JOIN users u ON i.username = u.username
            LEFT JOIN runtime_exemptions e ON i.username = e.username
            WHERE u.status = 'running' 
              AND (e.is_exempt IS NULL OR e.is_exempt = 0)
              AND (julianday('now') - julianday(i.start_time)) * 24 * 60 >= ?
        `);
        const timeoutInstances = timeoutStmt.all(maxRuntimeMinutes);
        
        // 获取需要发送警告的实例（还未超时但接近超时，且未发送过警告）
        const warningStmt = db.prepare(`
            SELECT i.username, i.start_time, i.restart_count,
                   (julianday('now') - julianday(i.start_time)) * 24 * 60 AS runtime_minutes
            FROM instance_start_times i
            JOIN users u ON i.username = u.username
            LEFT JOIN runtime_exemptions e ON i.username = e.username
            WHERE u.status = 'running'
              AND (e.is_exempt IS NULL OR e.is_exempt = 0)
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

// 管理用户谁免相关函数

// 添加用户谁免
export const addExemption = (username, reason, addedBy) => {
    try {
        if (!username) {
            throw new Error('用户名不能为空');
        }

        // 检查用户是否存在
        const userExists = db.prepare('SELECT COUNT(*) as count FROM users WHERE username = ?').get(username);
        if (userExists.count === 0) {
            throw new Error(`用户 ${username} 不存在`);
        }

        // 先删除现有记录（如果有）
        db.prepare('DELETE FROM runtime_exemptions WHERE username = ?').run(username);
        
        // 插入新记录
        const stmt = db.prepare(`
            INSERT INTO runtime_exemptions (username, reason, added_by)
            VALUES (?, ?, ?)
        `);
        
        const result = stmt.run(username, reason || '无原因', addedBy || 'system');
        
        console.log(`[Runtime Limiter] 用户 ${username} 已添加到运行时间谁免名单`);
        return result;
    } catch (error) {
        console.error(`[Runtime Limiter] 添加用户 ${username} 到谁免名单失败:`, error);
        throw error;
    }
};

// 移除用户谁免
export const removeExemption = (username) => {
    try {
        if (!username) {
            throw new Error('用户名不能为空');
        }

        const stmt = db.prepare('DELETE FROM runtime_exemptions WHERE username = ?');
        const result = stmt.run(username);
        
        console.log(`[Runtime Limiter] 用户 ${username} 已从运行时间谁免名单中移除`);
        return result;
    } catch (error) {
        console.error(`[Runtime Limiter] 移除用户 ${username} 的谁免失败:`, error);
        throw error;
    }
};

// 检查用户是否被谁免
export const isUserExempt = (username) => {
    try {
        if (!username) return false;
        
        const stmt = db.prepare('SELECT is_exempt FROM runtime_exemptions WHERE username = ?');
        const result = stmt.get(username);
        
        return result && result.is_exempt === 1;
    } catch (error) {
        console.error(`[Runtime Limiter] 检查用户 ${username} 的谁免状态失败:`, error);
        return false;
    }
};

// 获取所有谁免用户
export const getAllExemptions = () => {
    try {
        const stmt = db.prepare(`
            SELECT e.*, u.email 
            FROM runtime_exemptions e
            LEFT JOIN users u ON e.username = u.username
            ORDER BY e.created_at DESC
        `);
        return stmt.all();
    } catch (error) {
        console.error('[Runtime Limiter] 获取谁免用户列表失败:', error);
        return [];
    }
};

// 记录运行时间历史
export const recordRuntimeHistory = (username, startTime, endTime, durationMinutes, stopReason) => {
    try {
        if (!username || !startTime || !endTime) {
            return null;
        }
        
        const stmt = db.prepare(`
            INSERT INTO runtime_history 
            (username, start_time, end_time, duration_minutes, stop_reason)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        return stmt.run(
            username, 
            startTime, 
            endTime, 
            durationMinutes,
            stopReason || '自动停止'
        );
    } catch (error) {
        console.error(`[Runtime Limiter] 记录用户 ${username} 的运行历史失败:`, error);
        return null;
    }
};

// 获取用户运行时间历史
export const getUserRuntimeHistory = (username, limit = 10) => {
    try {
        const stmt = db.prepare(`
            SELECT * FROM runtime_history
            WHERE username = ?
            ORDER BY end_time DESC
            LIMIT ?
        `);
        
        return stmt.all(username, limit);
    } catch (error) {
        console.error(`[Runtime Limiter] 获取用户 ${username} 的运行历史失败:`, error);
        return [];
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
        
        const { maxRuntimeMinutes, warningMinutes, auto_restart_after_stop } = config;
        const autoRestart = auto_restart_after_stop === 1;
        
        // 获取超时实例和警告实例
        const { timeoutInstances, warningInstances } = getTimeoutInstances(
            maxRuntimeMinutes, 
            warningMinutes
        );
        
        // 处理超时实例
        for (const instance of timeoutInstances) {
            const username = instance.username;
            const runtime = Math.floor(instance.runtime_minutes);
            console.log(`[Runtime Limiter] 实例 ${username} 已运行 ${runtime} 分钟，超过限制 ${maxRuntimeMinutes} 分钟，正在停止...`);
            
            try {
                // 在停止实例前记录历史
                const currentTime = new Date().toISOString();
                
                // 停止实例
                await stopInstance(username);
                console.log(`[Runtime Limiter] 已自动停止超时实例: ${username}`);
                
                // 记录历史
                recordRuntimeHistory(
                    username,
                    instance.start_time,
                    currentTime,
                    runtime,
                    '超时自动停止'
                );
                
                // 处理自动重启
                if (autoRestart) {
                    try {
                        console.log(`[Runtime Limiter] 尝试自动重启实例: ${username}`);
                        // 使用原实例的重启计数+1
                        const restartCount = (instance.restart_count || 0) + 1;
                        
                        // 先记录新的启动时间，并更新重启计数
                        db.prepare(`
                            INSERT INTO instance_start_times (username, start_time, warning_sent, restart_count)
                            VALUES (?, CURRENT_TIMESTAMP, 0, ?)
                        `).run(username, restartCount);
                        
                        // 启动实例
                        // TODO: 调用启动实例的函数，这里使用 setTimeout 模拟延迟启动
                        setTimeout(async () => {
                            try {
                                // 调用启动实例函数，注意这里需要导入相应的函数
                                // await startInstance(username);
                                console.log(`[Runtime Limiter] 实例 ${username} 自动重启成功（第 ${restartCount} 次重启）`);
                            } catch (restartError) {
                                console.error(`[Runtime Limiter] 重启实例 ${username} 失败:`, restartError);
                            }
                        }, 5000); // 延迟5秒后重启
                    } catch (restartError) {
                        console.error(`[Runtime Limiter] 准备重启实例 ${username} 失败:`, restartError);
                    }
                } else {
                    // 不自动重启，移除启动时间记录
                    removeInstanceStartTime(username);
                }
            } catch (error) {
                console.error(`[Runtime Limiter] 停止超时实例 ${username} 失败:`, error);
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
    console.log('[Runtime Limiter] 立即执行实例检查...');
    checkTimeoutInstances();
};

// 强制执行检查，用于手动检查所有超时实例
export const forceCheckInstances = async () => {
    console.log('[Runtime Limiter] 强制执行超时检查');
    await checkTimeoutInstances();
    console.log('[Runtime Limiter] 强制检查完成');
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
