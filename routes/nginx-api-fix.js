/**
 * Nginx API 修复路由
 * 解决通过 Nginx 访问时 API 404 问题
 */
import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth.js';
import { isAdmin } from '../database.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 获取 Nginx 配置文件路径
 * @returns {string} 配置文件路径
 */
function getNginxConfigPath() {
    return path.join(__dirname, '../nginx/nginx.conf');
}

/**
 * 获取简化版 Nginx 配置文件路径
 * @returns {string} 简化配置文件路径
 */
function getNginxSimpleConfigPath() {
    return path.join(__dirname, '../nginx/nginx-simple.conf');
}

/**
 * 检查 Nginx 配置中是否已包含 API 路由修复
 * @param {string} configPath - 配置文件路径
 * @returns {boolean} 是否已包含修复
 */
function checkApiFixExists(configPath) {
    if (!fs.existsSync(configPath)) {
        return false;
    }

    const config = fs.readFileSync(configPath, 'utf8');
    return config.includes('# API 路由修复');
}

/**
 * 修复 Nginx 配置中的 API 路由问题
 * @param {string} configPath - 配置文件路径
 * @returns {object} 结果信息
 */
function fixNginxApiRoutes(configPath) {
    try {
        if (!fs.existsSync(configPath)) {
            return {
                success: false,
                message: `配置文件不存在: ${configPath}`
            };
        }

        // 读取配置文件
        let config = fs.readFileSync(configPath, 'utf8');
        
        // 检查是否已包含修复
        if (checkApiFixExists(configPath)) {
            return {
                success: true,
                message: '配置文件已包含 API 路由修复，无需再次修改'
            };
        }
        
        // 为标准配置添加 API 路由修复
        if (configPath.includes('nginx.conf') && !configPath.includes('simple')) {
            // 查找合适的插入位置
            const insertPoint = config.indexOf('# 用户实例子路径配置') || 
                                config.indexOf('location /') || 
                                config.indexOf('server {');
                
            if (insertPoint === -1) {
                return {
                    success: false,
                    message: '无法在配置文件中找到合适的插入位置'
                };
            }
            
            // API 路由修复块 - 简化版本
            const apiFixBlock = `
    # API 路由修复 - 确保通过 Nginx 访问时 API 请求正确转发
    location /api/ {
        # 转发到管理平台
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Cookie $http_cookie;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
    }
    
    # 专用 API 桌接路由
    location /nginx-api/ {
        proxy_pass http://127.0.0.1:3000/nginx-api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Cookie $http_cookie;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
    }
            
`;
            
            // 插入修复块
            config = config.substring(0, insertPoint) + apiFixBlock + config.substring(insertPoint);
            
        }
        // 为简化配置添加 API 路由修复
        else if (configPath.includes('nginx-simple')) {
            // 查找合适的插入位置
            const insertPoint = config.indexOf('# 管理平台的静态资源和API') || 
                                config.indexOf('location ~ ^/(api|css|js|admin') || 
                                config.indexOf('server {');
                
            if (insertPoint === -1) {
                return {
                    success: false,
                    message: '无法在简化配置文件中找到合适的插入位置'
                };
            }
            
            // 替换现有的静态资源和API路由
            const oldApiRoute = `        # 管理平台的静态资源和API
        location ~ ^/(api|css|js|admin\\.html|login\\.html|register\\.html) {
            proxy_pass http://127.0.0.1:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }`;
            
            // 新的API路由配置 - 简化版
            const newApiRoute = `        # 管理平台的静态资源和API
        location ~ ^/(css|js|admin\\.html|login\\.html|register\\.html) {
            proxy_pass http://127.0.0.1:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header Cookie $http_cookie;
        }
        
        # API 路由修复 - 专门处理 API 请求
        location /api/ {
            # 转发到管理平台
            proxy_pass http://127.0.0.1:3000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header Cookie $http_cookie;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
        }
        
        # 专用 API 桌接路由 - 特别处理 API 请求
        location /nginx-api/ {
            # 转发到管理平台
            proxy_pass http://127.0.0.1:3000/nginx-api/;
            proxy_http_version 1.1;
            
            # 设置代理头信息
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # 传递 cookie
            proxy_set_header Cookie $http_cookie;
            
            # 处理 WebSocket
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            
            # 保留请求参数
            proxy_pass_request_headers on;
            proxy_pass_request_body on;
        }`;
            
            // 替换配置
            config = config.replace(oldApiRoute, newApiRoute);
            
            // 如果没有找到匹配的旧配置，在位置直接插入
            if (!config.includes('# API 路由修复')) {
                const apiFixBlock = `
        # API 路由修复 - 在 server 块内添加 location 块
        location /api/ {
            # 转发到管理平台
            proxy_pass http://127.0.0.1:3000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header Cookie $http_cookie;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
        }
        
        # 专用 API 桌接路由 - 特别处理 API 请求
        location /nginx-api/ {
            # 转发到管理平台
            proxy_pass http://127.0.0.1:3000/nginx-api/;
            proxy_http_version 1.1;
            
            # 设置代理头信息
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # 传递 cookie
            proxy_set_header Cookie $http_cookie;
            
            # 处理 WebSocket
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            
            # 保留请求参数
            proxy_pass_request_headers on;
            proxy_pass_request_body on;
        }`;
                
                config = config.substring(0, insertPoint) + apiFixBlock + config.substring(insertPoint);
            }
        }
        
        // 写入配置文件
        fs.writeFileSync(configPath, config);
        
        return {
            success: true,
            message: `成功修复 ${path.basename(configPath)} 中的 API 路由问题`
        };
        
    } catch (error) {
        return {
            success: false,
            message: `修复 API 路由时出错: ${error.message}`
        };
    }
}

