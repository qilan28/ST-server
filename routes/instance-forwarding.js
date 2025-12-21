import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import {
    getForwardingConfig,
    updateForwardingConfig,
    getAllForwardingServers,
    getActiveForwardingServers,
    findForwardingServerById,
    addForwardingServer,
    updateForwardingServer,
    toggleForwardingServerStatus,
    deleteForwardingServer
} from '../database-instance-forwarding.js';

const router = express.Router();

// 所有路由都需要认证和管理员权限
router.use(authenticateToken);
router.use(requireAdmin);

// 获取转发配置
router.get('/config', (req, res) => {
    try {
        const config = getForwardingConfig();
        res.json({ 
            success: true,
            config
        });
    } catch (error) {
        console.error('Get forwarding config error:', error);
        res.status(500).json({ error: 'Failed to get forwarding config' });
    }
});

// 更新转发配置
router.put('/config', (req, res) => {
    try {
        const { enabled, main_port } = req.body;
        
        // 验证参数
        if (main_port !== undefined) {
            const portNum = parseInt(main_port);
            if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
                return res.status(400).json({ error: '端口必须在 1-65535 之间' });
            }
        }
        
        // 更新配置
        const config = {
            enabled: enabled !== undefined ? (enabled === true || enabled === 'true' || enabled === 1) : undefined,
            main_port: main_port !== undefined ? parseInt(main_port) : undefined
        };
        
        updateForwardingConfig(config);
        
        const updatedConfig = getForwardingConfig();
        res.json({
            success: true,
            message: '转发配置已更新',
            config: updatedConfig
        });
    } catch (error) {
        console.error('Update forwarding config error:', error);
        res.status(500).json({ error: 'Failed to update forwarding config' });
    }
});

// 获取所有转发服务器
router.get('/servers', (req, res) => {
    try {
        const servers = getAllForwardingServers();
        res.json({ 
            success: true,
            servers 
        });
    } catch (error) {
        console.error('Get forwarding servers error:', error);
        res.status(500).json({ error: 'Failed to get forwarding servers' });
    }
});

// 获取活跃的转发服务器
router.get('/servers/active', (req, res) => {
    try {
        const servers = getActiveForwardingServers();
        res.json({ 
            success: true,
            servers 
        });
    } catch (error) {
        console.error('Get active forwarding servers error:', error);
        res.status(500).json({ error: 'Failed to get active forwarding servers' });
    }
});

// 添加新的转发服务器
router.post('/servers', (req, res) => {
    try {
        const { address, port } = req.body;
        
        // 验证参数
        if (!address || !port) {
            return res.status(400).json({ error: 'Address and port are required' });
        }
        
        // 验证地址格式
        if (!address.match(/^[a-zA-Z0-9][-a-zA-Z0-9.]*[a-zA-Z0-9](\.[a-zA-Z0-9][-a-zA-Z0-9.]*[a-zA-Z0-9])*$/) && 
            !address.match(/^([0-9]{1,3}\.){3}[0-9]{1,3}$/)) {
            return res.status(400).json({ error: 'Invalid address format' });
        }
        
        // 验证端口
        const portNum = parseInt(port);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            return res.status(400).json({ error: 'Port must be between 1 and 65535' });
        }
        
        const id = addForwardingServer(address, portNum);
        const newServer = findForwardingServerById(id);
        
        res.json({ 
            success: true,
            message: '转发服务器已添加',
            server: newServer
        });
    } catch (error) {
        console.error('Add forwarding server error:', error);
        res.status(500).json({ error: 'Failed to add forwarding server' });
    }
});

// 更新转发服务器
router.put('/servers/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { address, port, is_active } = req.body;
        
        // 验证参数
        if (!address || port === undefined) {
            return res.status(400).json({ error: 'Address and port are required' });
        }
        
        // 验证地址格式
        if (!address.match(/^[a-zA-Z0-9][-a-zA-Z0-9.]*[a-zA-Z0-9](\.[a-zA-Z0-9][-a-zA-Z0-9.]*[a-zA-Z0-9])*$/) && 
            !address.match(/^([0-9]{1,3}\.){3}[0-9]{1,3}$/)) {
            return res.status(400).json({ error: 'Invalid address format' });
        }
        
        // 验证端口
        const portNum = parseInt(port);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            return res.status(400).json({ error: 'Port must be between 1 and 65535' });
        }
        
        // 验证ID
        const server = findForwardingServerById(id);
        if (!server) {
            return res.status(404).json({ error: 'Forwarding server not found' });
        }
        
        const isActiveValue = is_active !== undefined ? 
            (is_active === true || is_active === 'true' || is_active === 1) : 
            server.is_active === 1;
        
        updateForwardingServer(id, address, portNum, isActiveValue);
        const updatedServer = findForwardingServerById(id);
        
        res.json({
            success: true,
            message: '转发服务器已更新',
            server: updatedServer
        });
    } catch (error) {
        console.error('Update forwarding server error:', error);
        res.status(500).json({ error: 'Failed to update forwarding server' });
    }
});

// 切换转发服务器状态
router.patch('/servers/:id/toggle', (req, res) => {
    try {
        const { id } = req.params;
        
        // 验证ID
        const server = findForwardingServerById(id);
        if (!server) {
            return res.status(404).json({ error: 'Forwarding server not found' });
        }
        
        toggleForwardingServerStatus(id);
        const updatedServer = findForwardingServerById(id);
        
        res.json({
            success: true,
            message: '转发服务器状态已切换',
            server: updatedServer
        });
    } catch (error) {
        console.error('Toggle forwarding server status error:', error);
        res.status(500).json({ error: 'Failed to toggle forwarding server status' });
    }
});

// 删除转发服务器
router.delete('/servers/:id', (req, res) => {
    try {
        const { id } = req.params;
        
        // 验证ID
        const server = findForwardingServerById(id);
        if (!server) {
            return res.status(404).json({ error: 'Forwarding server not found' });
        }
        
        deleteForwardingServer(id);
        
        res.json({
            success: true,
            message: '转发服务器已删除'
        });
    } catch (error) {
        console.error('Delete forwarding server error:', error);
        res.status(500).json({ error: 'Failed to delete forwarding server' });
    }
});

export default router;
