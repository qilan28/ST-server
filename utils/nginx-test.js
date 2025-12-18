/**
 * Nginx配置测试工具
 */

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Nginx配置测试函数
export async function testNginxConfig(configContent) {
    return new Promise((resolve) => {
        try {
            // 确定操作系统
            const isWindows = os.platform() === 'win32';
            
            if (isWindows) {
                // Windows平台，无法测试Nginx配置
                resolve({
                    success: true,
                    message: 'Windows环境下跳过Nginx配置语法测试',
                    method: 'windows_simulation'
                });
                return;
            }

            // 创建临时配置文件
            const tempConfigPath = path.join(os.tmpdir(), `nginx_test_${Date.now()}.conf`);
            fs.writeFileSync(tempConfigPath, configContent, 'utf-8');
            
            // 执行nginx -t -c /tmp/config.conf命令测试语法
            exec(`nginx -t -c ${tempConfigPath}`, (error, stdout, stderr) => {
                // 删除临时文件
                try {
                    fs.unlinkSync(tempConfigPath);
                } catch (e) {
                    // 忽略删除临时文件错误
                }
                
                // 检查结果
                if (error) {
                    resolve({
                        success: false,
                        error: `Nginx配置测试失败: ${stderr || stdout || error.message}`
                    });
                } else {
                    resolve({
                        success: true,
                        message: `Nginx配置测试通过: ${stdout || stderr || 'OK'}`
                    });
                }
            });
        } catch (error) {
            resolve({
                success: false,
                error: `执行测试失败: ${error.message}`
            });
        }
    });
}

// 渲染配置模板函数
export function renderNginxConfig(template, domain, port, options = {}) {
    let config = template;
    
    // 替换基础变量
    config = config.replace(/{{domain}}/g, domain || 'localhost');
    config = config.replace(/{{port}}/g, port || '7092');
    
    // SSL证书路径
    if (options.sslCertPath) {
        const basePath = options.sslCertPath.replace(/fullchain\.pem$/, '');
        config = config.replace(/\/etc\/letsencrypt\/live\/{{domain}}\//g, basePath);
    }
    
    // 日志目录
    if (options.logDir) {
        config = config.replace(/\/var\/log\/nginx\//g, options.logDir.endsWith('/') ? options.logDir : options.logDir + '/');
    }
    
    return config;
}

// 获取配置模板
export function getNginxTemplate(templateName) {
    const templates = {
        basic: `server {
    listen 80;
    server_name {{domain}};

    location / {
        proxy_pass http://localhost:{{port}};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}`,
        advanced: `server {
    listen 80;
    server_name {{domain}};

    access_log /var/log/nginx/{{domain}}_access.log;
    error_log /var/log/nginx/{{domain}}_error.log;

    # 静态文件缓存设置
    location ~* \\.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /path/to/ST-server/public;
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }

    # API请求转发
    location /api/ {
        proxy_pass http://localhost:{{port}}/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 所有其他请求转发到后端服务
    location / {
        proxy_pass http://localhost:{{port}};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 解决某些URL路径问题
        try_files $uri $uri/ /index.html;
    }
}`,
        https: `server {
    listen 80;
    server_name {{domain}};
    # 将HTTP请求重定向到HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name {{domain}};
    
    # SSL证书配置
    ssl_certificate     /etc/letsencrypt/live/{{domain}}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/{{domain}}/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    
    # 优化SSL
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 10m;

    access_log /var/log/nginx/{{domain}}_access.log;
    error_log /var/log/nginx/{{domain}}_error.log;

    # 静态文件缓存设置
    location ~* \\.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /path/to/ST-server/public;
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }

    # API请求转发
    location /api/ {
        proxy_pass http://localhost:{{port}}/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 所有其他请求转发到后端服务
    location / {
        proxy_pass http://localhost:{{port}};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 解决某些URL路径问题
        try_files $uri $uri/ /index.html;
    }
}`,
        multiuser: `server {
    listen 80;
    server_name {{domain}};

    access_log /var/log/nginx/{{domain}}_access.log;
    error_log /var/log/nginx/{{domain}}_error.log;

    # 全局API请求代理
    location /api/ {
        proxy_pass http://localhost:{{port}}/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 静态资源
    location ~* ^/(?!api|[a-zA-Z0-9_-]+/st).*\\.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /path/to/ST-server/public;
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }

    # 主页处理
    location = / {
        proxy_pass http://localhost:{{port}};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    # 用户实例子路径配置
    # 格式: /username/st
    location ~ ^/([a-zA-Z0-9_-]+)/st {
        # 解析用户端口
        proxy_pass http://localhost:{{port}}/user-proxy/$1;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 其他请求处理
    location / {
        proxy_pass http://localhost:{{port}};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}`
    };
    
    return templates[templateName] || templates.basic;
}
