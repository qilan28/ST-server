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
import './database.js';
import { findUserByUsername, createAdminUser } from './database.js';
import { getAdminConfig, clearAdminPassword } from './utils/config-manager.js';

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
        const adminConfig = getAdminConfig();
        
        // 检查是否启用自动创建
        if (!adminConfig.autoCreate) {
            return;
        }
        
        // 检查必要的配置项
        if (!adminConfig.username || !adminConfig.password || !adminConfig.email) {
            console.log('⚠️  [Admin] 管理员配置不完整，跳过自动创建');
            return;
        }
        
        // 检查管理员是否已存在
        const existingAdmin = findUserByUsername(adminConfig.username);
        if (existingAdmin) {
            console.log(`ℹ️  [Admin] 管理员账号 "${adminConfig.username}" 已存在，跳过创建`);
            
            // 清除配置文件中的密码（提高安全性）
            clearAdminPassword();
            return;
        }
        
        // 创建管理员账号
        console.log('🔧 [Admin] 正在自动创建管理员账号...');
        const hashedPassword = await bcrypt.hash(adminConfig.password, 10);
        const admin = createAdminUser(
            adminConfig.username,
            hashedPassword,
            adminConfig.email
        );
        
        console.log('✅ [Admin] 管理员账号创建成功！');
        console.log(`   用户名: ${admin.username}`);
        console.log(`   邮箱: ${admin.email}`);
        console.log(`   角色: ${admin.role}`);
        
        // 创建成功后，清除配置文件中的密码
        clearAdminPassword();
        console.log('🔒 [Admin] 已从配置文件中清除管理员密码');
        
    } catch (error) {
        console.error('❌ [Admin] 自动创建管理员失败:', error);
    }
}

// 调用自动创建管理员
autoCreateAdmin();

// 中间件
app.use(cors({ credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/auth-check', authCheckRoutes);
app.use('/api/instance', instanceRoutes);
app.use('/api/version', versionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/config', configRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404处理
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'API endpoint not found' });
    } else {
        res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
    }
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
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    process.exit(0);
});
