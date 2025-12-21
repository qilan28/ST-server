import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getInstancesConfig, getAllInstances } from './utils/instance-manager.js';

// 加载环境变量
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 获取实例配置
const PORT = getInstancesConfig().mainPort || 7091;
const instances = getAllInstances();
console.log(`主转发服务器端口: ${PORT}, 实例数量: ${instances.length}`);

// 创建转发服务器
const app = express();
app.use(cors({ credentials: true }));

// 日志中间件
app.use((req, res, next) => {
    const username = req.headers['x-st-username'] || '未知用户';
    const start = Date.now();
    console.log(`[转发] ${new Date().toISOString()} - ${username} - ${req.method} ${req.originalUrl}`);
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[转发] ${new Date().toISOString()} - ${username} - ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
    });
    
    next();
});

// 随机选择一个实例
function selectRandomInstance() {
    if (instances.length === 0) {
        return null;
    }
    const randomIndex = Math.floor(Math.random() * instances.length);
    return instances[randomIndex];
}

// 创建代理中间件
const proxyMiddleware = createProxyMiddleware({
    target: 'http://localhost:3000', // 默认目标，实际会在router中修改
    changeOrigin: true,
    ws: true,
    pathRewrite: {
        '^/': '/', // 移除路径前缀
    },
    router: function(req) {
        // 从请求头中获取用户名
        const username = req.headers['x-st-username'];
        
        // 随机选择一个实例
        const instance = selectRandomInstance();
        
        if (!instance) {
            console.log(`[转发] 没有可用实例，使用默认目标`);
            return 'http://localhost:3000';
        }
        
        console.log(`[转发] 用户 ${username || '未知用户'} 的请求 ${req.path} 转发到 ${instance.address}`);
        return instance.address;
    },
    onProxyReq: function(proxyReq, req, res) {
        // 添加标识
        proxyReq.setHeader('X-Forwarded-By', 'ST-Forward-Server');
    },
    onError: function(err, req, res) {
        console.error('[转发] 代理错误:', err);
        res.writeHead(500, {
            'Content-Type': 'text/plain',
        });
        res.end(`转发错误: ${err.message}`);
    }
});

// 使用代理中间件处理所有请求
app.use('/', proxyMiddleware);

// 启动服务器
app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('SillyTavern 转发服务器');
    console.log('='.repeat(60));
    console.log(`服务器运行在 http://localhost:${PORT}`);
    
    if (instances.length > 0) {
        console.log(`已配置 ${instances.length} 个实例:`);
        instances.forEach((instance, index) => {
            console.log(`  ${index + 1}. ${instance.address}`);
        });
    } else {
        console.log('警告: 没有配置任何实例!');
    }
    
    console.log('='.repeat(60));
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('SIGTERM 信号接收: 关闭 HTTP 服务器');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT 信号接收: 关闭 HTTP 服务器');
    process.exit(0);
});
