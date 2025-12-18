import express from 'express';
import { 
    getRuntimeLimitConfig, 
    updateRuntimeLimitConfig, 
    getTimeoutInstances 
} from '../runtime-limiter.js';
import { isAdmin } from '../database.js';

const router = express.Router();

// 验证管理员权限的中间件
const adminAuthMiddleware = (req, res, next) => {
    if (!req.user || !isAdmin(req.user.username)) {
        return res.status(403).json({ error: '需要管理员权限' });
    }
    next();
};

// 获取运行时长限制配置
router.get('/config', adminAuthMiddleware, (req, res) => {
    try {
        const config = getRuntimeLimitConfig();
        res.json({ success: true, config });
    } catch (error) {
        console.error('[Runtime Limiter] 获取配置失败:', error);
        res.status(500).json({ error: '获取配置失败: ' + error.message });
    }
});

// 更新运行时长限制配置
router.put('/config', adminAuthMiddleware, (req, res) => {
    try {
        const { enabled, maxRuntimeMinutes, warningMinutes, checkIntervalSeconds } = req.body;
        
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
        
        if (checkIntervalSeconds < 10 || checkIntervalSeconds > 3600) { // 10秒到1小时
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
            checkIntervalSeconds
        );
        
        res.json({ 
            success: true, 
            message: '配置已更新',
            enabled: !!enabled,
            maxRuntimeMinutes,
            warningMinutes,
            checkIntervalSeconds
        });
    } catch (error) {
        console.error('[Runtime Limiter] 更新配置失败:', error);
        res.status(500).json({ error: '更新配置失败: ' + error.message });
    }
});

// 获取当前运行实例状态
router.get('/status', adminAuthMiddleware, (req, res) => {
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

export default router;
