import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import authRoutes from './routes/auth.js';
import authCheckRoutes from './routes/auth-check.js';
import instanceRoutes from './routes/instance.js';
import versionRoutes from './routes/version.js';
import adminRoutes from './routes/admin.js';
import configRoutes from './routes/config.js';
import announcementsRoutes from './routes/announcements.js';
import backupRoutes from './routes/backup.js';
import proxyRoutes from './routes/proxy.js';
import siteSettingsRoutes from './routes/site-settings.js';
import friendsRoutes from './routes/friends.js';
import runtimeLimiterRoutes from './routes/runtime-limiter.js';
import { protectPage } from './middleware/page-auth.js';
import './database.js';
import { findUserByUsername, createAdminUser } from './database.js';
import { getAdminConfig, clearAdminPassword } from './utils/config-manager.js';
import { startAutoBackupScheduler, stopAutoBackupScheduler } from './services/auto-backup.js';
import { initRuntimeLimiter, stopRuntimeLimitCheck } from './runtime-limiter.js';

// 加载环境变量
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 确保必要的目录存在
const dirs = ['data', 'logs'];
dirs.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
});

// 自动创建管理员账号（根据配置）
async function autoCreateAdmin() {
    try {
        console.log('[Admin] 开始检查自动创建管理员配置...');
        const adminConfig = getAdminConfig();
        
        console.log('[Admin] 读取到的配置:', {
            username: adminConfig.username || '(空)',
            email: adminConfig.email || '(空)',
            autoCreate: adminConfig.autoCreate,
            hasPassword: !!adminConfig.password
        });
        
        // 检查是否启用自动创建
        if (!adminConfig.autoCreate) {
            console.log('ℹ️  [Admin] autoCreate = false，跳过自动创建');
            return;
        }
        
        // 检查必要的配置项
        if (!adminConfig.username || !adminConfig.password || !adminConfig.email) {
            console.log('⚠️  [Admin] 管理员配置不完整，跳过自动创建');
            console.log('   请确保在 config.json 中配置了完整的管理员信息：');
            console.log('   - username: 管理员用户名');
            console.log('   - password: 管理员密码');
            console.log('   - email: 管理员邮箱');
            return;
        }
        
        // 检查管理员是否已存在
        const existingAdmin = findUserByUsername(adminConfig.username);
        if (existingAdmin) {
            console.log(`ℹ️  [Admin] 管理员账号 "${adminConfig.username}" 已存在，跳过创建`);
            
            // 清除配置文件中的密码（提高安全性）
            if (adminConfig.password) {
                clearAdminPassword();
                console.log('🔒 [Admin] 已从配置文件中清除管理员密码');
            }
            return;
        }
        
        // 创建管理员账号
        console.log('🔧 [Admin] 正在自动创建管理员账号...');
        console.log(`   用户名: ${adminConfig.username}`);
        console.log(`   邮箱: ${adminConfig.email}`);
        
        const hashedPassword = await bcrypt.hash(adminConfig.password, 10);
        const admin = createAdminUser(
            adminConfig.username,
            hashedPassword,
            adminConfig.email
        );
        
        console.log('✅ [Admin] 管理员账号创建成功！');
        console.log(`   ID: ${admin.id}`);
        console.log(`   用户名: ${admin.username}`);
        console.log(`   邮箱: ${admin.email || adminConfig.email}`);
        console.log(`   角色: ${admin.role}`);
        
        // 创建成功后，清除配置文件中的密码
        clearAdminPassword();
        console.log('🔒 [Admin] 已从配置文件中清除管理员密码');
        
    } catch (error) {
        console.error('❌ [Admin] 自动创建管理员失败:', error);
        console.error('   错误详情:', error.message);
        console.error('   请检查 config.json 文件是否正确');
    }
}

// 调用自动创建管理员
console.log('='.repeat(60));
autoCreateAdmin();
console.log('='.repeat(60));

// 中间件
app.use(cors({ credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 应用页面保护中间件（必须在静态文件服务之前）
app.use(protectPage);

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/auth-check', authCheckRoutes);
app.use('/api/instance', instanceRoutes);
app.use('/api/version', versionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/config', configRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/proxy', proxyRoutes);
app.use('/api/site-settings', siteSettingsRoutes);
app.use('/api/runtime-limit', runtimeLimiterRoutes);
app.use('/', friendsRoutes); // 友情链接路由（包含公开和管理员路由）

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 增强的 404 处理
app.use((req, res) => {
    // 如果是 API 请求
    if (req.path.startsWith('/api/')) {
        // 返回 JSON错误
        res.status(404).json({ error: 'API endpoint not found' });
        return;
    }
    
    // 判断是否是静态资源请求
    const staticFileExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot'];
    const isStaticFile = staticFileExtensions.some(ext => req.path.endsWith(ext));
    
    if (isStaticFile) {
        // 检查该文件是否真实存在
        const requestedFile = path.join(__dirname, 'public', req.path);
        
        // 如果文件存在，直接提供
        if (fs.existsSync(requestedFile)) {
            console.log(`[静态文件] 找到遗失的文件: ${req.path}`);
            return res.sendFile(requestedFile);
        }
        
        // 注意: 我们允许 404 静态文件真正 404，但这样客户端可以处理重试
        console.log(`[静态文件] 未找到文件: ${req.path}`);
        return res.status(404).send(`File not found: ${req.path}`);
    }
    
    // 其它请求重定向到首页
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 错误处理
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// 启动服务器
app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('SillyTavern Multi-Instance Manager');
    console.log('='.repeat(60));
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Database: ${path.join(__dirname, 'database.sqlite')}`);
    console.log('='.repeat(60));
    
    // 启动自动备份调度器
    try {
        startAutoBackupScheduler();
    } catch (error) {
        console.error('[自动备份] ❗ 启动失败:', error.message);
    }
    
    // 初始化运行时长限制
    try {
        initRuntimeLimiter();
        console.log('[运行时长限制] ✅ 初始化成功');
    } catch (error) {
        console.error('[运行时长限制] ❗ 初始化失败:', error.message);
    }
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    stopAutoBackupScheduler();
    stopRuntimeLimitCheck();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    stopAutoBackupScheduler();
    stopRuntimeLimitCheck();
    process.exit(0);
});
