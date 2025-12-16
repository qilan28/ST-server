import express from 'express';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth.js';
import { 
    findUserByUsername, 
    updateUserHFConfig, 
    getUserHFConfig 
} from '../database.js';
import { 
    backupToHuggingFace, 
    testHuggingFaceConnection 
} from '../utils/hf-backup.js';

const router = express.Router();

// 获取用户的 Hugging Face 配置
router.get('/hf-config', authenticateToken, async (req, res) => {
    try {
        const username = req.user.username;
        const config = getUserHFConfig(username);
        
        // 返回配置（隐藏部分 token）
        res.json({
            success: true,
            config: {
                hfRepo: config?.hf_repo || '',
                hfEmail: config?.hf_email || '',
                hfTokenSet: !!config?.hf_token,
                hfTokenPreview: config?.hf_token ? 
                    `${config.hf_token.substring(0, 6)}...${config.hf_token.substring(config.hf_token.length - 4)}` : 
                    null
            }
        });
    } catch (error) {
        console.error('[Backup API] 获取配置失败:', error);
        res.status(500).json({ 
            success: false, 
            error: '获取配置失败' 
        });
    }
});

// 更新 Hugging Face 配置
router.post('/hf-config', authenticateToken, async (req, res) => {
    try {
        const username = req.user.username;
        const { hfToken, hfRepo, hfEmail } = req.body;
        
        // 验证输入
        if (!hfToken || !hfRepo || !hfEmail) {
            return res.status(400).json({ 
                success: false, 
                error: '缺少必要的配置信息（Token、仓库名、邮箱）' 
            });
        }

        // 验证仓库名格式
        if (!hfRepo.includes('/')) {
            return res.status(400).json({ 
                success: false, 
                error: '仓库名格式错误，应为: username/repo-name' 
            });
        }
        
        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(hfEmail)) {
            return res.status(400).json({ 
                success: false, 
                error: '邮箱格式不正确' 
            });
        }

        // 更新配置
        updateUserHFConfig(username, hfToken, hfRepo, hfEmail);
        
        console.log(`[Backup API] 用户 ${username} 更新了 HF 配置`);
        
        res.json({ 
            success: true, 
            message: '配置保存成功' 
        });
    } catch (error) {
        console.error('[Backup API] 更新配置失败:', error);
        res.status(500).json({ 
            success: false, 
            error: '保存配置失败' 
        });
    }
});

// 测试 Hugging Face 连接
router.post('/test-connection', authenticateToken, async (req, res) => {
    try {
        const username = req.user.username;
        const { hfToken, hfRepo } = req.body;
        
        // 如果没有提供配置，从数据库读取
        let token = hfToken;
        let repo = hfRepo;
        
        if (!token || !repo) {
            const config = getUserHFConfig(username);
            token = config?.hf_token;
            repo = config?.hf_repo;
        }

        if (!token || !repo) {
            return res.status(400).json({ 
                success: false, 
                error: '请先配置 Hugging Face Token 和仓库名' 
            });
        }

        // 测试连接
        const result = await testHuggingFaceConnection(token, repo);
        
        res.json(result);
    } catch (error) {
        console.error('[Backup API] 测试连接失败:', error);
        res.status(500).json({ 
            success: false, 
            error: '测试连接失败',
            message: error.message
        });
    }
});

// 执行备份（支持 GET 用于 SSE）
router.get('/backup', async (req, res) => {
    // 从 query 参数获取 token（用于 EventSource）
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({
            success: false,
            error: '未提供认证令牌'
        });
    }
    
    // 验证 token
    try {
        const jwt = await import('jsonwebtoken');
        const decoded = jwt.default.verify(token, process.env.JWT_SECRET);
        req.user = { username: decoded.username };
    } catch (error) {
        return res.status(401).json({
            success: false,
            error: '认证失败'
        });
    }
    try {
        const username = req.user.username;
        const user = findUserByUsername(username);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: '用户不存在' 
            });
        }

        // 获取用户的 HF 配置
        const config = getUserHFConfig(username);
        
        if (!config || !config.hf_token || !config.hf_repo) {
            return res.status(400).json({ 
                success: false, 
                error: '请先配置 Hugging Face Token 和仓库名' 
            });
        }
        
        // 检查数据目录是否存在
        const dataDir = path.join(user.data_dir, 'st-data');
        
        console.log(`[Backup API] 开始备份用户 ${username} 的数据`);
        console.log(`[Backup API] 数据目录: ${dataDir}`);
        
        // 检查目录是否存在
        if (!fs.existsSync(dataDir)) {
            return res.status(400).json({
                success: false,
                error: 'SillyTavern 尚未安装，请先安装后再备份'
            });
        }
        
        // 检查目录是否为空或只有系统文件
        const files = fs.readdirSync(dataDir);
        const contentFiles = files.filter(f => !f.startsWith('_') && !f.startsWith('.'));
        if (contentFiles.length === 0) {
            return res.status(400).json({
                success: false,
                error: '数据目录为空，请先启动 SillyTavern 实例生成数据后再备份'
            });
        }
        
        // 设置 SSE 响应头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        // 日志回调函数
        const logCallback = (message, type = 'info') => {
            const data = {
                type: type,
                message: message,
                timestamp: new Date().toISOString()
            };
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };
        
        // 发送开始消息
        logCallback('🚀 开始备份流程...', 'start');
        logCallback(`📂 数据目录: ${dataDir}`, 'info');
        
        // 执行备份
        try {
            const result = await backupToHuggingFace(
                dataDir,
                username,
                config.hf_token,
                config.hf_repo,
                config.hf_email || 'backup@sillytavern.local',
                logCallback  // 传递日志回调
            );
            
            // 发送成功消息
            logCallback('✅ 备份完成！', 'success');
            res.write(`data: ${JSON.stringify({ type: 'done', result: result })}\n\n`);
            res.end();
        } catch (error) {
            console.error('[Backup API] 备份失败:', error);
            logCallback(`❌ 备份失败: ${error.message}`, 'error');
            res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
            res.end();
        }
    } catch (error) {
        console.error('[Backup API] 备份失败:', error);
        res.status(500).json({ 
            success: false, 
            error: '备份失败',
            message: error.message
        });
    }
});

export default router;