/**
 * API 端点: 修复 Nginx 配置中的 API 路由问题
 */
router.post('/fix-api-routes', authenticateToken, (req, res) => {
    try {
        // 检查管理员权限
        if (!isAdmin(req.user.username)) {
            return res.status(403).json({
                success: false,
                message: '只有管理员可以执行此操作'
            });
        }
        
        // 修复标准配置
        const standardConfigPath = getNginxConfigPath();
        const standardResult = fixNginxApiRoutes(standardConfigPath);
        
        // 修复简化配置
        const simpleConfigPath = getNginxSimpleConfigPath();
        const simpleResult = fixNginxApiRoutes(simpleConfigPath);
        
        return res.json({
            success: true,
            standardConfig: standardResult,
            simpleConfig: simpleResult
        });
        
    } catch (error) {
        console.error('修复 API 路由时出错:', error);
        return res.status(500).json({
            success: false,
            message: `修复 API 路由时出错: ${error.message}`
        });
    }
});

/**
 * API 端点: 检查 Nginx 配置中是否已包含 API 路由修复
 */
router.get('/check-api-routes', authenticateToken, (req, res) => {
    try {
        // 检查管理员权限
        if (!isAdmin(req.user.username)) {
            return res.status(403).json({
                success: false,
                message: '只有管理员可以执行此操作'
            });
        }
        
        // 检查标准配置
        const standardConfigPath = getNginxConfigPath();
        const standardFixed = fs.existsSync(standardConfigPath) && checkApiFixExists(standardConfigPath);
        
        // 检查简化配置
        const simpleConfigPath = getNginxSimpleConfigPath();
        const simpleFixed = fs.existsSync(simpleConfigPath) && checkApiFixExists(simpleConfigPath);
        
        return res.json({
            success: true,
            standardConfig: {
                path: standardConfigPath,
                exists: fs.existsSync(standardConfigPath),
                fixed: standardFixed
            },
            simpleConfig: {
                path: simpleConfigPath,
                exists: fs.existsSync(simpleConfigPath),
                fixed: simpleFixed
            }
        });
        
    } catch (error) {
        console.error('检查 API 路由配置时出错:', error);
        return res.status(500).json({
            success: false,
            message: `检查 API 路由配置时出错: ${error.message}`
        });
    }
});

// 启动时自动修复API路由
try {
    console.log('[Nginx API修复] 检查并修复API路由...');
    
    // 修复标准配置
    const standardConfigPath = getNginxConfigPath();
    if (fs.existsSync(standardConfigPath)) {
        const standardResult = fixNginxApiRoutes(standardConfigPath);
        console.log(`[Nginx API修复] 标准配置: ${standardResult.message}`);
    }
    
    // 修复简化配置
    const simpleConfigPath = getNginxSimpleConfigPath();
    if (fs.existsSync(simpleConfigPath)) {
        const simpleResult = fixNginxApiRoutes(simpleConfigPath);
        console.log(`[Nginx API修复] 简化配置: ${simpleResult.message}`);
    }
    
} catch (error) {
    console.error('[Nginx API修复] 启动时自动修复出错:', error);
}

export default router;
