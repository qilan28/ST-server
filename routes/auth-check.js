import express from 'express';
import jwt from 'jsonwebtoken';
import { findUserByUsername } from '../database.js';
import { JWT_SECRET } from '../middleware/auth.js';

const router = express.Router();

/**
 * Nginx auth_request 验证端点
 * 检查用户是否有权限访问指定的 SillyTavern 实例
 */
router.get('/verify/:username', (req, res) => {
    const requestedUsername = req.params.username;
    const timestamp = new Date().toLocaleString('zh-CN');
    
    // 调试日志：显示所有 Cookie
    console.log(`\n========== [Auth Check] ${timestamp} ==========`);
    console.log(`[Auth] 🔍 请求访问 /${requestedUsername}/st/`);
    console.log(`[Auth] 📋 请求来源: ${req.headers.referer || 'N/A'}`);
    console.log(`[Auth] 🌐 客户端 IP: ${req.ip || req.connection.remoteAddress}`);
    console.log(`[Auth] 🍪 Cookies 对象:`, req.cookies);
    console.log(`[Auth] 📨 Cookie Header:`, req.headers.cookie);
    console.log(`[Auth] 🔑 Authorization Header:`, req.headers.authorization ? '存在' : '不存在');
    
    // 1. 从 cookie 或 header 中获取 token
    let token = req.cookies?.st_token;
    
    if (!token) {
        console.log(`[Auth] ⚠️  Cookie 中未找到 st_token，尝试从 Authorization Header 获取`);
        // 尝试从 Authorization header 获取
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
            console.log(`[Auth] ✅ 从 Authorization Header 获取到 token`);
        }
    } else {
        console.log(`[Auth] ✅ 从 Cookie 获取到 st_token: ${token.substring(0, 20)}...`);
    }
    
    // 2. 如果没有 token，拒绝访问
    if (!token) {
        console.log(`[Auth] ❌ 拒绝访问 /${requestedUsername}/st/ - 未提供 token`);
        console.log(`[Auth] 📝 可用的 cookies:`, Object.keys(req.cookies || {}).length > 0 ? Object.keys(req.cookies) : '无');
        console.log(`[Auth] 💡 提示: 请确保用户已登录并设置了 st_token cookie`);
        console.log(`==========================================\n`);
        return res.status(401).send('Unauthorized');
    }
    
    try {
        // 3. 验证 token
        console.log(`[Auth] 🔐 开始验证 JWT Token...`);
        const decoded = jwt.verify(token, JWT_SECRET);
        const currentUsername = decoded.username;
        console.log(`[Auth] ✅ Token 解码成功，用户: ${currentUsername}`);
        
        // 4. 检查用户是否存在
        const user = findUserByUsername(currentUsername);
        if (!user) {
            console.log(`[Auth] ❌ 拒绝访问 /${requestedUsername}/st/ - 用户不存在: ${currentUsername}`);
            console.log(`==========================================\n`);
            return res.status(401).send('Unauthorized');
        }
        console.log(`[Auth] ✅ 用户存在，角色: ${user.role || 'user'}`);
        
        // 5. 管理员可以访问所有实例
        if (user.role === 'admin') {
            console.log(`[Auth] ✅ 允许访问 /${requestedUsername}/st/ - 管理员权限: ${currentUsername}`);
            console.log(`==========================================\n`);
            return res.status(200).send('OK');
        }
        
        // 6. 普通用户只能访问自己的实例
        if (currentUsername !== requestedUsername) {
            console.log(`[Auth] ❌ 拒绝访问 /${requestedUsername}/st/ - 权限不足`);
            console.log(`[Auth] 📝 当前用户: ${currentUsername}, 请求访问: ${requestedUsername}`);
            console.log(`==========================================\n`);
            return res.status(403).send('Forbidden');
        }
        
        // 7. 权限验证通过
        console.log(`[Auth] ✅ 权限验证通过！允许访问 /${requestedUsername}/st/`);
        console.log(`[Auth] 👤 用户: ${currentUsername}`);
        console.log(`==========================================\n`);
        res.status(200).send('OK');
        
    } catch (error) {
        console.error(`[Auth] ❌ Token 验证失败:`, error.message);
        console.error(`[Auth] 错误类型:`, error.name);
        if (error.name === 'TokenExpiredError') {
            console.error(`[Auth] 💡 Token 已过期，请重新登录`);
        } else if (error.name === 'JsonWebTokenError') {
            console.error(`[Auth] 💡 Token 格式无效`);
        }
        console.log(`==========================================\n`);
        res.status(401).send('Unauthorized');
    }
});

export default router;
