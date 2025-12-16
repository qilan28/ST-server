import express from 'express';
import { getActiveAnnouncements } from '../database.js';

const router = express.Router();

// 获取指定类型的活跃公告（无需认证）
router.get('/:type', async (req, res) => {
    try {
        const { type } = req.params;
        
        if (!['login', 'dashboard'].includes(type)) {
            return res.status(400).json({ error: 'Invalid type' });
        }
        
        const announcements = getActiveAnnouncements(type);
        res.json({ announcements });
    } catch (error) {
        console.error('Get announcements error:', error);
        res.status(500).json({ error: 'Failed to get announcements' });
    }
});

export default router;
