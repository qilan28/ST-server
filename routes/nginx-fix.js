import express from 'express';
import { generateSimpleNginxConfig } from '../scripts/generate-simple-nginx-config.js';
import { reloadNginx } from '../utils/nginx-reload.js';

const router = express.Router();

// 修复静态文件404问题的API
router.post('/fix-static-files', async (req, res) => {
    try {
        console.log('[API] 开始修复静态文件404问题...');
        
        // 重新生成Nginx配置
        console.log('[API] 重新生成Nginx配置...');
        await generateSimpleNginxConfig();
        
        // 强制重载Nginx
        console.log('[API] 重载Nginx配置...');
        const reloadResult = await reloadNginx(null, true);
        
        if (reloadResult.success) {
            console.log(`[API] Nginx重载成功，方法: ${reloadResult.method}`);
            res.json({
                success: true,
                message: '静态文件404问题修复完成',
                reloadMethod: reloadResult.method
            });
        } else {
            console.error(`[API] Nginx重载失败: ${reloadResult.error}`);
            res.status(500).json({
                success: false,
                error: `Nginx重载失败: ${reloadResult.error}`
            });
        }
        
    } catch (error) {
        console.error('[API] 修复过程出错:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 重新生成Nginx配置的API
router.post('/regenerate-nginx', async (req, res) => {
    try {
        console.log('[API] 重新生成Nginx配置...');
        await generateSimpleNginxConfig();
        
        res.json({
            success: true,
            message: 'Nginx配置重新生成完成'
        });
        
    } catch (error) {
        console.error('[API] 生成配置出错:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
