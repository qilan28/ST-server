import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 静态文件 404 补救中间件
 * 当静态文件找不到时，尝试从备用目录提供
 */
export function staticFallbackMiddleware(options = {}) {
    const fallbackPaths = options.fallbackPaths || [];
    const publicDir = path.join(__dirname, '..', 'public');
    
    // 默认添加公共目录作为主要回退路径
    if (fallbackPaths.indexOf(publicDir) === -1) {
        fallbackPaths.unshift(publicDir);
    }
    
    return function(req, res, next) {
        // 只处理可能是静态文件的 404 请求
        const staticFileExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.map'];
        const isStaticFile = staticFileExtensions.some(ext => req.path.endsWith(ext));
        
        // 特殊处理：检查 referer 来源信息
        const reqReferer = req.headers['referer'] || '';
        const host = req.headers['host'] || '';
        const isDashboardReferer = reqReferer.includes('/dashboard.html');
        const isStInstanceReferer = reqReferer.includes('/st/');
        
        // 记录额外的请求信息，帮助调试
        console.log(`[静态文件补救] 请求: ${req.path}`);
        console.log(`[静态文件补救] Referer: ${reqReferer}`);
        console.log(`[静态文件补救] Host: ${host}`);
        
        if (!isStaticFile) {
            return next();
        }
        
        // 处理从子目录访问的情况
        let filePath = req.path;
        if (filePath.startsWith('/')) {
            filePath = filePath.substring(1);
        }
        
        // 记录查找情况
        console.log(`[静态文件补救] 尝试查找文件: ${filePath}`);
        
        // 尝试从每个备用路径查找文件
        for (const basePath of fallbackPaths) {
            const fullPath = path.join(basePath, filePath);
            
            // 检查目录遍历攻击
            if (!fullPath.startsWith(basePath)) {
                console.warn(`[静态文件补救] 安全警告: 路径尝试访问父目录: ${filePath}`);
                continue;
            }
            
            // 检查文件是否存在
            try {
                if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                    console.log(`[静态文件补救] 文件找到: ${fullPath}`);
                    
                    // 设置禁用缓存头
                    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                    res.setHeader('Pragma', 'no-cache');
                    res.setHeader('Expires', '0');
                    
                    // 发送文件
                    return res.sendFile(fullPath);
                }
            } catch (error) {
                console.error(`[静态文件补救] 错误: ${error.message}`);
            }
        }
        
        // 特殊处理从实例页面返回到仪表板时的路径问题
        const isFromDashboard = reqReferer.includes('/dashboard.html');
        const isFromInstance = reqReferer.includes('/st/');
        
        // 如果来自实例页面或仪表板，尝试特殊的路径处理
        if (isFromDashboard || isFromInstance) {
            console.log(`[静态文件补救] 检测到从仪表板/实例返回，特殊处理路径: ${filePath}`);
            
            // 1. 尝试直接使用文件名（不带路径）
            const segments = filePath.split('/');
            const fileName = segments[segments.length - 1];
            
            // 在所有回退路径中查找文件名
            for (const basePath of fallbackPaths) {
                const simplePath = path.join(basePath, fileName);
                
                try {
                    if (fs.existsSync(simplePath) && fs.statSync(simplePath).isFile()) {
                        console.log(`[静态文件补救] 使用简化名称找到文件: ${simplePath}`);
                        
                        // 设置禁用缓存头
                        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                        res.setHeader('Pragma', 'no-cache');
                        res.setHeader('Expires', '0');
                        
                        // 发送文件
                        return res.sendFile(simplePath);
                    }
                } catch (error) {
                    console.error(`[静态文件补救] 错误: ${error.message}`);
                }
            }
            
            // 2. 尝试删除 '/user/st/' 前缀
            if (filePath.includes('/st/')) {
                const pathAfterSt = filePath.split('/st/')[1];
                if (pathAfterSt) {
                    console.log(`[静态文件补救] 尝试删除 /st/ 前缀后的路径: ${pathAfterSt}`);
                    
                    for (const basePath of fallbackPaths) {
                        const correctedPath = path.join(basePath, pathAfterSt);
                        
                        try {
                            if (fs.existsSync(correctedPath) && fs.statSync(correctedPath).isFile()) {
                                console.log(`[静态文件补救] 删除 /st/ 前缀后找到文件: ${correctedPath}`);
                                
                                // 设置禁用缓存头
                                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                                res.setHeader('Pragma', 'no-cache');
                                res.setHeader('Expires', '0');
                                
                                // 发送文件
                                return res.sendFile(correctedPath);
                            }
                        } catch (error) {
                            console.error(`[静态文件补救] 错误: ${error.message}`);
                        }
                    }
                }
            }
        }

        // 尝试移除前缀并重新查找
        if (filePath.includes('/')) {
            const segments = filePath.split('/');
            const simplifiedPath = segments[segments.length - 1];
            
            console.log(`[静态文件补救] 尝试简化路径查找: ${simplifiedPath}`);
            
            for (const basePath of fallbackPaths) {
                const fullPath = path.join(basePath, simplifiedPath);
                
                try {
                    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                        console.log(`[静态文件补救] 通过简化路径找到文件: ${fullPath}`);
                        
                        // 设置禁用缓存头
                        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                        res.setHeader('Pragma', 'no-cache');
                        res.setHeader('Expires', '0');
                        
                        // 发送文件
                        return res.sendFile(fullPath);
                    }
                } catch (error) {
                    console.error(`[静态文件补救] 错误: ${error.message}`);
                }
            }
        }
        
        // 如果所有尝试都失败，继续到下一个中间件
        console.log(`[静态文件补救] 没有找到文件: ${filePath}`);
        next();
    };
}

export default staticFallbackMiddleware;
