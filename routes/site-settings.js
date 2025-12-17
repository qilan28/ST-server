import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { authenticateToken, authorizeAdmin } from '../middleware/auth.js';
import { getSiteSettings, updateSiteSettings } from '../database-site-settings.js';

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
        const settings = getSiteSettings();
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
router.put('/', authenticateToken, authorizeAdmin, (req, res) => {
    try {
        const { project_name, site_name } = req.body;
        
        // 更新文本设置
        const result = updateSiteSettings(project_name, site_name, null);
        
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
router.post('/favicon', authenticateToken, authorizeAdmin, upload.single('favicon'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: '未提供图标文件'
            });
        }
        
        // 文件上传成功，更新数据库中的图标路径
        const faviconPath = '/uploads/favicon/' + req.file.filename;
        const result = updateSiteSettings(null, null, faviconPath);
        
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

export default router;
