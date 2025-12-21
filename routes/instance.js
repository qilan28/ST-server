import express from 'express';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth.js';
import { findUserByUsername } from '../database.js';
import { 
    startInstance, 
    stopInstance, 
    restartInstance,
    getInstanceStatus,
    getInstanceLogs
} from '../pm2-manager.js';
import { generateAccessUrl } from '../utils/url-helper.js';

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
        
        // 获取多访问地址数据
        const accessUrlData = generateAccessUrl(user.username, user.port);
        
        // 组装完整的响应
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
            accessUrl: accessUrlData.mainUrl,     // 主访问地址
            accessUrls: accessUrlData            // 包含所有访问地址的对象
        });
    } catch (error) {
        console.error('Get user info error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 启动实例
router.post('/start', async (req, res) => {
    console.log('[API] 接收到启动实例请求，用户:', req.user?.username);
    
    try {
        if (!req.user || !req.user.username) {
            console.log('[API] 用户身份验证失败');
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const username = req.user.username;
        console.log(`[API] 查找用户 ${username} 信息...`);
        const user = findUserByUsername(username);
        
        if (!user) {
            console.log(`[API] 用户 ${username} 不存在`);
            return res.status(404).json({ error: 'User not found' });
        }
        
        // 检查 ST 是否已设置
        if (user.st_setup_status !== 'completed') {
            console.log(`[API] 用户 ${username} 的 SillyTavern 尚未安装完成, 当前状态: ${user.st_setup_status}`);
            return res.status(400).json({ 
                error: 'SillyTavern not set up yet. Please select and install a version first.',
                setup_status: user.st_setup_status
            });
        }
        
        // 检查是否已经在运行
        console.log(`[API] 检查实例 ${username} 状态...`);
        let status;
        try {
            status = await getInstanceStatus(username);
            console.log(`[API] 实例 ${username} 状态:`, status ? status.status : 'not found');
            
            if (status && status.status === 'online') {
                console.log(`[API] 实例 ${username} 已经在运行`);
                return res.status(400).json({ error: 'Instance is already running' });
            }
        } catch (statusError) {
            console.log(`[API] 检查实例状态时出错，尝试启动新实例:`, statusError);
            // 即使状态检查失败也继续尝试启动
        }
        
        // 数据目录
        const dataDir = path.join(user.data_dir, 'st-data');
        console.log(`[API] 用户 ${username} 数据目录: ${dataDir}`);
        
        // 确保数据目录存在
        if (!fs.existsSync(dataDir)) {
            console.log(`[API] 创建数据目录: ${dataDir}`);
            try {
                fs.mkdirSync(dataDir, { recursive: true });
            } catch (mkdirError) {
                console.error(`[API] 创建目录失败:`, mkdirError);
                return res.status(500).json({ error: `Failed to create data directory: ${mkdirError.message}` });
            }
        }
        
        // 检查ST目录
        console.log(`[API] 检查ST目录: ${user.st_dir}`);
        if (!fs.existsSync(user.st_dir)) {
            console.error(`[API] ST目录不存在: ${user.st_dir}`);
            return res.status(400).json({ 
                error: 'SillyTavern directory does not exist. Please reinstall.',
                setup_status: 'failed'
            });
        }
        
        console.log(`[API] 开始启动实例 ${username}...`);
        const result = await startInstance(username, user.port, user.st_dir, dataDir);
        
        // 使用实际分配的端口生成访问URL
        const actualPort = result.port;
        console.log(`[API] 实例 ${username} 启动成功，端口: ${actualPort}`);
        
        // 导入 generateAccessUrl 函数
        const { generateAccessUrl } = await import('../utils/url-helper.js');
        
        // 获取多个访问地址
        const accessUrlData = generateAccessUrl(username, actualPort);
        
        res.json({
            success: true,
            message: 'Instance started successfully',
            port: actualPort, // 返回实际使用的端口
            originalPort: user.port, // 返回原始端口
            portChanged: actualPort !== user.port, // 指示端口是否发生变化
            accessUrl: accessUrlData.mainUrl, // 为了兼容性保留一个主地址字符串
            accessUrls: accessUrlData // 新增字段，包含主地址和备用地址列表
        });
    } catch (error) {
        console.error('[API] 启动实例错误:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to start instance: ' + error.message 
        });
    }
});

// 停止实例
router.post('/stop', async (req, res) => {
    console.log('[API] 接收到停止实例请求，用户:', req.user?.username);
    
    try {
        if (!req.user || !req.user.username) {
            console.log('[API] 用户身份验证失败');
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const username = req.user.username;
        console.log(`[API] 查找用户 ${username} 信息...`);
        const user = findUserByUsername(username);
        
        if (!user) {
            console.log(`[API] 用户 ${username} 不存在`);
            return res.status(404).json({ error: 'User not found' });
        }
        
        // 检查是否在运行
        console.log(`[API] 检查实例 ${username} 状态...`);
        try {
            const status = await getInstanceStatus(username);
            if (!status || status.status !== 'online') {
                console.log(`[API] 实例 ${username} 已经停止或不存在`);
                // 仍然执行停止操作以确保状态一致性
            }
        } catch (statusError) {
            console.log(`[API] 检查实例状态时出错，继续停止操作:`, statusError);
        }
        
        console.log(`[API] 开始停止实例 ${username}...`);
        await stopInstance(username);
        console.log(`[API] 实例 ${username} 停止成功`);
        
        res.json({
            success: true,
            message: 'Instance stopped successfully'
        });
    } catch (error) {
        console.error('[API] 停止实例错误:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to stop instance: ' + error.message 
        });
    }
});

// 重启实例
router.post('/restart', async (req, res) => {
    console.log('[API] 接收到重启实例请求，用户:', req.user?.username);
    
    try {
        if (!req.user || !req.user.username) {
            console.log('[API] 用户身份验证失败');
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const username = req.user.username;
        console.log(`[API] 查找用户 ${username} 信息...`);
        const user = findUserByUsername(username);
        
        if (!user) {
            console.log(`[API] 用户 ${username} 不存在`);
            return res.status(404).json({ error: 'User not found' });
        }
        
        // 检查ST目录
        console.log(`[API] 检查ST目录: ${user.st_dir}`);
        if (!fs.existsSync(user.st_dir)) {
            console.error(`[API] ST目录不存在: ${user.st_dir}`);
            return res.status(400).json({ 
                error: 'SillyTavern directory does not exist. Please reinstall.',
                setup_status: 'failed'
            });
        }
        
        // 记录原始端口
        const originalPort = user.port;
        console.log(`[API] 开始重启实例 ${username}...`);
        const result = await restartInstance(username);
        console.log(`[API] 重启成功，端口: ${result.port}`);
        
        // 重启后，端口可能已经变化
        const actualPort = result.port;
        
        // 导入 generateAccessUrl 函数
        const { generateAccessUrl } = await import('../utils/url-helper.js');
        
        // 获取多个访问地址
        const accessUrlData = generateAccessUrl(username, actualPort);
        
        res.json({
            success: true,
            message: 'Instance restarted successfully',
            port: actualPort, // 返回实际使用的端口
            originalPort: originalPort, // 返回原始端口
            portChanged: actualPort !== originalPort, // 指示端口是否发生变化
            accessUrl: accessUrlData.mainUrl, // 为了兼容性保留一个主地址字符串
            accessUrls: accessUrlData // 新增字段，包含主地址和备用地址列表
        });
    } catch (error) {
        console.error('[API] 重启实例错误:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to restart instance: ' + error.message 
        });
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
