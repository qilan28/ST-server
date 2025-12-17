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
    try {
        const settings = getSiteSettings(db);
        res.json({
            success: true,
            settings
        });
    } catch (error) {
        console.error('获取网站设置失败:', error);
        res.status(500).json({ 
            success: false,
            error: '获取网站设置失败' 
        });
    }
});

// 更新网站设置 - 仅管理员
router.put('/', authenticateToken, requireAdmin, (req, res) => {
    console.log('[API] 收到更新网站设置请求');
    console.log('[API] 请求体:', req.body);
    
    try {
        const { project_name, site_name } = req.body;
        console.log('[API] 解析数据:', { project_name, site_name });
        
        // 更新文本设置
        console.log('[API] 开始更新设置...');
        const result = updateSiteSettings(db, project_name, site_name, null);
        console.log('[API] 更新结果:', result);
        
        if (result) {
            res.json({
                success: true,
                message: '网站设置更新成功'
            });
        } else {
            res.status(500).json({
                success: false,
                error: '网站设置更新失败'
            });
        }
    } catch (error) {
        console.error('更新网站设置失败:', error);
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

export default router;
