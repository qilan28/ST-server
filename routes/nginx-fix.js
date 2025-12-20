import express from 'express';
import { generateSimpleNginxConfig } from '../scripts/generate-simple-nginx-config.js';
import { reloadNginx } from '../utils/nginx-reload.js';

const router = express.Router();

// 修复静态文件404问题的API
router.post('/fix-static-files', async (req, res) => {
    try {
        console.log('[API] 开始修复静态文件404问题...');
        
        // 使用直接创建配置的方法
        console.log('[API] 直接创建Nginx配置...');
        const fs = await import('fs');
        const path = await import('path');
        const { getAllUsers } = await import('../database.js');
        const { fileURLToPath } = await import('url');
        
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        
        // 获取用户信息
        const users = getAllUsers();
        const activeUsers = users.filter(user => {
            if (user.role === 'admin') return false;
            if (!user.port || user.port === 0) return false;
            return true;
        });
        
        console.log(`[API] 找到 ${activeUsers.length} 个活跃用户`);
        
        // 生成upstream块
        let upstreams = '';
        activeUsers.forEach(user => {
            upstreams += `\nupstream st_${user.username} {\n    server 127.0.0.1:${user.port};\n}\n`;
        });
        
        // 生成location块
        let locations = '';
        activeUsers.forEach(user => {
            locations += `
        # ${user.username} 的 SillyTavern 实例
        location /${user.username}/st {
            return 301 /${user.username}/st/;
        }
        
        location /${user.username}/st/ {
            rewrite ^/${user.username}/st/(.*)$ /$1 break;
            proxy_pass http://st_${user.username};
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 120s;
            proxy_send_timeout 120s;
            proxy_read_timeout 120s;
        }
`;
        });
        
        // 生成管理平台静态文件处理块 - 优先级最高
        let staticRescue = `
        # 管理平台静态文件 - 最高优先级
        location ~ ^/(css|js|img|images|assets|fonts)/ {
            proxy_pass http://st_manager;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
        
        # 管理平台根目录静态文件
        location ~* ^/(style\.css|table-fix\.css|favicon\.ico)$ {
            proxy_pass http://st_manager;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
        
        # 用户实例静态文件救援 - 根据referer头判断应该转发到哪个用户
        location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|map|json)$ {`;
        
        // 为每个用户添加referer检查
        activeUsers.forEach(user => {
            staticRescue += `
            if ($http_referer ~* "/${user.username}/st") {
                proxy_pass http://st_${user.username};
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            }`;
        });

        staticRescue += `
            
            # 如果没有匹配的referer，返回到管理平台
            proxy_pass http://st_manager;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }`;
        
        // 完整的nginx配置
        const nginxConfig = `worker_processes auto;
pid /run/nginx.pid;

events {
    worker_connections 768;
}

http {
    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 100M;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;

    # 管理平台
    upstream st_manager {
        server 127.0.0.1:3000;
    }
${upstreams}
    
    server {
        listen 80;
        server_name localhost;
        
        # 主服务（管理平台）
        location / {
            proxy_pass http://st_manager;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }
${staticRescue}
${locations}
    }
}`;

        // 写入配置文件
        const outputPath = path.join(__dirname, '..', 'nginx', 'nginx.conf');
        fs.writeFileSync(outputPath, nginxConfig, 'utf-8');
        console.log(`[API] Nginx配置已写入: ${outputPath}`);
        
        // 强制重载Nginx
        console.log('[API] 重载Nginx配置...');
        const reloadResult = await reloadNginx(null, true);
        
        if (reloadResult.success) {
            console.log(`[API] Nginx重载成功，方法: ${reloadResult.method}`);
            res.json({
                success: true,
                message: `静态文件404问题修复完成，配置了${activeUsers.length}个用户`,
                reloadMethod: reloadResult.method,
                users: activeUsers.map(u => ({username: u.username, port: u.port}))
            });
        } else {
            console.error(`[API] Nginx重载失败: ${reloadResult.error}`);
            res.status(500).json({
                success: false,
                error: `Nginx重载失败: ${reloadResult.error}`
            });
        }
        
    } catch (error) {
        console.error('[API] 修复过程出错:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 重新生成Nginx配置的API
router.post('/regenerate-nginx', async (req, res) => {
    try {
        console.log('[API] 重新生成Nginx配置...');
        await generateSimpleNginxConfig();
        
        res.json({
            success: true,
            message: 'Nginx配置重新生成完成'
        });
        
    } catch (error) {
        console.error('[API] 生成配置出错:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
