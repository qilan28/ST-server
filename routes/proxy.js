import express from 'express';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const AVATAR_CACHE_DIR = path.join(__dirname, '..', 'public', 'avatar_cache');

// 确保缓存目录存在
if (!fs.existsSync(AVATAR_CACHE_DIR)) {
    fs.mkdirSync(AVATAR_CACHE_DIR, { recursive: true });
    console.log(`创建头像缓存目录: ${AVATAR_CACHE_DIR}`);
}

// QQ头像代理接口
router.get('/qq-avatar/:qq', async (req, res) => {
    try {
        const { qq } = req.params;
        
        // 验证QQ号格式
        if (!qq || !/^[1-9][0-9]{4,12}$/.test(qq)) {
            console.log(`无效的QQ号: ${qq}`);
            return res.redirect('/images/default-avatar.png');
        }
        
        // 检查缓存
        const cacheFile = path.join(AVATAR_CACHE_DIR, `${qq}.jpg`);
        const cacheExists = fs.existsSync(cacheFile);
        const cacheTime = cacheExists ? fs.statSync(cacheFile).mtime : 0;
        const cacheAge = (Date.now() - cacheTime) / 1000 / 60 / 60; // 小时
        
        // 如果缓存存在且不超过24小时，直接返回缓存
        if (cacheExists && cacheAge < 24) {
            console.log(`使用缓存的QQ头像: ${qq}`);
            return res.sendFile(cacheFile);
        }
        
        // 尝试不同的API获取头像
        let response;
        let buffer;
        
        try {
            // 尝试第一个API
            response = await fetch(`http://q.qlogo.cn/headimg_dl?dst_uin=${qq}&spec=640`, { 
                timeout: 3000 
            });
            
            if (!response.ok) {
                throw new Error(`第一个API失败: ${response.status}`);
            }
            
            buffer = await response.buffer();
        } catch (error) {
            console.log(`第一个API失败: ${error.message}`);
            
            try {
                // 尝试第二个API
                response = await fetch(`https://q2.qlogo.cn/headimg_dl?dst_uin=${qq}&spec=100`, { 
                    timeout: 3000 
                });
                
                if (!response.ok) {
                    throw new Error(`第二个API失败: ${response.status}`);
                }
                
                buffer = await response.buffer();
            } catch (error2) {
                console.log(`第二个API失败: ${error2.message}`);
                return res.redirect('/images/default-avatar.png');
            }
        }
        
        // 写入缓存
        fs.writeFileSync(cacheFile, buffer);
        console.log(`头像已缓存: ${cacheFile}`);
        
        // 设置缓存控制
        res.set({
            'Cache-Control': 'public, max-age=86400',  // 24小时缓存
            'Content-Type': response.headers.get('content-type') || 'image/jpeg'
        });
        
        // 发送头像数据
        res.send(buffer);
    } catch (error) {
        console.error('QQ头像代理错误:', error);
        // 出错时返回默认头像
        res.redirect('/images/default-avatar.png');
    }
});

export default router;
