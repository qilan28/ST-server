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
    
    // 缓存失败的查找，避免重复查找相同文件
    const failedLookupCache = new Map();
    const maxCacheSize = 1000;
    const cacheExpireTime = 5 * 60 * 1000; // 5分钟过期
    
    // 请求频率限制
    const requestFrequency = new Map();
    const maxRequestsPerMinute = 10;
    
    // 定期清理过期的请求历史和缓存
    setInterval(() => {
        const now = Date.now();
        
        // 清理过期的请求频率记录
        for (const [key, requests] of requestFrequency.entries()) {
            const recentRequests = requests.filter(time => (now - time) < 60000);
            if (recentRequests.length === 0) {
                requestFrequency.delete(key);
            } else {
                requestFrequency.set(key, recentRequests);
            }
        }
        
        // 清理过期的失败查找缓存
        for (const [key, cache] of failedLookupCache.entries()) {
            if ((now - cache.timestamp) >= cacheExpireTime) {
                failedLookupCache.delete(key);
            }
        }
    }, 60000); // 每分钟清理一次
    
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
        
        // 检查失败查找缓存
        const now = Date.now();
        const cachedFailure = failedLookupCache.get(filePath);
        if (cachedFailure && (now - cachedFailure.timestamp) < cacheExpireTime) {
            // 文件在缓存中标记为不存在，且未过期，直接跳过
            return next();
        }
        
        // 检查请求频率限制
        const clientIP = req.ip || req.connection.remoteAddress;
        const requestKey = `${clientIP}:${filePath}`;
        const requestHistory = requestFrequency.get(requestKey) || [];
        const recentRequests = requestHistory.filter(time => (now - time) < 60000); // 1分钟内的请求
        
        if (recentRequests.length >= maxRequestsPerMinute) {
            console.warn(`[静态文件补救] 请求频率限制: ${filePath} from ${clientIP}`);
            return next();
        }
        
        // 更新请求历史
        recentRequests.push(now);
        requestFrequency.set(requestKey, recentRequests);
        
        // 记录查找情况（仅在首次或缓存过期后）
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
        
        // 如果所有尝试都失败，将失败结果缓存
        console.log(`[静态文件补救] 没有找到文件: ${filePath}`);
        
        // 缓存失败的查找
        failedLookupCache.set(filePath, { timestamp: now });
        
        // 清理过大的缓存
        if (failedLookupCache.size > maxCacheSize) {
            const oldestEntries = Array.from(failedLookupCache.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp)
                .slice(0, Math.floor(maxCacheSize * 0.3));
            
            oldestEntries.forEach(([key]) => {
                failedLookupCache.delete(key);
            });
        }
        
        next();
    };
}

export default staticFallbackMiddleware;
