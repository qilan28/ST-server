import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './auth.js';
import url from 'url';

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

    // Nginx 反向代理相关配置
    const isNginxRequest = req.headers['x-forwarded-for'] || req.headers['x-real-ip'];
    const nginxPort = req.headers['host'] && req.headers['host'].includes(':') ? 
                       req.headers['host'].split(':')[1] : null;
    
    // 检查是否是通过 Nginx 访问且是指定端口 (7092)
    const isNginxReversedOnPort7092 = isNginxRequest && nginxPort === '7092';
    
    // 检查是否是用户实例路径访问 (/user/st/)
    const referer = req.headers['referer'] || '';
    const isUserInstancePath = referer.includes('/st/') && /\/[a-zA-Z0-9_-]+\/st\//.test(referer);
    
    // 如果请求的是受保护的页面
    if (protectedPages.includes(path)) {
        // 获取访问IP和用户代理信息
        const clientIP = req.ip || req.connection.remoteAddress || '未知IP';
        const userAgent = req.headers['user-agent'] || '未知用户代理';
        
        console.log(`[页面保护] 检查页面权限: ${path}`);
        console.log(`[页面保护] 访问信息: IP=${clientIP}, UA=${userAgent.substring(0, 60)}..., Nginx=${isNginxRequest ? 'Yes' : 'No'}, Port=${nginxPort || 'N/A'}`);
        
        // 如果是通过 Nginx 反向代理的特定端口访问，允许不需要验证
        if (isNginxReversedOnPort7092 || isUserInstancePath) {
            console.log(`[页面保护] Nginx 反向代理访问，跳过验证: 路径=${path}, Port=${nginxPort}, IP=${clientIP}`);
            return next();
        }
        
        // 从 cookie和本地存储获取token
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
