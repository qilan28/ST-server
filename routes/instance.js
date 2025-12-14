import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { startInstance, stopInstance, restartInstance, getInstanceStatus } from '../pm2-manager.js';
import { findUserByUsername, updateUserSTInfo, updateSTSetupStatus } from '../database.js';
import { detectSillyTavernInstallation, getGitVersion } from '../utils/st-detector.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// 所有路由都需要认证
router.use(authenticateToken);

// 获取当前用户信息
router.get('/info', async (req, res) => {
    try {
        const user = findUserByUsername(req.user.username);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // 自动检测 SillyTavern 安装状态
        const userBaseDir = path.join(__dirname, '..', 'data', user.username);
        const stDir = path.join(userBaseDir, 'sillytavern');
        
        // 如果数据库中状态不是 completed，尝试检测现有安装
        if (user.st_setup_status !== 'completed') {
            const detection = detectSillyTavernInstallation(stDir);
            
            if (detection.isValid) {
                // 检测到有效的安装，更新数据库
                console.log(`[${user.username}] Detected existing SillyTavern installation`);
                
                const gitVersion = getGitVersion(stDir) || detection.version || 'unknown';
                updateUserSTInfo(user.username, stDir, gitVersion, 'completed');
                
                // 重新获取更新后的用户信息
                const updatedUser = findUserByUsername(req.user.username);
                
                res.json({
                    id: updatedUser.id,
                    username: updatedUser.username,
                    email: updatedUser.email,
                    port: updatedUser.port,
                    dataDir: updatedUser.data_dir,
                    stDir: updatedUser.st_dir,
                    stVersion: updatedUser.st_version,
                    stSetupStatus: updatedUser.st_setup_status,
                    status: updatedUser.status,
                    createdAt: updatedUser.created_at,
                    accessUrl: `http://localhost:${updatedUser.port}`,
                    autoDetected: true  // 标记为自动检测
                });
                return;
            }
        }
        
        // 返回当前数据库中的信息
        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            port: user.port,
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

// 手动检测 SillyTavern 安装
router.post('/detect', async (req, res) => {
    try {
        const user = findUserByUsername(req.user.username);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const userBaseDir = path.join(__dirname, '..', 'data', user.username);
        const stDir = path.join(userBaseDir, 'sillytavern');
        
        const detection = detectSillyTavernInstallation(stDir);
        
        if (detection.isValid) {
            // 检测到有效的安装，更新数据库
            const gitVersion = getGitVersion(stDir) || detection.version || 'unknown';
            updateUserSTInfo(user.username, stDir, gitVersion, 'completed');
            
            res.json({
                success: true,
                message: 'SillyTavern installation detected and registered',
                detection: detection,
                version: gitVersion
            });
        } else {
            res.json({
                success: false,
                message: 'No valid SillyTavern installation found',
                detection: detection
            });
        }
    } catch (error) {
        console.error('Detect installation error:', error);
        res.status(500).json({ error: 'Failed to detect installation' });
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
