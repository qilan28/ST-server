import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { 
    getAllUsersAdmin, 
    updateUserRole, 
    deleteUser,
    findUserByUsername 
} from '../database.js';
import {
    startInstance,
    stopInstance,
    restartInstance,
    deleteInstance,
    listAllInstances
} from '../pm2-manager.js';
import { deleteSillyTavern } from '../git-manager.js';
import fs from 'fs';

const router = express.Router();

// 所有路由都需要认证和管理员权限
router.use(authenticateToken);
router.use(requireAdmin);

// 获取所有用户列表
router.get('/users', async (req, res) => {
    try {
        const users = getAllUsersAdmin();
        
        // 不返回密码
        const safeUsers = users.map(user => ({
            id: user.id,
            username: user.username,
            email: user.email,
            port: user.port,
            role: user.role,
            status: user.status,
            stVersion: user.st_version,
            stSetupStatus: user.st_setup_status,
            createdAt: user.created_at
        }));
        
        res.json({ users: safeUsers });
    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// 获取所有实例状态
router.get('/instances', async (req, res) => {
    try {
        const instances = await listAllInstances();
        res.json({ instances });
    } catch (error) {
        console.error('Get instances error:', error);
        res.status(500).json({ error: 'Failed to get instances' });
    }
});

// 获取系统统计信息
router.get('/stats', async (req, res) => {
    try {
        const users = getAllUsersAdmin();
        const instances = await listAllInstances();
        
        const totalUsers = users.length;
        const adminUsers = users.filter(u => u.role === 'admin').length;
        const runningInstances = instances.filter(i => i.status === 'online').length;
        const stoppedInstances = instances.filter(i => i.status === 'stopped').length;
        
        // 计算总资源使用
        let totalCpu = 0;
        let totalMemory = 0;
        instances.forEach(instance => {
            if (instance.status === 'online') {
                totalCpu += instance.cpu || 0;
                totalMemory += instance.memory || 0;
            }
        });
        
        res.json({
            stats: {
                totalUsers,
                adminUsers,
                regularUsers: totalUsers - adminUsers,
                runningInstances,
                stoppedInstances,
                totalInstances: instances.length,
                totalCpu: totalCpu.toFixed(2),
                totalMemory: (totalMemory / 1024 / 1024).toFixed(2) // MB
            }
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// 启动指定用户的实例
router.post('/users/:username/start', async (req, res) => {
    try {
        const { username } = req.params;
        const user = findUserByUsername(username);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (!user.st_dir) {
            return res.status(400).json({ error: 'SillyTavern not set up for this user' });
        }
        
        await startInstance(user.username, user.port, user.st_dir, user.data_dir);
        res.json({ message: 'Instance started successfully' });
    } catch (error) {
        console.error('Start instance error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 停止指定用户的实例
router.post('/users/:username/stop', async (req, res) => {
    try {
        const { username } = req.params;
        const user = findUserByUsername(username);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        await stopInstance(user.username);
        res.json({ message: 'Instance stopped successfully' });
    } catch (error) {
        console.error('Stop instance error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 重启指定用户的实例
router.post('/users/:username/restart', async (req, res) => {
    try {
        const { username } = req.params;
        const user = findUserByUsername(username);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        await restartInstance(user.username);
        res.json({ message: 'Instance restarted successfully' });
    } catch (error) {
        console.error('Restart instance error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 更新用户角色
router.put('/users/:username/role', async (req, res) => {
    try {
        const { username } = req.params;
        const { role } = req.body;
        
        if (!['admin', 'user'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role. Must be "admin" or "user"' });
        }
        
        const user = findUserByUsername(username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // 防止删除最后一个管理员
        if (user.role === 'admin' && role === 'user') {
            const allUsers = getAllUsersAdmin();
            const adminCount = allUsers.filter(u => u.role === 'admin').length;
            
            if (adminCount <= 1) {
                return res.status(400).json({ 
                    error: 'Cannot remove the last admin user',
                    message: '不能删除最后一个管理员用户'
                });
            }
        }
        
        updateUserRole(username, role);
        res.json({ message: 'User role updated successfully', role });
    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ error: 'Failed to update user role' });
    }
});

// 删除用户
router.delete('/users/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const user = findUserByUsername(username);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // 防止删除自己
        if (username === req.user.username) {
            return res.status(400).json({ 
                error: 'Cannot delete yourself',
                message: '不能删除自己的账户'
            });
        }
        
        // 防止删除最后一个管理员
        if (user.role === 'admin') {
            const allUsers = getAllUsersAdmin();
            const adminCount = allUsers.filter(u => u.role === 'admin').length;
            
            if (adminCount <= 1) {
                return res.status(400).json({ 
                    error: 'Cannot delete the last admin user',
                    message: '不能删除最后一个管理员用户'
                });
            }
        }
        
        // 停止并删除 PM2 实例
        try {
            await deleteInstance(username);
        } catch (err) {
            console.log('No PM2 instance to delete or already deleted');
        }
        
        // 删除 SillyTavern 目录
        if (user.st_dir && fs.existsSync(user.st_dir)) {
            await deleteSillyTavern(user.st_dir);
        }
        
        // 删除用户数据目录
        if (user.data_dir && fs.existsSync(user.data_dir)) {
            fs.rmSync(user.data_dir, { recursive: true, force: true });
        }
        
        // 从数据库删除用户
        deleteUser(username);
        
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

export default router;
