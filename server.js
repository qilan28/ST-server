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
import nginxFixRoutes from './routes/nginx-fix.js';
import nginxApiFixRoutes from './routes/nginx-api-fix.js';
import apiProxyRoutes from './routes/api-proxy.js';
import debugHeadersRoutes from './routes/debug-headers.js';
import dashboardFixRoutes from './routes/dashboard-fix.js';
import { protectPage } from './middleware/page-auth.js';
import { staticFallbackMiddleware } from './middleware/static-fallback.js';
import './database.js';
import { findUserByUsername, createAdminUser, getAllUsers } from './database.js';
import { getAdminConfig, clearAdminPassword } from './utils/config-manager.js';
import { startAutoBackupScheduler, stopAutoBackupScheduler } from './services/auto-backup.js';
import { initRuntimeLimiter, stopRuntimeLimitCheck } from './runtime-limiter.js';
import { ensureDashboardResources } from './utils/dashboard-resource-copy.js';

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

// 确保仪表板资源文件都可用
ensureDashboardResources();
console.log('='.repeat(60));

// 中间件
app.use(cors({ credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 注册仪表板修复路由（必须在页面保护之前）
app.use(dashboardFixRoutes);

// 应用页面保护中间件（必须在静态文件服务之前）
app.use(protectPage);

// 增强的静态文件服务
// 首先强制设置一些关键的缓存控制头
app.use((req, res, next) => {
    // 对静态资源应用特殊的缓存控制
    const staticFileExt = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot'];
    
    // 检查请求路径是否含有可能导致问题的前缀
    const problematicPrefixes = ['/st/', '/123/st/', '/222/st/', '/333/st/'];
    const hasProblematicPrefix = problematicPrefixes.some(prefix => req.path.includes(prefix));
    
    // 根据不同情况设置缓存控制
    if (staticFileExt.some(ext => req.path.endsWith(ext))) {
        if (hasProblematicPrefix || req.path.includes('dashboard')) {
            // 对仪表板相关文件或有问题前缀的资源禁用缓存
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            console.log(`[缓存控制] 禁用缓存: ${req.path}`);
        } else {
            // 其他静态资源使用正常缓存
            res.setHeader('Cache-Control', 'public, max-age=3600');
        }
    }
    next();
});

// 主目录静态文件服务
app.use(express.static(path.join(__dirname, 'public'), { 
    etag: false,
    maxAge: '1h'
}));

// 初始化静态文件回退路径
const staticFallbackPaths = [
    path.join(__dirname, 'public'),          // 主要公共目录
    path.join(__dirname, 'public/js'),       // JavaScript 目录
    path.join(__dirname, 'public/css'),      // CSS 目录
    path.join(__dirname, 'public/images'),   // 图片目录
    path.join(__dirname, 'node_modules')     // 依赖目录
];

// 添加所有用户的 SillyTavern 目录作为回退路径
try {
    // 获取所有用户
    const users = getAllUsers();
    for (const user of users) {
        if (user.st_dir && fs.existsSync(user.st_dir)) {
            const stPublicDir = path.join(user.st_dir, 'public');
            if (fs.existsSync(stPublicDir)) {
                console.log(`[静态文件回退] 添加用户 ${user.username} 的 SillyTavern 目录: ${stPublicDir}`);
                staticFallbackPaths.push(stPublicDir);
            }
        }
    }
    console.log(`[静态文件回退] 总计 ${staticFallbackPaths.length} 个回退路径`);
} catch (error) {
    console.error(`[静态文件回退] 初始化错误:`, error);
}

// 注册静态文件回退中间件
app.use(staticFallbackMiddleware({ fallbackPaths: staticFallbackPaths }));

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
app.use('/api/nginx-fix', nginxFixRoutes);
app.use('/api/nginx-api-fix', nginxApiFixRoutes);
app.use('/api/debug', debugHeadersRoutes); // 调试路由
app.use('/', friendsRoutes); // 友情链接路由（包含公开和管理员路由）

// API 请求代理路由 - 必须放在所有其他 API 路由后面
app.use('/api', apiProxyRoutes);

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

// 自动修复静态文件404问题
async function autoFixStaticFiles() {
    try {
        console.log('🔧 [启动修复] 自动修复静态文件404问题...');
        
        const fs = await import('fs');
        const pathModule = await import('path');
        const { getAllUsers } = await import('./database.js');
        const { reloadNginx } = await import('./utils/nginx-reload.js');
        
        // 获取用户信息
        const users = getAllUsers();
        const activeUsers = users.filter(user => {
            if (user.role === 'admin') return false;
            if (!user.port || user.port === 0) return false;
            return true;
        });
        
        console.log(`🔧 [启动修复] 找到 ${activeUsers.length} 个活跃用户`);
        
        // 生成upstream块
        let upstreams = '';
        activeUsers.forEach(user => {
            upstreams += `\nupstream st_${user.username} {\n    server 127.0.0.1:${user.port};\n}\n`;
        });
        
        // 生成location块
        let locations = '';
        activeUsers.forEach(user => {
            locations += `
        # ${user.username} 的 SillyTavern 实例
        location /${user.username}/st {
            return 301 /${user.username}/st/;
        }
        
        location /${user.username}/st/ {
            rewrite ^/${user.username}/st/(.*)$ /$1 break;
            proxy_pass http://st_${user.username};
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 120s;
            proxy_send_timeout 120s;
            proxy_read_timeout 120s;
        }
`;
        });
        
        // 生成管理平台静态文件处理块 - 优先级最高
        let staticRescue = `
        # 管理平台静态文件 - 最高优先级
        location ~ ^/(css|js|img|images|assets|fonts)/ {
            proxy_pass http://st_manager;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
        
        # 管理平台根目录静态文件
        location ~* ^/(style\.css|table-fix\.css|favicon\.ico)$ {
            proxy_pass http://st_manager;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
        
        # 用户实例静态文件救援 - 根据referer头判断应该转发到哪个用户
        location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|map|json)$ {`;
        
        // 为每个用户添加referer检查
        activeUsers.forEach(user => {
            staticRescue += `
            if ($http_referer ~* "/${user.username}/st") {
                proxy_pass http://st_${user.username};
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            }`;
        });

        staticRescue += `
            
            # 如果没有匹配的referer，返回到管理平台
            proxy_pass http://st_manager;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }`;
        
        // 完整的nginx配置
        const nginxConfig = `worker_processes auto;
pid /run/nginx.pid;

events {
    worker_connections 768;
}

http {
    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 100M;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;

    # 管理平台
    upstream st_manager {
        server 127.0.0.1:3000;
    }
${upstreams}
    
    server {
        listen 80;
        server_name localhost;
        
        # 主服务（管理平台）
        location / {
            proxy_pass http://st_manager;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }
${staticRescue}
${locations}
    }
}`;

        // 写入配置文件
        const outputPath = pathModule.join(__dirname, 'nginx', 'nginx.conf');
        fs.writeFileSync(outputPath, nginxConfig, 'utf-8');
        console.log(`🔧 [启动修复] Nginx配置已写入: ${outputPath}`);
        
        // 尝试重载Nginx
        try {
            const reloadResult = await reloadNginx(null, true);
            if (reloadResult.success) {
                console.log(`✅ [启动修复] Nginx配置重载成功，方法: ${reloadResult.method}`);
            } else {
                console.warn(`⚠️  [启动修复] Nginx重载失败: ${reloadResult.error}`);
            }
        } catch (reloadError) {
            console.warn(`⚠️  [启动修复] Nginx重载出错: ${reloadError.message}`);
        }
        
    } catch (error) {
        console.error('❌ [启动修复] 自动修复失败:', error.message);
    }
}

// 启动服务器
app.listen(PORT, async () => {
    console.log('='.repeat(60));
    console.log('SillyTavern Multi-Instance Manager');
    console.log('='.repeat(60));
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Database: ${path.join(__dirname, 'database.sqlite')}`);
    console.log('='.repeat(60));
    
    // 延迟3秒后自动修复静态文件问题
    setTimeout(async () => {
        await autoFixStaticFiles();
    }, 3000);
    
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
