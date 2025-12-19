import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { getSiteSettings, updateSiteSettings } from '../database-site-settings.js';
import { db } from '../database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// 配置multer存储
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'favicon');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'favicon-' + uniqueSuffix + ext);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 1024 * 1024 }, // 限制1MB
    fileFilter: (req, file, cb) => {
        // 只接受图标文件类型
        if (
            file.mimetype === 'image/png' || 
            file.mimetype === 'image/jpeg' || 
            file.mimetype === 'image/gif' ||
            file.mimetype === 'image/x-icon' ||
            file.mimetype === 'image/vnd.microsoft.icon'
        ) {
            cb(null, true);
        } else {
            cb(new Error('只支持 PNG, JPEG, GIF, ICO 格式的图标文件'));
        }
    }
});

// 获取网站设置 - 公开API，无需验证
router.get('/', (req, res) => {
    const requestId = 'API:' + Math.random().toString(36).substring(2, 10);
    console.log(`[${requestId}] 接收到获取站点设置请求`);
    
    // 添加CORS头部确保跨域请求工作
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    
    try {
        console.log(`[${requestId}] 正在查询数据库...`);
        const settings = getSiteSettings(db);
        
        if (!settings) {
            console.warn(`[${requestId}] 未找到站点设置数据，返回默认值`);
            res.json({
                success: true,
                settings: {
                    project_name: '公益云酒馆多开管理平台', 
                    site_name: 'SillyTavern 多开管理平台', 
                    favicon_path: '/favicon.ico',
                    max_users: 0
                },
                message: '使用默认设置'
            });
        } else {
            console.log(`[${requestId}] 成功获取站点设置:`, settings);
            res.json({
                success: true,
                settings
            });
        }
    } catch (error) {
        console.error(`[${requestId}] 获取网站设置失败:`, error);
        res.status(500).json({ 
            success: false,
            error: '获取网站设置失败: ' + error.message 
        });
    }
});

// 更新网站设置 - 仅管理员
router.put('/', authenticateToken, requireAdmin, (req, res) => {
    // 增强日志与调试信息
    const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    console.log(`[API:${requestId}] 收到更新网站设置请求`);
    console.log(`[API:${requestId}] 请求体:`, req.body);
    console.log(`[API:${requestId}] 用户: ${req.user.username}, 角色: ${req.user.role}`);
    
    try {
        const { project_name, site_name, max_users } = req.body;
        
        // 参数验证
        if (!project_name || !site_name) {
            console.error(`[API:${requestId}] 缺少必要参数`);
            return res.status(400).json({
                success: false,
                error: '缺少必要参数'
            });
        }
        
        console.log(`[API:${requestId}] 解析数据:`, { project_name, site_name });
        
        // 先测试数据库连接
        try {
            const testQuery = db.prepare('PRAGMA user_version').get();
            console.log(`[API:${requestId}] 数据库连接测试成功, user_version=${testQuery.user_version}`);
        } catch (dbError) {
            console.error(`[API:${requestId}] 数据库连接测试失败:`, dbError);
            return res.status(500).json({
                success: false,
                error: '数据库连接失败, 请检查服务器配置'
            });
        }
        
        // 查询当前设置
        const currentSettings = db.prepare('SELECT * FROM site_settings WHERE id = 1').get();
        console.log(`[API:${requestId}] 当前设置:`, currentSettings || '无记录');
        
        // 更新文本设置
        console.log(`[API:${requestId}] 开始更新设置...`);
        console.log(`[API:${requestId}] max_users 参数: ${max_users !== undefined ? max_users : '未提供'}`);
        const result = updateSiteSettings(db, project_name, site_name, null, max_users !== undefined ? parseInt(max_users) : undefined);
        console.log(`[API:${requestId}] 更新结果:`, result);
        
        // 检查是否更新成功
        const updatedSettings = db.prepare('SELECT * FROM site_settings WHERE id = 1').get();
        console.log(`[API:${requestId}] 更新后的设置:`, updatedSettings || '无记录');
        
        if (result) {
            res.json({
                success: true,
                message: '网站设置更新成功',
                data: {
                    project_name: updatedSettings.project_name,
                    site_name: updatedSettings.site_name,
                    max_users: updatedSettings.max_users,
                    updated_at: updatedSettings.updated_at
                }
            });
        } else {
            console.error(`[API:${requestId}] 更新失败或无变化`);
            res.status(500).json({
                success: false,
                error: '网站设置更新失败或无变化'
            });
        }
    } catch (error) {
        console.error(`[API:${requestId}] 更新网站设置失败:`, error);
        res.status(500).json({ 
            success: false,
            error: '更新网站设置失败: ' + error.message
        });
    }
});

