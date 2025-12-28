/**
 * API 请求代理处理
 * 用于确保所有 API 请求正确路由
 */
import express from 'express';
import http from 'http';
import https from 'https';

const router = express.Router();

/**
 * 通用 API 请求转发处理
 * 将捕获所有未命中其他路由的 API 请求
 */
router.all('*', (req, res) => {
    console.log(`[API代理] 接收到未匹配的 API 请求: ${req.method} ${req.originalUrl}`);
    console.log(`[API代理] 来源: ${req.headers.referer || '未知'}`);
    console.log(`[API代理] 主机: ${req.headers.host || '未知'}`);
    console.log(`[API代理] IP: ${req.ip || '未知'}`);
    
    // 检查是否是来自 Nginx 的请求
    const isFromNginx = req.headers['x-forwarded-for'] || req.headers['x-real-ip'];
    const nginxPort = req.headers.host && req.headers.host.includes(':') ? req.headers.host.split(':')[1] : null;
    
    // 如果是来自 Nginx 的请求，特殊处理
    if (isFromNginx) {
        console.log(`[API代理] 检测到来自 Nginx 的请求，端口: ${nginxPort || '未知'}`);
        
        // 提取原始请求路径
        const originalPath = req.originalUrl;
        // 去除前导的 /api 以获取实际路径
        const apiPath = originalPath.startsWith('/api') ? originalPath.substring(4) : originalPath;
        
        // 目标路由路径
        let targetPath = '';
        
        // 检查特定的 API 端点并确定正确的转发路径
        if (apiPath.startsWith('/instance')) {
            targetPath = `/api/instance${apiPath.substring(9)}`;
        } else if (apiPath.startsWith('/site-settings')) {
            targetPath = `/api/site-settings${apiPath.substring(13)}`;
        } else if (apiPath.startsWith('/announcements')) {
            targetPath = `/api/announcements${apiPath.substring(14)}`;
        } else if (apiPath.startsWith('/backup')) {
            targetPath = `/api/backup${apiPath.substring(7)}`;
        } else if (apiPath.startsWith('/health')) {
            targetPath = `/api/health`;
        } else if (apiPath.startsWith('/auth')) {
            targetPath = `/api/auth${apiPath.substring(5)}`;
        } else if (apiPath.startsWith('/config')) {
            targetPath = `/api/config${apiPath.substring(7)}`;
        } else if (apiPath.startsWith('/runtime-limit')) {
            targetPath = `/api/runtime-limit${apiPath.substring(14)}`;
        } else {
            targetPath = `/api${apiPath}`;
        }
        
        // 获取查询字符串
        const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
        
        // 完整的目标 URL
        const targetUrl = `http://localhost:3000${targetPath}${queryString}`;
        
        console.log(`[API代理] 转发请求到: ${targetUrl}`);
        
        // 转发请求选项
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: `${targetPath}${queryString}`,
            method: req.method,
            headers: {
                ...req.headers,
                host: 'localhost:3000'
            }
        };
        
        // 创建转发请求
        const proxyReq = http.request(options, (proxyRes) => {
            // 设置响应头
            res.statusCode = proxyRes.statusCode;
            for (const [key, value] of Object.entries(proxyRes.headers)) {
                res.setHeader(key, value);
            }
            
            // 处理响应数据
            let body = [];
            proxyRes.on('data', (chunk) => {
                body.push(chunk);
            });
            
            proxyRes.on('end', () => {
                body = Buffer.concat(body);
                res.end(body);
                console.log(`[API代理] 响应已转发，状态码: ${proxyRes.statusCode}`);
            });
        });
        
        // 错误处理
        proxyReq.on('error', (e) => {
            console.error(`[API代理] 转发请求错误: ${e.message}`);
            res.status(500).json({ error: 'API代理转发请求失败' });
        });
        
        // 如果有请求体，转发请求体
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            proxyReq.write(JSON.stringify(req.body));
        }
        
        proxyReq.end();
        return;
    }
    
    // 非 Nginx 请求，使用正常路由
    console.log(`[API代理] 非 Nginx 请求，使用下一个路由处理`);
    return res.status(404).json({ error: `未知的 API 路由: ${req.originalUrl}` });
});

export default router;
