/**
 * 仪表板页面特殊处理路由
 * 解决从实例页面返回仪表板时的资源加载问题
 */
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 仪表板页面 HTML 内容
router.get('/dashboard.html', (req, res) => {
    console.log(`[仪表板修复] 请求仪表板页面: ${req.path}`);
    console.log(`[仪表板修复] 来源: ${req.headers.referer || '直接访问'}`);
    console.log(`[仪表板修复] 用户代理: ${req.headers['user-agent']}`);
    
    // 返回仪表板页面，但添加额外的base标签以确保资源路径正确
    const dashboardPath = path.join(__dirname, '../public/dashboard.html');
    
    try {
        let dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
        
        // 添加 base 标签，确保所有资源从正确的位置加载
        dashboardContent = dashboardContent.replace(
            '<head>',
            '<head>\n    <base href="/">'
        );
        
        // 添加特殊的CSS修复，强制正确加载资源
        dashboardContent = dashboardContent.replace(
            '</head>',
            `    <style>
        /* 页面资源修复 - 确保从根路径加载 */
        @import url('/css/fixed-style.css');
    </style>
    <script>
        // 资源路径修复
        document.addEventListener('DOMContentLoaded', function() {
            // 修复所有脚本和样式表的路径
            function fixResourcePaths() {
                // 修复样式表
                document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
                    const href = link.getAttribute('href');
                    if (href && !href.startsWith('/') && !href.startsWith('http')) {
                        link.setAttribute('href', '/' + href);
                    }
                });
                
                // 修复脚本
                document.querySelectorAll('script[src]').forEach(script => {
                    const src = script.getAttribute('src');
                    if (src && !src.startsWith('/') && !src.startsWith('http')) {
                        script.setAttribute('src', '/' + src);
                    }
                });
                
                // 修复图片
                document.querySelectorAll('img[src]').forEach(img => {
                    const src = img.getAttribute('src');
                    if (src && !src.startsWith('/') && !src.startsWith('http')) {
                        img.setAttribute('src', '/' + src);
                    }
                });
                
                console.log('[仪表板修复] 资源路径已修复');
            }
            
            // 立即执行一次
            fixResourcePaths();
            
            // 添加动态资源加载错误处理
            window.addEventListener('error', function(e) {
                // 检查是否是资源加载错误
                if (e.target && (e.target.tagName === 'LINK' || e.target.tagName === 'SCRIPT' || e.target.tagName === 'IMG')) {
                    const src = e.target.src || e.target.href;
                    if (src) {
                        console.error('[资源加载失败]', src);
                        
                        // 尝试从根路径重新加载
                        if (!src.startsWith('/') && !src.startsWith('http')) {
                            const newSrc = '/' + src;
                            console.log('[尝试修复路径]', src, '->', newSrc);
                            
                            if (e.target.tagName === 'LINK') {
                                e.target.href = newSrc;
                            } else {
                                e.target.src = newSrc;
                            }
                            
                            // 阻止事件继续传播
                            e.preventDefault();
                        }
                    }
                }
            }, true);
        });
    </script>
</head>`
        );
        
        // API请求修复脚本 - 新版
        const apiFixScript = `
    <script>
        // API请求修复脚本 - 使用专用API桌接路径
        (function() {
            const originalFetch = window.fetch;
            const originalXHROpen = XMLHttpRequest.prototype.open;
            const currentHost = window.location.host;
            const isProxiedRequest = currentHost.includes('7092') || window.location.pathname.includes('/st/');
            const currentOrigin = window.location.origin;
            
            // 拦截fetch请求
            window.fetch = function(url, options) {
                if (isProxiedRequest) {
                    // 如果是API请求，转到 nginx-api 桌接端点
                    if (url.startsWith('/api/')) {
                        const apiPath = url.substring(5); // 移除 '/api/' 前缀
                        const newUrl = currentOrigin + '/nginx-api/' + apiPath;
                        console.log('[API桌接] Fetch请求重定向:', url, '->', newUrl);
                        return originalFetch(newUrl, options);
                    }
                }
                return originalFetch(url, options);
            };
            
            // 拦截XHR请求
            XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
                if (isProxiedRequest && url.startsWith('/api/')) {
                    const apiPath = url.substring(5); // 移除 '/api/' 前缀
                    const newUrl = currentOrigin + '/nginx-api/' + apiPath;
                    console.log('[API桌接] XHR请求重定向:', url, '->', newUrl);
                    return originalXHROpen.call(this, method, newUrl, async, user, password);
                }
                return originalXHROpen.call(this, method, url, async, user, password);
            };
            
            console.log('[API桌接] 请求拦截已启用', { host: currentHost, isProxied: isProxiedRequest });
        })();
    </script>
`;
        
        // 添加特殊的调试信息
        dashboardContent = dashboardContent.replace(
            '<body>',
            `<body>
    <!-- 仪表板资源修复 v1.1 已应用 -->${apiFixScript}`
        );
        
        // 设置响应头，禁用缓存
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        // 发送修改后的内容
        res.type('html').send(dashboardContent);
    } catch (error) {
        console.error('[仪表板修复] 错误:', error);
        // 如果出错，回退到直接发送文件
        res.sendFile(dashboardPath);
    }
});

// 处理特定资源的路由
const resourceRoutes = [
    '/style.css',
    '/dashboard.html.11',
    '/dashboard.html.12',
    '/dashboard.html.14',
    '/dashboard.html.15',
    '/dashboard.html.16',
    '/dashboard.html.28',
    '/dashboard.html.54',
    '/dashboard.html.355',
    '/dashboard.js',
    '/adapter.js',
    '/runtime.js'
];

// 为每个特定资源添加路由
resourceRoutes.forEach(route => {
    router.get(route, (req, res) => {
        // 从公共目录提供文件
        const filePath = path.join(__dirname, '../public', route);
        if (fs.existsSync(filePath)) {
            console.log(`[仪表板修复] 提供资源: ${route}`);
            
            // 设置响应头，禁用缓存
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            
            return res.sendFile(filePath);
        }
        
        // 尝试从公共目录找到不带.html部分的资源
        if (route.includes('.html.')) {
            const simplifiedRoute = route.replace('.html', '');
            const simplifiedPath = path.join(__dirname, '../public', simplifiedRoute);
            
            if (fs.existsSync(simplifiedPath)) {
                console.log(`[仪表板修复] 提供简化资源: ${simplifiedRoute}`);
                
                // 设置响应头，禁用缓存
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
                
                return res.sendFile(simplifiedPath);
            }
        }
        
        // 如果文件不存在，尝试找到类似的文件
        const publicDir = path.join(__dirname, '../public');
        try {
            const files = fs.readdirSync(publicDir);
            const fileName = path.basename(route);
            const fileNameNoExt = fileName.split('.')[0];
            
            // 查找匹配的文件
            const matchingFile = files.find(file => 
                file === fileName || 
                file.startsWith(fileNameNoExt + '.') || 
                file.includes(fileNameNoExt)
            );
            
            if (matchingFile) {
                const matchingPath = path.join(publicDir, matchingFile);
                console.log(`[仪表板修复] 找到类似文件: ${matchingFile} 用于 ${route}`);
                
                // 设置响应头，禁用缓存
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
                
                return res.sendFile(matchingPath);
            }
        } catch (error) {
            console.error(`[仪表板修复] 查找类似文件时出错:`, error);
        }
        
        // 如果找不到任何匹配的文件，返回空响应，避免浏览器出现错误
        console.log(`[仪表板修复] 未找到资源: ${route}，返回空响应`);
        res.type(path.extname(route).substring(1) || 'text/plain').send('');
    });
});

export default router;
