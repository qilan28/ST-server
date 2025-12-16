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
        const { hfToken, hfRepo } = req.body;
        
        // 验证输入
        if (!hfToken || !hfRepo) {
            return res.status(400).json({ 
                success: false, 
                error: '缺少必要的配置信息' 
            });
        }

        // 验证仓库名格式
        if (!hfRepo.includes('/')) {
            return res.status(400).json({ 
                success: false, 
                error: '仓库名格式错误，应为: username/repo-name' 
            });
        }

        // 更新配置
        updateUserHFConfig(username, hfToken, hfRepo);
        
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

// 执行备份
router.post('/backup', authenticateToken, async (req, res) => {
    try {
        const username = req.user.username;
        const user = findUserByUsername(username);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                error: '用户不存在' 
            });
        }

        // 检查是否为管理员（管理员没有数据目录）
        if (user.role === 'admin') {
            return res.status(400).json({ 
                success: false, 
                error: '管理员账户没有数据可备份' 
            });
        }

        // 获取配置
        const config = getUserHFConfig(username);
        
        if (!config?.hf_token || !config?.hf_repo) {
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
        
        // 执行备份
        const result = await backupToHuggingFace(
            dataDir,
            username,
            config.hf_token,
            config.hf_repo
        );
        
        res.json(result);
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
