import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateToken } from '../middleware/auth.js';
import { findUserByUsername, updateUserSTInfo, updateSTSetupStatus } from '../database.js';
import { getSillyTavernVersions, getSillyTavernRepoInfo } from '../github-api.js';
import { setupSillyTavern, checkGitAvailable, checkNodeVersion } from '../git-manager.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 获取可用的 SillyTavern 版本列表（公开接口）
router.get('/list', async (req, res) => {
    try {
        const versions = await getSillyTavernVersions();
        
        res.json({
            releases: versions.releases,
            branches: versions.branches,
            total: versions.releases.length + versions.branches.length
        });
    } catch (error) {
        console.error('Get versions error:', error);
        res.status(500).json({ error: 'Failed to fetch versions from GitHub' });
    }
});

// 获取仓库信息
router.get('/repo-info', async (req, res) => {
    try {
        const info = await getSillyTavernRepoInfo();
        res.json(info);
    } catch (error) {
        console.error('Get repo info error:', error);
        res.status(500).json({ error: 'Failed to fetch repository information' });
    }
});

// 检查系统环境（Git 和 Node.js 版本）
router.get('/check-git', async (req, res) => {
    try {
        const gitAvailable = await checkGitAvailable();
        const nodeVersion = checkNodeVersion();
        
        res.json({ 
            git: gitAvailable,
            node: nodeVersion,
            ready: gitAvailable && nodeVersion.isCompatible
        });
    } catch (error) {
        console.error('Check environment error:', error);
        res.json({ git: false, ready: false });
    }
});

// 选择并安装 SillyTavern 版本（需要认证）
router.post('/setup', authenticateToken, async (req, res) => {
    try {
        const { version } = req.body;
        
        if (!version) {
            return res.status(400).json({ error: 'Version is required' });
        }
        
        const user = findUserByUsername(req.user.username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // 检查是否已经设置过
        if (user.st_setup_status === 'completed') {
            return res.status(400).json({ 
                error: 'SillyTavern already set up. Please delete the old version first.' 
            });
        }
        
        // 检查 Node.js 版本
        const nodeVersion = checkNodeVersion();
        if (!nodeVersion.isCompatible) {
            return res.status(400).json({ 
                error: `Node.js 版本过低。当前版本: ${nodeVersion.current}，需要版本: ${nodeVersion.required}+`,
                nodeVersion: nodeVersion
            });
        }
        
        // 检查 Git 是否可用
        const gitAvailable = await checkGitAvailable();
        if (!gitAvailable) {
            return res.status(500).json({ error: 'Git is not available on this system' });
        }
        
        // 设置目录路径
        const userBaseDir = path.join(__dirname, '..', 'data', user.username);
        const stDir = path.join(userBaseDir, 'sillytavern');
        const dataDir = path.join(userBaseDir, 'st-data');
        
        // 更新状态为安装中
        updateSTSetupStatus(user.username, 'installing');
        
        // 使用 SSE 发送进度（如果需要实时进度，可以改用 WebSocket 或 SSE）
        // 这里简化处理，直接在后台安装
        
        // 异步安装（不阻塞响应）
        setupSillyTavern(stDir, version, (progress) => {
            console.log(`[${user.username}] ${progress}`);
        }).then(() => {
            // 更新数据库
            updateUserSTInfo(user.username, stDir, version, 'completed');
            console.log(`[${user.username}] SillyTavern ${version} setup completed`);
        }).catch((error) => {
            console.error(`[${user.username}] Setup failed:`, error);
            updateSTSetupStatus(user.username, 'failed');
        });
        
        res.json({
            message: 'Installation started',
            version: version,
            status: 'installing'
        });
        
    } catch (error) {
        console.error('Setup error:', error);
        
        // 提供更友好的错误信息
        let errorMessage = error.message;
        if (error.message.includes('ECONNRESET') || error.message.includes('network')) {
            errorMessage = '网络连接失败，请检查网络设置或稍后重试。如果问题持续，请考虑配置 NPM 镜像源。';
        }
        
        res.status(500).json({ 
            error: 'Failed to setup SillyTavern: ' + errorMessage,
            detail: error.message 
        });
    }
});

// 检查安装状态
router.get('/setup-status', authenticateToken, async (req, res) => {
    try {
        const user = findUserByUsername(req.user.username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({
            status: user.st_setup_status,
            version: user.st_version,
            st_dir: user.st_dir
        });
    } catch (error) {
        console.error('Check setup status error:', error);
        res.status(500).json({ error: 'Failed to check setup status' });
    }
});

export default router;
