import express from 'express';
import { 
    getAllFriendsLinks, 
    getAllFriendsLinksAdmin, 
    addFriendsLink, 
    updateFriendsLink, 
    deleteFriendsLink, 
    getFriendsLink 
} from '../database-friends.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// 获取所有活跃的友情链接（公开访问）
router.get('/api/friends', (req, res) => {
    try {
        const friendsLinks = getAllFriendsLinks();
        res.json({ success: true, data: friendsLinks });
    } catch (error) {
        console.error('获取友情链接失败:', error);
        res.status(500).json({ success: false, error: '获取友情链接失败' });
    }
});

// 以下路由需要管理员权限

// 获取所有友情链接（包括不活跃的，管理员专用）
router.get('/api/admin/friends', requireAdmin, (req, res) => {
    try {
        const friendsLinks = getAllFriendsLinksAdmin();
        res.json({ success: true, data: friendsLinks });
    } catch (error) {
        console.error('获取所有友情链接失败:', error);
        res.status(500).json({ success: false, error: '获取所有友情链接失败' });
    }
});

// 获取单个友情链接
router.get('/api/admin/friends/:id', requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        const friendLink = getFriendsLink(id);
        
        if (!friendLink) {
            return res.status(404).json({ success: false, error: '友情链接不存在' });
        }
        
        res.json({ success: true, data: friendLink });
    } catch (error) {
        console.error('获取友情链接详情失败:', error);
        res.status(500).json({ success: false, error: '获取友情链接详情失败' });
    }
});

// 添加友情链接
router.post('/api/admin/friends', requireAdmin, (req, res) => {
    try {
        const { name, url, logo, description, sort_order = 0 } = req.body;
        
        if (!name || !url) {
            return res.status(400).json({ success: false, error: '名称和URL不能为空' });
        }
        
        const result = addFriendsLink(name, url, logo, description, sort_order);
        
        res.json({ 
            success: true, 
            message: '友情链接添加成功', 
            data: { id: result.lastInsertRowid }
        });
    } catch (error) {
        console.error('添加友情链接失败:', error);
        res.status(500).json({ success: false, error: '添加友情链接失败' });
    }
});

// 更新友情链接
router.put('/api/admin/friends/:id', requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        const { name, url, logo, description, is_active, sort_order } = req.body;
        
        if (!name || !url) {
            return res.status(400).json({ success: false, error: '名称和URL不能为空' });
        }
        
        const friendLink = getFriendsLink(id);
        if (!friendLink) {
            return res.status(404).json({ success: false, error: '友情链接不存在' });
        }
        
        updateFriendsLink(
            id, 
            name, 
            url, 
            logo, 
            description, 
            is_active !== undefined ? is_active : friendLink.is_active,
            sort_order !== undefined ? sort_order : friendLink.sort_order
        );
        
        res.json({ success: true, message: '友情链接更新成功' });
    } catch (error) {
        console.error('更新友情链接失败:', error);
        res.status(500).json({ success: false, error: '更新友情链接失败' });
    }
});

// 删除友情链接
router.delete('/api/admin/friends/:id', requireAdmin, (req, res) => {
    try {
        const { id } = req.params;
        
        const friendLink = getFriendsLink(id);
        if (!friendLink) {
            return res.status(404).json({ success: false, error: '友情链接不存在' });
        }
        
        deleteFriendsLink(id);
        
        res.json({ success: true, message: '友情链接删除成功' });
    } catch (error) {
        console.error('删除友情链接失败:', error);
        res.status(500).json({ success: false, error: '删除友情链接失败' });
    }
});

export default router;
