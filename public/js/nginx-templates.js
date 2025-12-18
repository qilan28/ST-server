/**
 * Nginx配置模板文件
 * 提供不同场景的Nginx配置模板
 */

// 基础配置模板 - 简单反向代理
const BASIC_TEMPLATE = `server {
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
}`;

// 高级配置模板 - 包含静态文件优化和缓存
const ADVANCED_TEMPLATE = `server {
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
}`;

// HTTPS配置模板 - 包含SSL配置
const HTTPS_TEMPLATE = `server {
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
}`;

// 多用户模式配置模板
const MULTIUSER_TEMPLATE = `server {
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
        # 重写路径，去掉用户前缀
        rewrite ^/([a-zA-Z0-9_-]+)/st/(.*) /$2 break;
        
        # 解析用户端口 (从内部API)
        set $user_port "";
        access_by_lua_block {
            local http = require "resty.http"
            local httpc = http.new()
            local res, err = httpc:request_uri("http://localhost:{{port}}/api/port/" .. ngx.var.1, {
                method = "GET",
                headers = {
                    ["Content-Type"] = "application/json",
                }
            })
            
            if not res then
                ngx.status = 500
                ngx.say("Failed to get port: ", err)
                ngx.exit(500)
            end
            
            if res.status == 200 then
                local cjson = require("cjson")
                local data = cjson.decode(res.body)
                ngx.var.user_port = data.port
            else
                ngx.status = res.status
                ngx.say("Error: ", res.body)
                ngx.exit(res.status)
            end
        }
        
        # 代理到用户端口
        proxy_pass http://localhost:$user_port;
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
}`;

// 导出模板
window.nginxTemplates = {
    basic: BASIC_TEMPLATE,
    advanced: ADVANCED_TEMPLATE,
    https: HTTPS_TEMPLATE,
    multiuser: MULTIUSER_TEMPLATE
};

// 替换模板变量
window.renderNginxTemplate = function(template, domain, port) {
    return template
        .replace(/{{domain}}/g, domain || 'localhost')
        .replace(/{{port}}/g, port || '7092');
};
