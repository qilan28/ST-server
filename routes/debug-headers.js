/**
 * 调试路由 - 用于排查请求头和Cookie相关问题
 */
import express from 'express';

const router = express.Router();

// 输出完整的请求信息，用于调试
router.get('/headers', (req, res) => {
    console.log('======= DEBUG REQUEST INFO =======');
    console.log(`路径: ${req.path}`);
    console.log(`方法: ${req.method}`);
    console.log(`IP: ${req.ip}`);
    console.log(`主机: ${req.hostname}`);
    console.log(`来源: ${req.headers.referer || '无'}`);
    
    // 所有请求头
    console.log('请求头:');
    for (const [key, value] of Object.entries(req.headers)) {
        console.log(`  ${key}: ${value}`);
    }
    
    // 所有Cookie
    console.log('Cookies:');
    if (req.cookies) {
        for (const [key, value] of Object.entries(req.cookies)) {
            console.log(`  ${key}: ${value?.substring(0, 20)}${value?.length > 20 ? '...' : ''}`);
        }
    } else {
        console.log('  无Cookies');
    }
    
    res.json({
        message: '调试信息已输出到服务器控制台',
        path: req.path,
        method: req.method,
        ip: req.ip,
        headers: req.headers,
        cookies: req.cookies || {}
    });
});

export default router;
