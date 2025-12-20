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
