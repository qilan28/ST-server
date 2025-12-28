import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authenticateToken } from '../middleware/auth.js';
import { findUserByUsername, updateUserSTInfo, updateSTSetupStatus } from '../database.js';
import { getSillyTavernVersions, getSillyTavernRepoInfo } from '../github-api.js';
import { 
    setupSillyTavern, 
    checkGitAvailable, 
    deleteSillyTavern, 
    checkDependenciesInstalled,
    installDependencies 
} from '../git-manager.js';
import { getInstanceStatus, stopInstance } from '../pm2-manager.js';

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

// 检查系统是否支持 Git
router.get('/check-git', async (req, res) => {
    try {
        const available = await checkGitAvailable();
        res.json({ available });
    } catch (error) {
        console.error('Check git error:', error);
        res.json({ available: false });
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
        
        // 检查是否正在安装
        if (user.st_setup_status === 'installing') {
            return res.status(400).json({ 
                error: 'Installation already in progress' 
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
        
        // 确保数据目录存在（SillyTavern 在 standalone 模式下不会自动创建）
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log(`[${user.username}] 创建数据目录: ${dataDir}`);
            
            // 创建必要的子目录
            const requiredDirs = [
                path.join(dataDir, 'User Avatars'),
                path.join(dataDir, 'backgrounds'),
                path.join(dataDir, 'group chats'),
                path.join(dataDir, 'chats'),
                path.join(dataDir, 'characters'),
                path.join(dataDir, 'groups'),
                path.join(dataDir, 'settings'),
                path.join(dataDir, 'worlds'),
                path.join(dataDir, 'themes'),
                path.join(dataDir, 'NovelAI Settings'),
                path.join(dataDir, 'uploads')
            ];
            
            for (const dir of requiredDirs) {
                try {
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                        console.log(`[${user.username}] 创建必要子目录: ${dir}`);
                    }
                } catch (dirError) {
                    console.warn(`[${user.username}] 创建子目录失败: ${dirError.message}`);
                }
            }
            
            // 创建基本设置文件
            try {
                const settingsFile = path.join(dataDir, 'settings.json');
                if (!fs.existsSync(settingsFile)) {
                    fs.writeFileSync(settingsFile, JSON.stringify({
                        "theme": "Default",
                        "fast_ui_mode": true,
                        "chat_display": "bubbles",
                        "last_migration": 0
                    }, null, 4));
                    console.log(`[${user.username}] 创建基本设置文件`);
                }
            } catch (settingError) {
                console.warn(`[${user.username}] 创建设置文件失败: ${settingError.message}`);
            }
        }
        
        // 更新状态为安装中
        updateSTSetupStatus(user.username, 'installing');
        
        // 使用 SSE 发送进度（如果需要实时进度，可以改用 WebSocket 或 SSE）
        // 这里简化处理，直接在后台安装
        
        // 异步安装（不阻塞响应）
        (async () => {
            // 如果目录已存在，先删除（版本切换场景）
            if (fs.existsSync(stDir)) {
                console.log(`[${user.username}] 检测到旧版本，准备切换版本...`);
                
                // 先停止实例（如果正在运行）
                try {
                    const status = await getInstanceStatus(user.username);
                    if (status && status.status === 'online') {
                        console.log(`[${user.username}] 停止运行中的实例...`);
                        await stopInstance(user.username);
                        console.log(`[${user.username}] 实例已停止`);
                        // 等待 2 秒确保进程完全停止
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                } catch (stopError) {
                    console.warn(`[${user.username}] 停止实例时出现警告:`, stopError.message);
                    // 继续执行，即使停止失败
                }
                
                // 删除旧版本目录
                console.log(`[${user.username}] 删除旧版本目录...`);
                try {
                    fs.rmSync(stDir, { recursive: true, force: true });
                    console.log(`[${user.username}] 旧版本已删除`);
                } catch (deleteError) {
                    console.error(`[${user.username}] 删除旧版本失败:`, deleteError);
                    updateSTSetupStatus(user.username, 'failed');
                    return;
                }
            }
            
            // 安装新版本
            await setupSillyTavern(stDir, version, (progress) => {
                console.log(`[${user.username}] ${progress}`);
            });
        })().then(() => {
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
        res.status(500).json({ error: 'Failed to setup SillyTavern: ' + error.message });
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

// 检查依赖状态
router.get('/check-dependencies', authenticateToken, async (req, res) => {
    try {
        const user = findUserByUsername(req.user.username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (!user.st_dir) {
            return res.json({ installed: false, reason: 'SillyTavern not set up' });
        }
        
        const result = checkDependenciesInstalled(user.st_dir);
        res.json(result);
    } catch (error) {
        console.error('Check dependencies error:', error);
        res.status(500).json({ error: 'Failed to check dependencies' });
    }
});

// 重新安装依赖
router.post('/reinstall-dependencies', authenticateToken, async (req, res) => {
    try {
        const user = findUserByUsername(req.user.username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (!user.st_dir) {
            return res.status(400).json({ error: 'SillyTavern not set up' });
        }
        
        // 检查实例是否在运行
        const status = await getInstanceStatus(user.username);
        if (status && status.status === 'online') {
            return res.status(400).json({ 
                error: 'Please stop the instance before reinstalling dependencies' 
            });
        }
        
        // 异步重新安装
        installDependencies(user.st_dir, (progress) => {
            console.log(`[${user.username}] ${progress}`);
        }).then(() => {
            console.log(`[${user.username}] Dependencies reinstalled successfully`);
        }).catch((error) => {
            console.error(`[${user.username}] Reinstall dependencies failed:`, error);
        });
        
        res.json({ message: 'Dependencies reinstallation started' });
    } catch (error) {
        console.error('Reinstall dependencies error:', error);
        res.status(500).json({ error: 'Failed to reinstall dependencies: ' + error.message });
    }
});

// 删除当前版本
router.post('/delete', authenticateToken, async (req, res) => {
    try {
        const user = findUserByUsername(req.user.username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (!user.st_dir) {
            return res.status(400).json({ error: 'No SillyTavern installation found' });
        }
        
        // 检查实例是否在运行
        const status = await getInstanceStatus(user.username);
        if (status && status.status === 'online') {
            console.log(`[${user.username}] 实例正在运行，尝试自动停止...`);
            try {
                // 自动停止运行中的实例
                await stopInstance(user.username);
                console.log(`[${user.username}] 实例已成功停止，继续删除操作`);
                
                // 等待一下确保实例完全停止
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (stopError) {
                console.error(`[${user.username}] 尝试停止实例失败:`, stopError);
                return res.status(500).json({ 
                    error: `无法停止正在运行的实例: ${stopError.message}` 
                });
            }
        }
        
        // 删除目录
        await deleteSillyTavern(user.st_dir);
        
        // 更新数据库
        updateUserSTInfo(user.username, null, null, 'pending');
        
        res.json({ message: 'SillyTavern deleted successfully' });
    } catch (error) {
        console.error('Delete SillyTavern error:', error);
        res.status(500).json({ error: 'Failed to delete SillyTavern: ' + error.message });
    }
});

// 切换版本（删除旧版本 + 安装新版本）
router.post('/switch', authenticateToken, async (req, res) => {
    try {
        const { version } = req.body;
        
        if (!version) {
            return res.status(400).json({ error: 'Version is required' });
        }
        
        const user = findUserByUsername(req.user.username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // 检查实例是否在运行
        const status = await getInstanceStatus(user.username);
        if (status && status.status === 'online') {
            console.log(`[${user.username}] 切换版本: 实例正在运行，尝试自动停止...`);
            try {
                // 自动停止运行中的实例
                await stopInstance(user.username);
                console.log(`[${user.username}] 实例已成功停止，继续切换版本操作`);
                
                // 等待一下确保实例完全停止
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (stopError) {
                console.error(`[${user.username}] 切换版本: 尝试停止实例失败:`, stopError);
                return res.status(500).json({ 
                    error: `无法停止正在运行的实例: ${stopError.message}` 
                });
            }
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
        
        // 确保数据目录存在（SillyTavern 在 standalone 模式下不会自动创建）
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log(`[${user.username}] 创建数据目录: ${dataDir}`);
            
            // 创建必要的子目录
            const requiredDirs = [
                path.join(dataDir, 'User Avatars'),
                path.join(dataDir, 'backgrounds'),
                path.join(dataDir, 'group chats'),
                path.join(dataDir, 'chats'),
                path.join(dataDir, 'characters'),
                path.join(dataDir, 'groups'),
                path.join(dataDir, 'settings'),
                path.join(dataDir, 'worlds'),
                path.join(dataDir, 'themes'),
                path.join(dataDir, 'NovelAI Settings'),
                path.join(dataDir, 'uploads')
            ];
            
            for (const dir of requiredDirs) {
                try {
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                        console.log(`[${user.username}] 创建必要子目录: ${dir}`);
                    }
                } catch (dirError) {
                    console.warn(`[${user.username}] 创建子目录失败: ${dirError.message}`);
                }
            }
            
            // 创建基本设置文件
            try {
                const settingsFile = path.join(dataDir, 'settings.json');
                if (!fs.existsSync(settingsFile)) {
                    fs.writeFileSync(settingsFile, JSON.stringify({
                        "theme": "Default",
                        "fast_ui_mode": true,
                        "chat_display": "bubbles",
                        "last_migration": 0
                    }, null, 4));
                    console.log(`[${user.username}] 创建基本设置文件`);
                }
            } catch (settingError) {
                console.warn(`[${user.username}] 创建设置文件失败: ${settingError.message}`);
            }
        }
        
        // 删除旧版本（如果存在）
        if (user.st_dir) {
            try {
                await deleteSillyTavern(user.st_dir);
            } catch (error) {
                console.error('Failed to delete old version:', error);
                // 继续安装新版本
            }
        }
        
        // 更新状态为安装中
        updateSTSetupStatus(user.username, 'installing');
        
        // 异步安装新版本
        setupSillyTavern(stDir, version, (progress) => {
            console.log(`[${user.username}] ${progress}`);
        }).then(() => {
            // 更新数据库
            updateUserSTInfo(user.username, stDir, version, 'completed');
            console.log(`[${user.username}] Switched to SillyTavern ${version}`);
            
            // 确保标题替换后仍然生效
            import('../database-site-settings.js')
                .then(({ getSiteSettings }) => {
                    const settings = getSiteSettings(db);
                    const siteName = settings && settings.site_name ? settings.site_name : '【管理员后台设置网站名称】';
                    
                    import('../git-manager.js')
                        .then(({ replaceSillyTavernTitle }) => {
                            replaceSillyTavernTitle(stDir, siteName)
                                .then(success => {
                                    if (success) {
                                        console.log(`[${user.username}] 成功替换登录页标题为: ${siteName}`);
                                    }
                                })
                                .catch(err => console.error(`[${user.username}] 替换登录页标题失败:`, err));
                        })
                        .catch(err => console.error(`[${user.username}] 加载 git-manager 模块失败:`, err));
                })
                .catch(err => console.error(`[${user.username}] 加载 site-settings 模块失败:`, err));
        }).catch((error) => {
            console.error(`[${user.username}] Switch version failed:`, error);
            updateSTSetupStatus(user.username, 'failed');
        });
        
        res.json({
            message: 'Version switch started',
            version: version,
            status: 'installing'
        });
        
    } catch (error) {
        console.error('Switch version error:', error);
        res.status(500).json({ error: 'Failed to switch version: ' + error.message });
    }
});

export default router;
