import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { 
    getAllUsersAdmin, 
    findUserByUsername,
    updateUserRole,
    deleteUser,
    isAdmin,
    getAllAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    toggleAnnouncementStatus,
    getAutoBackupConfig,
    updateAutoBackupConfig,
    getUsersForAutoBackup
} from '../database.js';
import { 
    startInstance,
    stopInstance,
    restartInstance,
    listAllInstances,
    deleteInstance
} from '../pm2-manager.js';
import { generateAccessUrl } from '../utils/url-helper.js';
import { deleteSillyTavern } from '../git-manager.js';
import { 
    reloadAutoBackupScheduler, 
    triggerManualBackup,
    getAutoBackupStatus
} from '../services/auto-backup.js';
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
            lastLoginAt: user.last_login_at,
            stVersion: user.st_version,
            stSetupStatus: user.st_setup_status,
            createdAt: user.created_at,
            // 管理员不需要访问地址，非管理员生成多访问地址
            accessUrl: user.role === 'admin' ? null : generateAccessUrl(user.username, user.port).mainUrl,
            accessUrls: user.role === 'admin' ? null : generateAccessUrl(user.username, user.port)
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
        
        const result = await startInstance(user.username, user.port, user.st_dir, user.data_dir);
        
        // 返回实际使用的端口
        const actualPort = result.port || user.port;
        
        res.json({ 
            message: 'Instance started successfully',
            port: actualPort,
            originalPort: user.port,
            portChanged: actualPort !== user.port
        });
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
        
        const result = await restartInstance(user.username);
        
        // 重新获取用户信息以获取最新端口
        const updatedUser = findUserByUsername(username);
        const actualPort = updatedUser ? updatedUser.port : user.port;
        
        res.json({ 
            message: 'Instance restarted successfully',
            port: actualPort,
            originalPort: user.port,
            portChanged: actualPort !== user.port
        });
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
        
        const allUsers = getAllUsersAdmin();
        
        // 防止删除最后一个管理员
        if (user.role === 'admin' && role === 'user') {
            const adminCount = allUsers.filter(u => u.role === 'admin').length;
            
            if (adminCount <= 1) {
                return res.status(400).json({ 
                    error: 'Cannot remove the last admin user',
                    message: '不能删除最后一个管理员用户'
                });
            }
        }
        
        // 限制只能有一个管理员
        if (user.role === 'user' && role === 'admin') {
            const adminCount = allUsers.filter(u => u.role === 'admin').length;
            
            if (adminCount >= 1) {
                return res.status(400).json({ 
                    error: 'Only one admin user is allowed',
                    message: '系统只允许有一个管理员用户'
                });
            }
        }
        
        updateUserRole(username, role);
        
        // 如果用户被设置为管理员，清除其端口和实例相关数据
        if (role === 'admin') {
            const { updateUserPort, updateUserSetupStatus } = await import('../database.js');
            updateUserPort(username, 0);
            updateUserSetupStatus(username, 'N/A');
        }
        
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

// ==================== 公告管理 ====================

// 获取所有公告
router.get('/announcements', async (req, res) => {
    try {
        const announcements = getAllAnnouncements();
        res.json({ announcements });
    } catch (error) {
        console.error('Get announcements error:', error);
        res.status(500).json({ error: 'Failed to get announcements' });
    }
});

// 创建公告
router.post('/announcements', async (req, res) => {
    try {
        const { type, title, content } = req.body;
        
        if (!type || !title || !content) {
            return res.status(400).json({ error: 'Type, title and content are required' });
        }
        
        if (!['login', 'dashboard'].includes(type)) {
            return res.status(400).json({ error: 'Invalid type. Must be login or dashboard' });
        }
        
        const announcementId = createAnnouncement(type, title, content);
        res.json({ message: 'Announcement created successfully', id: announcementId });
    } catch (error) {
        console.error('Create announcement error:', error);
        res.status(500).json({ error: 'Failed to create announcement' });
    }
});

// 更新公告
router.put('/announcements/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, isActive } = req.body;
        
        if (!title || !content || isActive === undefined) {
            return res.status(400).json({ error: 'Title, content and isActive are required' });
        }
        
        updateAnnouncement(id, title, content, isActive ? 1 : 0);
        res.json({ message: 'Announcement updated successfully' });
    } catch (error) {
        console.error('Update announcement error:', error);
        res.status(500).json({ error: 'Failed to update announcement' });
    }
});

