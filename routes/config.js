import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { getConfig, getNginxConfig, updateNginxConfig, getSystemConfig, updateSystemConfig } from '../utils/config-manager.js';
import { generateNginxConfig } from '../scripts/generate-nginx-config.js';
import { reloadNginx, getNginxStatus, getNginxConfigPath } from '../utils/nginx-reload.js';
import { testNginxConfig, getNginxTemplate, renderNginxConfig } from '../utils/nginx-test.js';

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
        // 获取当前操作系统
        const isWindows = process.platform === 'win32';
        console.log(`[Config] 检测到操作系统: ${isWindows ? 'Windows' : 'Linux/Unix'}`);
        
        // 生成配置文件
        try {
            // 确保数据库已初始化
            console.log('[Config] 检查数据库连接...');
            
            // 使用动态导入来测试数据库
            try {
                const { db } = await import('../database.js');
                if (!db) {
                    throw new Error('数据库对象不可用');
                }
                console.log('[Config] 数据库连接正常');
            } catch (dbError) {
                throw new Error(`数据库连接错误: ${dbError.message}`);
            }
            
            await generateNginxConfig();
            console.log('[Config] Nginx 配置文件已生成');
        } catch (genError) {
            console.error('[Config] 生成Nginx配置文件失败:', genError.message);
            return res.status(500).json({
                error: `生成配置文件失败: ${genError.message}`,
                details: genError.stack
            });
        }
        
        // 获取配置文件路径
        const configPath = getNginxConfigPath();
        
        // Windows环境下仅生成文件，不尝试重载
        if (isWindows) {
            console.log('[Config] Windows环境下仅生成配置文件，不尝试重载');
            return res.json({
                success: true,
                message: 'Nginx configuration file generated successfully on Windows',
                path: configPath,
                method: 'windows_simulation',
                info: '在Windows环境下，配置文件只会被生成，但不会尝试重载Nginx'
            });
        }
        
        // Linux环境下进行重载尝试
        try {
            // 自动重载 Nginx
            const reloadResult = await reloadNginx();
            
            if (reloadResult.success) {
                console.log(`[Config] ✅ Nginx 配置已自动重载 (方式: ${reloadResult.method || 'unknown'})`);
                res.json({ 
                    success: true,
                    message: 'Nginx configuration file generated and reloaded successfully',
                    reloadMethod: reloadResult.method,
                    path: configPath
                });
            } else {
                console.warn('[Config] ⚠️ Nginx 配置重载失败:', reloadResult.error);
                res.json({ 
                    success: true, // 说明文件生成成功了
                    message: 'Nginx configuration file generated, but reload failed',
                    warning: reloadResult.error,
                    needManualReload: true,
                    path: configPath
                });
            }
        } catch (reloadError) {
            console.error('[Config] 重载过程出错:', reloadError.message);
            res.json({
                success: true, // 文件生成成功，尽管重载失败
                message: 'Nginx configuration file generated, but reload process errored',
                error: reloadError.message,
                needManualReload: true,
                path: configPath
            });
        }
    } catch (error) {
        console.error('Generate nginx config error:', error);
        res.status(500).json({
            error: 'Failed to generate nginx config file',
            message: error.message
        });
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

// 测试Nginx配置
router.post('/nginx/test', async (req, res) => {
    try {
        // 获取配置对象
        const { enabled, domain, port, template = 'basic', ssl_cert_path, log_dir } = req.body;
        
        // 获取对应的配置模板
        const templateContent = getNginxTemplate(template);
        if (!templateContent) {
            return res.status(400).json({ 
                error: '未找到指定的配置模板', 
                available_templates: ['basic', 'advanced', 'https', 'multiuser']
            });
        }
        
        // 渲染配置内容
        const configContent = renderNginxConfig(templateContent, domain, port, {
            sslCertPath: ssl_cert_path,
            logDir: log_dir
        });
        
        // 测试配置语法
        const testResult = await testNginxConfig(configContent);
        
        // 返回测试结果
        res.json(testResult);
        
    } catch (error) {
        console.error('Test nginx config error:', error);
        res.status(500).json({ 
            error: 'Failed to test nginx config', 
            message: error.message 
        });
    }
});

export default router;
