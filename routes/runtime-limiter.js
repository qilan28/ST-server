import express from 'express';
import { 
    getRuntimeLimitConfig, 
    updateRuntimeLimitConfig, 
    getTimeoutInstances,
    addExemption,
    removeExemption,
    getAllExemptions,
    isUserExempt,
    getUserRuntimeHistory,
    getRuntimeStats,
    forceCheckInstances
} from '../runtime-limiter.js';
import { isAdmin, findUserByUsername } from '../database.js';
import { authenticateToken } from '../middleware/auth.js';
import { db } from '../database.js';

const router = express.Router();

// 验证管理员权限的中间件
const adminAuthMiddleware = (req, res, next) => {
    console.log('[Runtime Limiter] 权限验证: 用户=', req.user ? req.user.username : '未登录');
    
    if (!req.user) {
        console.log('[Runtime Limiter] 权限验证失败: 未登录');
        return res.status(401).json({ error: '需要登录', message: '请先登录' });
    }
    
    if (!isAdmin(req.user.username)) {
        console.log('[Runtime Limiter] 权限验证失败: 非管理员', req.user.username);
        return res.status(403).json({ error: '需要管理员权限', message: '您没有访问此功能的权限' });
    }
    
    console.log('[Runtime Limiter] 权限验证通过: 管理员=', req.user.username);
    next();
};

// 获取运行时长限制配置
router.get('/config', authenticateToken, adminAuthMiddleware, (req, res) => {
    try {
        const config = getRuntimeLimitConfig();
        res.json({ success: true, config });
    } catch (error) {
        console.error('[Runtime Limiter] 获取配置失败:', error);
        res.status(500).json({ error: '获取配置失败: ' + error.message });
    }
});

// 更新运行时长限制配置
router.put('/config', authenticateToken, adminAuthMiddleware, (req, res) => {
    try {
        const { enabled, maxRuntimeMinutes, warningMinutes, checkIntervalSeconds, autoRestart } = req.body;
        
        // 验证参数
        if (maxRuntimeMinutes === undefined || warningMinutes === undefined || checkIntervalSeconds === undefined) {
            return res.status(400).json({ error: '参数不完整，请提供所有必要参数' });
        }
        
        // 验证参数值的合理性
        if (maxRuntimeMinutes < 5 || maxRuntimeMinutes > 1440) { // 5分钟到24小时
            return res.status(400).json({ error: '最大运行时间必须在5-1440分钟之间' });
        }
        
        if (warningMinutes < 1 || warningMinutes > 60) { // 1-60分钟
            return res.status(400).json({ error: '警告提前时间必须在1-60分钟之间' });
        }
        
        if (checkIntervalSeconds < 10 || checkIntervalSeconds > 3600) { // 10秒到21小时
            return res.status(400).json({ error: '检查间隔必须在10-3600秒之间' });
        }
        
        if (warningMinutes >= maxRuntimeMinutes) {
            return res.status(400).json({ error: '警告提前时间必须小于最大运行时间' });
        }
        
        // 更新配置
        const result = updateRuntimeLimitConfig(
            enabled, 
            maxRuntimeMinutes, 
            warningMinutes,
            checkIntervalSeconds,
            !!autoRestart
        );
        
        res.json({ 
            success: true, 
            message: '配置已更新',
            enabled: !!enabled,
            maxRuntimeMinutes,
            warningMinutes,
            checkIntervalSeconds,
            autoRestart: !!autoRestart
        });
    } catch (error) {
        console.error('[Runtime Limiter] 更新配置失败:', error);
        res.status(500).json({ error: '更新配置失败: ' + error.message });
    }
});

// 获取当前运行实例状态
router.get('/status', authenticateToken, adminAuthMiddleware, (req, res) => {
    try {
        const config = getRuntimeLimitConfig();
        if (!config) {
            return res.status(500).json({ error: '无法获取运行时长限制配置' });
        }
        
        const { maxRuntimeMinutes, warningMinutes } = config;
        const { timeoutInstances, warningInstances } = getTimeoutInstances(
            maxRuntimeMinutes, 
            warningMinutes
        );
        
        res.json({ 
            success: true, 
            config,
            timeoutInstances,
            warningInstances,
            totalRunningInstances: timeoutInstances.length + warningInstances.length
        });
    } catch (error) {
        console.error('[Runtime Limiter] 获取状态失败:', error);
        res.status(500).json({ error: '获取状态失败: ' + error.message });
    }
});

// 获取运行时间统计信息
router.get('/stats', authenticateToken, adminAuthMiddleware, (req, res) => {
    try {
        const stats = getRuntimeStats();
        res.json({ success: true, stats });
    } catch (error) {
        console.error('[Runtime Limiter] 获取统计数据失败:', error);
        res.status(500).json({ error: '获取统计数据失败: ' + error.message });
    }
});

