import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { getConfig, getNginxConfig, updateNginxConfig, getSystemConfig, updateSystemConfig } from '../utils/config-manager.js';
import { generateNginxConfig } from '../scripts/generate-nginx-config.js';
import { reloadNginx, getNginxStatus, getNginxConfigPath } from '../utils/nginx-reload.js';

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
router.post('/nginx/generate', async (req, res) => {
    try {
        // 生成配置文件
        generateNginxConfig();
        console.log('[Config] Nginx 配置文件已生成');
        
        // 自动重载 Nginx
        const reloadResult = await reloadNginx();
        
        if (reloadResult.success) {
            console.log(`[Config] ✅ Nginx 配置已自动重载 (方式: ${reloadResult.method || 'unknown'})`);
            res.json({ 
                message: 'Nginx configuration file generated and reloaded successfully',
                reloadMethod: reloadResult.method
            });
        } else {
            console.error('[Config] ⚠️ Nginx 配置重载失败:', reloadResult.error);
            res.json({ 
                message: 'Nginx configuration file generated, but reload failed',
                warning: reloadResult.error,
                needManualReload: true
            });
        }
    } catch (error) {
        console.error('Generate nginx config error:', error);
        res.status(500).json({ error: 'Failed to generate nginx config file' });
    }
});

// 获取 Nginx 状态
router.get('/nginx/status', async (req, res) => {
    try {
        const status = await getNginxStatus();
        const configPath = getNginxConfigPath();
        
        res.json({
            status,
            configPath,
            projectConfigPath: configPath
        });
    } catch (error) {
        console.error('Get nginx status error:', error);
        res.status(500).json({ error: 'Failed to get nginx status' });
    }
});

// 手动重载 Nginx
router.post('/nginx/reload', async (req, res) => {
    try {
        const reloadResult = await reloadNginx();
        
        if (reloadResult.success) {
            res.json({
                message: 'Nginx reloaded successfully',
                method: reloadResult.method
            });
        } else {
            res.status(500).json({
                error: 'Failed to reload Nginx',
                details: reloadResult.error
            });
        }
    } catch (error) {
        console.error('Reload nginx error:', error);
        res.status(500).json({ error: 'Failed to reload nginx' });
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