// 上传网站图标 - 仅管理员
router.post('/favicon', authenticateToken, requireAdmin, upload.single('favicon'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: '未提供图标文件'
            });
        }
        
        // 文件上传成功，更新数据库中的图标路径
        const faviconPath = '/uploads/favicon/' + req.file.filename;
        const result = updateSiteSettings(db, null, null, faviconPath);
        
        if (result) {
            res.json({
                success: true,
                message: '网站图标更新成功',
                faviconPath
            });
        } else {
            // 删除上传的文件
            fs.unlinkSync(req.file.path);
            
            res.status(500).json({
                success: false,
                error: '网站图标更新失败'
            });
        }
    } catch (error) {
        console.error('上传网站图标失败:', error);
        // 删除上传的文件（如果存在）
        if (req.file && req.file.path) {
            try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
        
        res.status(500).json({ 
            success: false,
            error: '上传网站图标失败: ' + error.message
        });
    }
});

// 通过URL设置网站图标 - 仅管理员
router.post('/favicon-url', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url || !url.trim()) {
            return res.status(400).json({
                success: false,
                error: '请提供有效的图标URL'
            });
        }
        
        // 验证URL格式
        try {
            new URL(url);
        } catch (e) {
            return res.status(400).json({
                success: false,
                error: '无效的URL格式'
            });
        }
        
        // 更新数据库中的图标路径
        const result = updateSiteSettings(db, null, null, url);
        
        if (result) {
            res.json({
                success: true,
                message: '网站图标URL设置成功',
                faviconPath: url
            });
        } else {
            res.status(500).json({
                success: false,
                error: '网站图标设置失败'
            });
        }
    } catch (error) {
        console.error('设置网站图标URL失败:', error);
        res.status(500).json({ 
            success: false,
            error: '设置网站图标URL失败: ' + error.message
        });
    }
});

// 更新用户数量上限设置 - 仅管理员
router.put('/max-users', authenticateToken, requireAdmin, (req, res) => {
    const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    console.log(`[API:${requestId}] 收到更新用户上限设置请求`);
    console.log(`[API:${requestId}] 请求体:`, req.body);
    console.log(`[API:${requestId}] 用户: ${req.user.username}, 角色: ${req.user.role}`);
    
    try {
        const { max_users } = req.body;
        
        // 参数验证
        if (max_users === undefined) {
            console.error(`[API:${requestId}] 缺少必要参数 max_users`);
            return res.status(400).json({
                success: false,
                error: '缺少必要参数 max_users'
            });
        }
        
        const maxUsersInt = parseInt(max_users);
        if (isNaN(maxUsersInt) || maxUsersInt < 0) {
            console.error(`[API:${requestId}] 无效的 max_users 值: ${max_users}`);
            return res.status(400).json({
                success: false,
                error: 'max_users 必须为非负整数'
            });
        }
        
        console.log(`[API:${requestId}] 解析后的 max_users 值: ${maxUsersInt}`);
        
        // 更新设置
        const result = updateSiteSettings(db, null, null, null, maxUsersInt);
        console.log(`[API:${requestId}] 更新结果:`, result);
        
        if (result) {
            const updatedSettings = db.prepare('SELECT max_users FROM site_settings WHERE id = 1').get();
            console.log(`[API:${requestId}] 更新后的用户上限:`, updatedSettings?.max_users);
            
            res.json({
                success: true,
                message: '用户数量上限更新成功',
                max_users: updatedSettings?.max_users
            });
        } else {
            console.error(`[API:${requestId}] 更新失败或无变化`);
            res.status(500).json({
                success: false,
                error: '用户数量上限更新失败或无变化'
            });
        }
    } catch (error) {
        console.error(`[API:${requestId}] 更新用户上限设置失败:`, error);
        res.status(500).json({
            success: false,
            error: '更新用户上限设置失败: ' + error.message
        });
    }
});

// 获取用户数量信息 - 公开API，无需验证
router.get('/user-stats', (req, res) => {
    const requestId = 'API:' + Math.random().toString(36).substring(2, 10);
    console.log(`[${requestId}] 接收到获取用户统计信息请求`);
    
    try {
        // 获取用户数量（不包括管理员）
        const countStmt = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = "user"');
        const { count } = countStmt.get();
        
        // 获取用户上限设置
        const settings = getSiteSettings(db);
        const max_users = settings.max_users || 0;
        
        console.log(`[${requestId}] 当前用户数: ${count}, 最大允许用户数: ${max_users}`);
        
        res.json({
            success: true,
            user_count: count,
            max_users: max_users,
            registration_allowed: max_users === 0 || count < max_users
        });
    } catch (error) {
        console.error(`[${requestId}] 获取用户统计信息失败:`, error);
        res.status(500).json({
            success: false,
            error: '获取用户统计信息失败: ' + error.message
        });
    }
});

export default router;
