import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { findUserByUsername } from '../database.js';
import {
    startInstance,
    stopInstance,
    restartInstance,
    getInstanceStatus
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
            dataDir: user.data_dir,
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
        
        // 检查是否已经在运行
        const status = await getInstanceStatus(user.username);
        if (status && status.status === 'online') {
            return res.status(400).json({ error: 'Instance is already running' });
        }
        
        await startInstance(user.username, user.port, user.data_dir);
        
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

export default router;