// 获取用户运行时间历史
router.get('/history/:username', authenticateToken, adminAuthMiddleware, (req, res) => {
    try {
        const { username } = req.params;
        const limit = req.query.limit ? parseInt(req.query.limit) : 10;
        
        // 检查用户是否存在
        const user = findUserByUsername(username);
        if (!user) {
            return res.status(404).json({ error: `用户 ${username} 不存在` });
        }
        
        const history = getUserRuntimeHistory(username, limit);
        res.json({ success: true, username, history });
    } catch (error) {
        console.error('[Runtime Limiter] 获取用户历史失败:', error);
        res.status(500).json({ error: '获取用户历史失败: ' + error.message });
    }
});

// 获取所有豁免用户
router.get('/exemptions', authenticateToken, adminAuthMiddleware, (req, res) => {
    try {
        const exemptions = getAllExemptions();
        res.json({ success: true, exemptions });
    } catch (error) {
        console.error('[Runtime Limiter] 获取豁免用户列表失败:', error);
        res.status(500).json({ error: '获取豁免用户列表失败: ' + error.message });
    }
});

// 添加用户豁免
router.post('/exemptions', authenticateToken, adminAuthMiddleware, (req, res) => {
    try {
        const { username, reason } = req.body;
        
        if (!username) {
            return res.status(400).json({ error: '用户名不能为空' });
        }
        
        // 检查用户是否存在
        const user = findUserByUsername(username);
        if (!user) {
            return res.status(404).json({ error: `用户 ${username} 不存在` });
        }
        
        const result = addExemption(username, reason, req.user.username);
        res.json({
            success: true,
            message: `用户 ${username} 已添加到运行时间豁免名单`,
            username,
            reason,
            addedBy: req.user.username
        });
    } catch (error) {
        console.error('[Runtime Limiter] 添加豁免失败:', error);
        res.status(500).json({ error: '添加豁免失败: ' + error.message });
    }
});

// 删除用户豁免
router.delete('/exemptions/:username', authenticateToken, adminAuthMiddleware, (req, res) => {
    try {
        const { username } = req.params;
        
        if (!username) {
            return res.status(400).json({ error: '用户名不能为空' });
        }
        
        // 检查用户是否存在
        const user = findUserByUsername(username);
        if (!user) {
            return res.status(404).json({ error: `用户 ${username} 不存在` });
        }
        
        // 检查用户是否已豁免
        if (!isUserExempt(username)) {
            return res.status(400).json({ error: `用户 ${username} 不在豁免名单中` });
        }
        
        const result = removeExemption(username);
        res.json({
            success: true,
            message: `用户 ${username} 已从豁免名单中移除`,
            username
        });
    } catch (error) {
        console.error('[Runtime Limiter] 移除豁免失败:', error);
        res.status(500).json({ error: '移除豁免失败: ' + error.message });
    }
});

// 强制检查超时实例
router.post('/force-check', authenticateToken, adminAuthMiddleware, async (req, res) => {
    try {
        console.log('[Runtime Limiter] 接收到强制检查请求');
        await forceCheckInstances();
        res.json({ success: true, message: '强制检查完成' });
    } catch (error) {
        console.error('[Runtime Limiter] 强制检查失败:', error);
        res.status(500).json({ error: '强制检查失败: ' + error.message });
    }
});

// 管理员停止指定用户实例
router.post('/admin-stop/:username', authenticateToken, adminAuthMiddleware, async (req, res) => {
    try {
        const { username } = req.params;
        
        if (!username) {
            return res.status(400).json({ error: '用户名不能为空' });
        }
        
        // 检查用户是否存在
        const user = findUserByUsername(username);
        if (!user) {
            return res.status(404).json({ error: `用户 ${username} 不存在` });
        }
        
        console.log(`[Runtime Limiter] 管理员 ${req.user.username} 要求停止用户 ${username} 的实例`);
        
        // 导入并使用stopInstance功能
        const { stopInstance } = await import('../pm2-manager.js');
        
        await stopInstance(username);
        
        console.log(`[Runtime Limiter] 管理员已停止用户 ${username} 的实例`);
        res.json({ 
            message: `用户 ${username} 的实例已停止` 
        });
    } catch (error) {
        console.error('[Runtime Limiter] 管理员停止实例错误:', error);
        res.status(500).json({ error: '停止实例失败: ' + error.message });
    }
});

// 检查实例的记录状态
router.get('/instance-records', authenticateToken, adminAuthMiddleware, (req, res) => {
    try {
        console.log('[Runtime Limiter] 获取实例启动时间记录');
        
        const stmt = db.prepare(`
            SELECT i.username, i.start_time, i.warning_sent, i.restart_count,
                   (julianday('now') - julianday(i.start_time)) * 24 * 60 AS runtime_minutes,
                   u.status,
                   CASE WHEN e.username IS NOT NULL THEN 1 ELSE 0 END AS is_exempt
            FROM instance_start_times i
            JOIN users u ON i.username = u.username
            LEFT JOIN runtime_exemptions e ON i.username = e.username
            ORDER BY runtime_minutes DESC
        `);
        
        const records = stmt.all();
        
        res.json({ success: true, records });
    } catch (error) {
        console.error('[Runtime Limiter] 获取实例记录失败:', error);
        res.status(500).json({ error: '获取实例记录失败: ' + error.message });
    }
});

export default router;
