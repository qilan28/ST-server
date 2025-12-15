import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import authCheckRoutes from './routes/auth-check.js';
import instanceRoutes from './routes/instance.js';
import versionRoutes from './routes/version.js';
import adminRoutes from './routes/admin.js';
import configRoutes from './routes/config.js';
import './database.js';

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
