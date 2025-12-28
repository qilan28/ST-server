import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './auth.js';

// 保护页面访问的中间件
export const protectPage = (req, res, next) => {
    // 获取当前请求的路径
    const path = req.path;
    
    // 需要保护的页面列表
    const protectedPages = [
        '/admin.html',
        '/dashboard.html',
        '/setup.html'
    ];
    
    // 如果请求的是受保护的页面
    if (protectedPages.includes(path)) {
        // 获取访问IP和用户代理信息
        const clientIP = req.ip || req.connection.remoteAddress || '未知IP';
        const userAgent = req.headers['user-agent'] || '未知用户代理';
        
        console.log(`[页面保护] 检查页面权限: ${path}`);
        console.log(`[页面保护] 访问信息: IP=${clientIP}, UA=${userAgent.substring(0, 60)}...`);
        
        // 从cookie和本地存储获取token
        const token = req.cookies?.st_token;
        
        // 如果没有token，重定向到登录页
        if (!token) {
            console.log(`[页面保护] 访问被拒绝: 未找到token, 路径=${path}, IP=${clientIP}`);
            return res.redirect('/');
        }
        
        // 验证token
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            console.log(`[页面保护] 验证成功: 用户=${decoded.username}, 路径=${path}`);
            next();
        } catch (err) {
            console.log(`[页面保护] 验证失败: 路径=${path}, IP=${clientIP}, 原因=${err.message}`);
            return res.redirect('/');
        }
    } else {
        // 非保护页面，直接通过
        next();
    }
};
