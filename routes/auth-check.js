import express from 'express';
import jwt from 'jsonwebtoken';
import { findUserByUsername } from '../database.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Nginx auth_request 验证端点
 * 检查用户是否有权限访问指定的 SillyTavern 实例
 */
router.get('/verify/:username', (req, res) => {
    const requestedUsername = req.params.username;
    
    // 1. 从 cookie 或 header 中获取 token
    let token = req.cookies?.st_token;
    
    if (!token) {
        // 尝试从 Authorization header 获取
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
    }
    
    // 2. 如果没有 token，拒绝访问
    if (!token) {
        console.log(`[Auth] 拒绝访问 /${requestedUsername}/st/ - 未提供token`);
        return res.status(401).send('Unauthorized');
    }
    
    try {
        // 3. 验证 token
        const decoded = jwt.verify(token, JWT_SECRET);
        const currentUsername = decoded.username;
        
        // 4. 检查用户是否存在
        const user = findUserByUsername(currentUsername);
        if (!user) {
            console.log(`[Auth] 拒绝访问 /${requestedUsername}/st/ - 用户不存在: ${currentUsername}`);
            return res.status(401).send('Unauthorized');
        }
        
        // 5. 管理员可以访问所有实例
        if (user.role === 'admin') {
            console.log(`[Auth] 允许访问 /${requestedUsername}/st/ - 管理员: ${currentUsername}`);
            return res.status(200).send('OK');
        }
        
        // 6. 普通用户只能访问自己的实例
        if (currentUsername !== requestedUsername) {
            console.log(`[Auth] 拒绝访问 /${requestedUsername}/st/ - 用户 ${currentUsername} 无权访问`);
            return res.status(403).send('Forbidden');
        }
        
        // 7. 权限验证通过
        console.log(`[Auth] 允许访问 /${requestedUsername}/st/ - 用户: ${currentUsername}`);
        res.status(200).send('OK');
        
    } catch (error) {
        console.error('[Auth] Token验证失败:', error.message);
        res.status(401).send('Unauthorized');
    }
});

export default router;