// 切换公告状态
router.patch('/announcements/:id/toggle', async (req, res) => {
    try {
        const { id } = req.params;
        toggleAnnouncementStatus(id);
        res.json({ message: 'Announcement status toggled successfully' });
    } catch (error) {
        console.error('Toggle announcement status error:', error);
        res.status(500).json({ error: 'Failed to toggle announcement status' });
    }
});

// 删除公告
router.delete('/announcements/:id', async (req, res) => {
    try {
        const { id } = req.params;
        deleteAnnouncement(id);
        res.json({ message: 'Announcement deleted successfully' });
    } catch (error) {
        console.error('Delete announcement error:', error);
        res.status(500).json({ error: 'Failed to delete announcement' });
    }
});

// ==================== 自动备份配置管理 ====================

// 获取自动备份配置
router.get('/auto-backup/config', (req, res) => {
    try {
        const config = getAutoBackupConfig();
        const status = getAutoBackupStatus();
        
        res.json({
            success: true,
            config: config,
            status: status
        });
    } catch (error) {
        console.error('Get auto backup config error:', error);
        res.status(500).json({ error: 'Failed to get auto backup config' });
    }
});

// 更新自动备份配置
router.put('/auto-backup/config', (req, res) => {
    try {
        const { enabled, interval_hours, backup_type } = req.body;
        
        // 验证参数
        if (interval_hours !== undefined && (interval_hours < 1 || interval_hours > 168)) {
            return res.status(400).json({ error: '间隔时间必须在 1-168 小时之间' });
        }
        
        const validBackupTypes = ['all', 'logged_in_today', 'running'];
        if (backup_type !== undefined && !validBackupTypes.includes(backup_type)) {
            return res.status(400).json({ error: '无效的备份类型' });
        }
        
        // 更新配置
        updateAutoBackupConfig(
            enabled !== undefined ? (enabled ? 1 : 0) : undefined,
            interval_hours,
            backup_type
        );
        
        // 重新加载调度器
        reloadAutoBackupScheduler();
        
        const newConfig = getAutoBackupConfig();
        res.json({
            success: true,
            message: '自动备份配置已更新',
            config: newConfig
        });
    } catch (error) {
        console.error('Update auto backup config error:', error);
        res.status(500).json({ error: 'Failed to update auto backup config' });
    }
});

// 获取符合备份条件的用户列表
router.get('/auto-backup/users', (req, res) => {
    try {
        const config = getAutoBackupConfig();
        
        // 始终显示所有潜在用户，而不仅显示已设置完成的用户
        const showAll = true;
        const users = getUsersForAutoBackup(config.backup_type, showAll);
        
        // 只返回必要的信息
        const userList = users.map(user => ({
            username: user.username,
            email: user.email,
            status: user.status,
            last_login_at: user.last_login_at,
            hasHFConfig: !!(user.hf_token && user.hf_repo),
            auto_backup_enabled: Boolean(user.auto_backup_enabled)
        }));
        
        // 计算统计信息
        const eligibleUsers = userList.filter(user => 
            user.hasHFConfig && user.auto_backup_enabled
        );
        
        const stats = {
            total: userList.length,
            eligible: eligibleUsers.length,
            missing_config: userList.filter(u => !u.hasHFConfig).length,
            disabled: userList.filter(u => !u.auto_backup_enabled).length
        };
        
        res.json({
            success: true,
            backup_type: config.backup_type,
            total: userList.length,
            eligible: eligibleUsers.length,
            stats: stats,
            users: userList
        });
    } catch (error) {
        console.error('Get auto backup users error:', error);
        res.status(500).json({ error: 'Failed to get auto backup users' });
    }
});

// 手动触发自动备份
router.post('/auto-backup/trigger', async (req, res) => {
    try {
        const status = getAutoBackupStatus();
        
        if (status.isRunning) {
            return res.status(400).json({ error: '备份任务正在运行中' });
        }
        
        // 异步执行备份
        triggerManualBackup().catch(error => {
            console.error('[自动备份] 手动触发失败:', error);
        });
        
        res.json({
            success: true,
            message: '自动备份已触发，正在后台执行'
        });
    } catch (error) {
        console.error('Trigger auto backup error:', error);
        res.status(500).json({ error: 'Failed to trigger auto backup' });
    }
});

export default router;
