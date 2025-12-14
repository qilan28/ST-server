import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { getConfig, getNginxConfig, updateNginxConfig, getSystemConfig, updateSystemConfig } from '../utils/config-manager.js';
import { generateNginxConfig } from '../scripts/generate-nginx-config.js';

const router = express.Router();

// 所有路由都需要认证和管理员权限
router.use(authenticateToken);
router.use(requireAdmin);

// 获取完整配置
router.get('/', (req, res) => {
    try {
        const config = getConfig();
        res.json({ config });
    } catch (error) {
        console.error('Get config error:', error);
        res.status(500).json({ error: 'Failed to get config' });
    }
});

// 获取 Nginx 配置
router.get('/nginx', (req, res) => {
    try {
        const nginxConfig = getNginxConfig();
        res.json({ nginx: nginxConfig });
    } catch (error) {
        console.error('Get nginx config error:', error);
        res.status(500).json({ error: 'Failed to get nginx config' });
    }
});

// 更新 Nginx 配置
router.put('/nginx', (req, res) => {
    try {
        const { enabled, domain, port } = req.body;
        
        // 验证参数
        if (enabled !== undefined && typeof enabled !== 'boolean') {
            return res.status(400).json({ error: 'enabled must be a boolean' });
        }
        
        if (domain !== undefined && (typeof domain !== 'string' || domain.trim() === '')) {
            return res.status(400).json({ error: 'domain must be a non-empty string' });
        }
        
        if (port !== undefined) {
            const portNum = parseInt(port);
            if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
                return res.status(400).json({ error: 'port must be between 1 and 65535' });
            }
        }
        
        const nginxConfig = {};
        if (enabled !== undefined) nginxConfig.enabled = enabled;
        if (domain !== undefined) nginxConfig.domain = domain.trim();
        if (port !== undefined) nginxConfig.port = parseInt(port);
        
        const success = updateNginxConfig(nginxConfig);
        
        if (success) {
            const updatedConfig = getNginxConfig();
            res.json({ 
                message: 'Nginx configuration updated successfully',
                nginx: updatedConfig
            });
        } else {
            res.status(500).json({ error: 'Failed to update nginx config' });
        }
    } catch (error) {
        console.error('Update nginx config error:', error);
        res.status(500).json({ error: 'Failed to update nginx config' });
    }
});

// 生成 Nginx 配置文件
router.post('/nginx/generate', (req, res) => {
    try {
        generateNginxConfig();
        res.json({ message: 'Nginx configuration file generated successfully' });
    } catch (error) {
        console.error('Generate nginx config error:', error);
        res.status(500).json({ error: 'Failed to generate nginx config file' });
    }
});

// 获取系统配置
router.get('/system', (req, res) => {
    try {
        const systemConfig = getSystemConfig();
        res.json({ system: systemConfig });
    } catch (error) {
        console.error('Get system config error:', error);
        res.status(500).json({ error: 'Failed to get system config' });
    }
});

// 更新系统配置
router.put('/system', (req, res) => {
    try {
        const { allowRegistration, maxUsers } = req.body;
        
        const systemConfig = {};
        if (allowRegistration !== undefined) systemConfig.allowRegistration = !!allowRegistration;
        if (maxUsers !== undefined) {
            const max = parseInt(maxUsers);
            if (!isNaN(max) && max > 0) {
                systemConfig.maxUsers = max;
            }
        }
        
        const success = updateSystemConfig(systemConfig);
        
        if (success) {
            const updatedConfig = getSystemConfig();
            res.json({ 
                message: 'System configuration updated successfully',
                system: updatedConfig
            });
        } else {
            res.status(500).json({ error: 'Failed to update system config' });
        }
    } catch (error) {
        console.error('Update system config error:', error);
        res.status(500).json({ error: 'Failed to update system config' });
    }
});

export default router;
