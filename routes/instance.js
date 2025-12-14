import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { findUserByUsername } from '../database.js';
import {
    startInstance,
    stopInstance,
    restartInstance,
    getInstanceStatus,
    getInstanceLogs
} from '../pm2-manager.js';

const router = express.Router();

// 所有路由都需要认证
router.use(authenticateToken);

// 获取当前用户信息
router.get('/info', (req, res) => {
    try {
        const user = findUserByUsername(req.user.username);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            port: user.port,
            role: user.role || 'user',
            dataDir: user.data_dir,
            stDir: user.st_dir,
            stVersion: user.st_version,
            stSetupStatus: user.st_setup_status,
            status: user.status,
            createdAt: user.created_at,
            accessUrl: `http://localhost:${user.port}`
        });
    } catch (error) {
        console.error('Get user info error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 启动实例
router.post('/start', async (req, res) => {
    try {
        const user = findUserByUsername(req.user.username);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // 检查 ST 是否已设置
        if (user.st_setup_status !== 'completed') {
            return res.status(400).json({ 
                error: 'SillyTavern not set up yet. Please select and install a version first.',
                setup_status: user.st_setup_status
            });
        }
        
        // 检查是否已经在运行
        const status = await getInstanceStatus(user.username);
        if (status && status.status === 'online') {
            return res.status(400).json({ error: 'Instance is already running' });
        }
        
        // 数据目录
        const dataDir = user.data_dir.replace(/sillytavern$/, 'st-data');
        
        await startInstance(user.username, user.port, user.st_dir, dataDir);
        
        res.json({
            message: 'Instance started successfully',
            accessUrl: `http://localhost:${user.port}`
        });
    } catch (error) {
        console.error('Start instance error:', error);
        res.status(500).json({ error: 'Failed to start instance: ' + error.message });
    }
});

// 停止实例
router.post('/stop', async (req, res) => {
    try {
        const user = findUserByUsername(req.user.username);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        await stopInstance(user.username);
        
        res.json({
            message: 'Instance stopped successfully'
        });
    } catch (error) {
        console.error('Stop instance error:', error);
        res.status(500).json({ error: 'Failed to stop instance: ' + error.message });
    }
});

// 重启实例
router.post('/restart', async (req, res) => {
    try {
        const user = findUserByUsername(req.user.username);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        await restartInstance(user.username);
        
        res.json({
            message: 'Instance restarted successfully',
            accessUrl: `http://localhost:${user.port}`
        });
    } catch (error) {
        console.error('Restart instance error:', error);
        res.status(500).json({ error: 'Failed to restart instance: ' + error.message });
    }
});

// 获取实例状态
router.get('/status', async (req, res) => {
    try {
        const user = findUserByUsername(req.user.username);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const status = await getInstanceStatus(user.username);
        
        if (!status) {
            res.json({
                status: 'stopped',
                cpu: 0,
                memory: 0,
                uptime: 0,
                restarts: 0
            });
        } else {
            res.json({
                status: status.status,
                cpu: status.cpu,
                memory: status.memory,
                uptime: status.uptime,
                restarts: status.restarts
            });
        }
    } catch (error) {
        console.error('Get instance status error:', error);
        res.status(500).json({ error: 'Failed to get instance status' });
    }
});

// 获取实例日志
router.get('/logs', async (req, res) => {
    try {
        const user = findUserByUsername(req.user.username);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const logType = req.query.type || 'out'; // 'out' 或 'error'
        const lines = parseInt(req.query.lines) || 100;
        
        const logData = await getInstanceLogs(user.username, logType, lines);
        
        res.json({
            logs: logData.logs,
            exists: logData.exists,
            totalLines: logData.totalLines,
            type: logType
        });
    } catch (error) {
        console.error('Get instance logs error:', error);
        res.status(500).json({ error: 'Failed to get instance logs' });
    }
});

export default router;
