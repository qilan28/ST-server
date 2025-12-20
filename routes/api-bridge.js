/**
 * API 桌接路由
 * 专门用于在 Nginx 反向代理环境下处理 API 请求
 */
import express from 'express';
import http from 'http';
import url from 'url';

const router = express.Router();

// 所有 API 桌接请求处理
router.all('/:apiPath(*)', (req, res) => {
    const apiPath = req.params.apiPath;
    const method = req.method;
    
    console.log(`[API桌接] 收到请求: ${method} ${apiPath}`);
    console.log(`[API桌接] 请求来源: ${req.headers.referer || '未知'}`);
    
    // 构建目标 URL
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    const targetPath = `/api/${apiPath}${queryString}`;
    
    console.log(`[API桌接] 转发到: http://localhost:3000${targetPath}`);
    
    // 准备转发请求
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: targetPath,
        method: method,
        headers: {
            ...req.headers,
            host: 'localhost:3000'
        }
    };
    
    // 创建转发请求
    const proxyReq = http.request(options, (proxyRes) => {
        // 设置响应状态码和头信息
        res.statusCode = proxyRes.statusCode;
        
        // 复制所有响应头
        Object.keys(proxyRes.headers).forEach(key => {
            // 跳过可能导致问题的头
            if (key.toLowerCase() !== 'transfer-encoding') {
                res.setHeader(key, proxyRes.headers[key]);
            }
        });
        
        // 处理响应数据
        let responseData = [];
        
        proxyRes.on('data', (chunk) => {
            responseData.push(chunk);
        });
        
        proxyRes.on('end', () => {
            const responseBody = Buffer.concat(responseData);
            res.end(responseBody);
            console.log(`[API桌接] 响应已转发: ${proxyRes.statusCode}`);
        });
    });
    
    // 错误处理
    proxyReq.on('error', (error) => {
        console.error(`[API桌接] 错误:`, error);
        if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
                error: '桌接请求失败',
                message: error.message
            }));
        }
    });
    
    // 如果是 POST/PUT/PATCH 请求，转发请求体
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
    }
    
    // 完成请求
    proxyReq.end();
});

export default router;
