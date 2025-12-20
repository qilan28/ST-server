import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAllUsers } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 直接创建nginx配置
function createNginxConfigDirect() {
    console.log('开始创建直接的Nginx配置...');
    
    // 获取用户信息
    const users = getAllUsers();
    const activeUsers = users.filter(user => {
        if (user.role === 'admin') return false;
        if (!user.port || user.port === 0) return false;
        return true;
    });
    
    console.log(`找到 ${activeUsers.length} 个活跃用户:`);
    activeUsers.forEach(user => {
        console.log(`- ${user.username}: 端口 ${user.port}`);
    });
    
    // 生成upstream块
    let upstreams = '';
    activeUsers.forEach(user => {
        upstreams += `
upstream st_${user.username} {
    server 127.0.0.1:${user.port};
}
`;
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
${locations}
    }
}`;

    // 写入配置文件
    const outputPath = path.join(__dirname, 'nginx', 'nginx.conf');
    fs.writeFileSync(outputPath, nginxConfig, 'utf-8');
    
    console.log(`✅ Nginx配置已写入: ${outputPath}`);
    console.log('配置内容预览:');
    console.log(nginxConfig);
    
    return outputPath;
}

// 直接运行
createNginxConfigDirect();
