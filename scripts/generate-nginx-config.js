import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getNginxConfig } from '../utils/config-manager.js';
// 避免循环依赖，使用动态导入

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateNginxConfig() {
    console.log('正在生成 Nginx 配置文件...');
    
    // 检测当前操作系统
    const isWindows = process.platform === 'win32';
    console.log(`当前操作系统: ${isWindows ? 'Windows' : 'Linux/Unix'}`);
    
    try {
        // 读取配置
        const nginxConfig = getNginxConfig();
        const MAIN_DOMAIN = nginxConfig.domain || 'localhost';
        const NGINX_PORT = nginxConfig.port || 80;
        const MANAGER_PORT = process.env.PORT || 3000;
        const ENABLE_ACCESS_CONTROL = nginxConfig.enableAccessControl !== false; // 默认启用
        
        console.log(`域名: ${MAIN_DOMAIN}, 端口: ${NGINX_PORT}`);
        
        // 读取所有用户（排除管理员和没有端口的用户）
        // 使用动态导入避免循环依赖
        const { getAllUsers } = await import('../database.js');
        const allUsers = getAllUsers();
        const users = allUsers.filter(user => {
            // 排除管理员
            if (user.role === 'admin') return false;
            // 排除没有分配端口的用户
            if (!user.port || user.port === 0) return false;
            return true;
        });
        
        console.log(`找到 ${users.length} 个普通用户需要配置`);
        
        // 生成 upstream 块
        let upstreamServers = '';
        users.forEach(user => {
            upstreamServers += `
# ${user.username} 的 SillyTavern 实例
upstream st_${user.username} {
    server 127.0.0.1:${user.port} max_fails=3 fail_timeout=30s;
    # 添加健康检查和故障转移配置
}
`;
    });
    
    // 生成认证检查的内部 location 块
    let authCheckLocations = '';
    users.forEach(user => {
        authCheckLocations += `location = /auth-check-internal/${user.username} {
            internal;
            proxy_pass http://st_manager/api/auth-check/verify/${user.username};
            proxy_pass_request_body off;
            proxy_set_header Content-Length "";
            proxy_set_header X-Original-URI $request_uri;
            proxy_set_header X-Original-Method $request_method;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header Host $http_host;
            proxy_set_header Cookie $http_cookie;
        }
        
`;
    });
    
    // 生成增强的 Cookie 救援模式 location 块
    // 扩展匹配模式以捕获更多的静态资源请求
    let rescueMode = `location ~ ^/(api|locales|lib|css|style|styles|scripts|js|img|images|assets|public|data|uploads|fonts|icons|csrf-token|version|node_modules|script\.js|thumbnail|static|\.css|\.js|\.png|\.jpg|\.svg|\.woff|\.woff2|\.ttf|\.ico) {
            # 启用日志以追踪重定向
            #access_log /var/log/nginx/rescue_access.log;
            #error_log /var/log/nginx/rescue_error.log debug;
            
`;
    
    // 为每个用户添加 Cookie 检查
    users.forEach(user => {
        rescueMode += `            # ${user.username} 用户的 Cookie 检查
            if ($cookie_st_context = "${user.username}") {
                rewrite ^(.*)$ /${user.username}/st$1 last;
            }
            
`;
    });
    
    // 添加 Referer 备用检查
    rescueMode += `            # 备用：Referer 救援 (双重保险)
`;
    users.forEach(user => {
        rescueMode += `            if ($http_referer ~* "/${user.username}/st/") { rewrite ^(.*)$ /${user.username}/st$1 last; }
`;
    });
    
    rescueMode += `
            # 添加对 Origin 和特定已知问题的处理
            if ($http_origin ~* "(.*)/([^/]+)/st/") {
                set $user_context $2;
                rewrite ^(.*)$ /$user_context/st$1 last;
            }
            
            # 最后的默认路由 - 如果没有任何匹配转发给管理端
            proxy_pass http://st_manager;
        }`;
    
    // 生成静态文件的全局救援块 - 最高优先级
    let globalStaticRescue = `
    # 全局静态文件救援 - 最高优先级
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        # 通过 referer 判断应该转发到哪个用户实例
`;    
    
    // 添加每个用户的 referer 检查
    users.forEach(user => {
        globalStaticRescue += `        if ($http_referer ~* "/${user.username}/st/") {
            # 重写路径并转发到用户实例
            rewrite ^/(.*)$ /$1 break;
            proxy_pass http://st_${user.username};
            
            # 添加调试信息
            add_header X-Debug-User "${user.username}" always;
            add_header X-Debug-Source "static-rescue" always;
            add_header X-Debug-Path $uri always;
            
            # 禁用缓存确保每次重启后都能获取最新文件
            expires -1;
            add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" always;
            
            # 必要的代理头
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
`;
    });
    
    // 添加默认转发
    globalStaticRescue += `
        # 如果没有匹配的 referer，尝试使用 cookie
        proxy_pass http://st_manager;
        add_header X-Debug-Source "static-rescue-default" always;
    }
    `;
    
    // 生成 location 块
    let locationBlocks = '';
    locationBlocks += globalStaticRescue;
    users.forEach(user => {
        // 访问控制指令（如果启用）
        const accessControl = ENABLE_ACCESS_CONTROL ? `
        # 🔒 访问控制：只有 ${user.username} 用户才能访问
        auth_request /auth-check-internal/${user.username};
        error_page 401 403 = @access_denied;
        ` : '';
        
        locationBlocks += `
    # ${user.username} 的 SillyTavern 实例
    location /${user.username}/st {
        # 添加尾部斜杠重定向
        return 301 /${user.username}/st/;
    }
    
    location /${user.username}/st/ {${accessControl}
        # 路径重写：去除 /${user.username}/st/ 前缀
        rewrite ^/${user.username}/st/(.*)$ /$1 break;
        
        proxy_pass http://st_${user.username};
        proxy_http_version 1.1;
        
        # 设置 Cookie 标记用户上下文，用于救援模式
        add_header Set-Cookie "st_context=${user.username}; Path=/; Max-Age=86400; SameSite=Lax";
        
        # WebSocket 支持
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        
        # 代理头配置
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        
        # 增强的超时设置 - 给启动中的服务更多时间
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
        
        # 重试配置
        proxy_next_upstream error timeout http_502 http_503 http_504;
        proxy_next_upstream_timeout 30s;
        proxy_next_upstream_tries 3;
        
        # 启用缓冲以使用 sub_filter
        proxy_buffering on;
        proxy_buffer_size 128k;
        proxy_buffers 100 128k;
        proxy_busy_buffers_size 256k;
        
        # 禁用 gzip 以确保 sub_filter 工作
        proxy_set_header Accept-Encoding "";
        
        # HTML 内容重写 - 修复静态资源路径
        sub_filter_once off;
        sub_filter_types text/css text/javascript application/javascript application/json;
        
        # 注入 base 标签到 HTML 以确保所有相对路径正确
        sub_filter '<head>' '<head><base href="/${user.username}/st/">';
        
        # 重写 HTML 属性中的绝对路径
        sub_filter 'src="/' 'src="/${user.username}/st/';
        sub_filter 'href="/' 'href="/${user.username}/st/';
        sub_filter "src='/" "src='/${user.username}/st/";
        sub_filter "href='/" "href='/${user.username}/st/";
        sub_filter 'action="/' 'action="/${user.username}/st/';
        sub_filter 'data-src="/' 'data-src="/${user.username}/st/';
        
        # 重写 CSS 中的路径
        sub_filter 'url(/' 'url(/${user.username}/st/';
        sub_filter 'url("/' 'url("/${user.username}/st/';
        sub_filter "url('/" "url('/${user.username}/st/";
        sub_filter '@import "/' '@import "/${user.username}/st/';
        sub_filter "@import '/" "@import '/${user.username}/st/";
        
        # 重写 JavaScript 中的常见路径模式
        sub_filter '"/api/' '"/${user.username}/st/api/';
        sub_filter "'/api/" "'/${user.username}/st/api/";
        sub_filter '"/scripts/' '"/${user.username}/st/scripts/';
        sub_filter "'/scripts/" "'/${user.username}/st/scripts/";
        sub_filter '"/css/' '"/${user.username}/st/css/';
        sub_filter "'/css/" "'/${user.username}/st/css/";
        sub_filter '"/lib/' '"/${user.username}/st/lib/';
        sub_filter "'/lib/" "'/${user.username}/st/lib/";
        sub_filter '"/public/' '"/${user.username}/st/public/';
        sub_filter "'/public/" "'/${user.username}/st/public/";
        sub_filter '"/img/' '"/${user.username}/st/img/';
        sub_filter "'/img/" "'/${user.username}/st/img/";
        sub_filter '"/thumbnail/' '"/${user.username}/st/thumbnail/';
        sub_filter "'/thumbnail/" "'/${user.username}/st/thumbnail/";
        sub_filter '"/assets/' '"/${user.username}/st/assets/';
        sub_filter "'/assets/" "'/${user.username}/st/assets/";
        sub_filter '"/data/' '"/${user.username}/st/data/';
        sub_filter "'/data/" "'/${user.username}/st/data/";
        sub_filter '"/user/' '"/${user.username}/st/user/';
        sub_filter "'/user/" "'/${user.username}/st/user/";
        sub_filter '"/uploads/' '"/${user.username}/st/uploads/';
        sub_filter "'/uploads/" "'/${user.username}/st/uploads/";
        
        # 重写 fetch/XMLHttpRequest 等 API 调用
        sub_filter 'fetch("/' 'fetch("/${user.username}/st/';
        sub_filter "fetch('/" "fetch('/${user.username}/st/";
        sub_filter '.open("GET", "/' '.open("GET", "/${user.username}/st/';
        sub_filter ".open('GET', '/" ".open('GET', '/${user.username}/st/";
        sub_filter '.open("POST", "/' '.open("POST", "/${user.username}/st/';
        sub_filter ".open('POST', '/" ".open('POST', '/${user.username}/st/";
        
        # 重写常见的根路径引用
        sub_filter '="/"' '="/${user.username}/st/"';
        sub_filter "='/" "='/${user.username}/st/";
        
        # 处理重定向
        proxy_redirect / /${user.username}/st/;
        
        # 缓存控制
        proxy_cache_bypass $http_upgrade;
    }
    
    # ${user.username} - 静态资源专门处理（优化性能并防止 404）
    location ~ ^/${user.username}/st/(scripts|css|lib|img|images|assets|public|data|uploads|locales|style|styles|js|node_modules|fonts|icons|static)/ {
        rewrite ^/${user.username}/st/(.*)$ /$1 break;
        proxy_pass http://st_${user.username};
        proxy_http_version 1.1;
        
        # 设置 Cookie 标记用户上下文
        add_header Set-Cookie "st_context=${user.username}; Path=/; Max-Age=86400; SameSite=Lax";
        
        # 静态资源不需要 sub_filter，直接代理
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Original-URI $request_uri;
        
        # 对静态资源使用更长的超时时间
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        # 启用缓存但使用更适合重启的缓存设置
        expires 1h;
        add_header Cache-Control "public, max-age=3600";
        
        # 开启缓冲以处理不稳定连接
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        
        # 添加错误处理，对于 404 重试下一个上游服务器
        proxy_next_upstream error timeout http_404;
        proxy_next_upstream_tries 2;
    }
    
    # ${user.username} - 文件后缀匹配（防止静态资源 404）
    location ~ ^/${user.username}/st/.*\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|map|json)$ {
        rewrite ^/${user.username}/st/(.*)$ /$1 break;
        proxy_pass http://st_${user.username};
        proxy_http_version 1.1;
        
        # 设置 Cookie 标记用户上下文
        add_header Set-Cookie "st_context=${user.username}; Path=/; Max-Age=86400; SameSite=Lax";
        
        # 必要的代理头
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # 重启后防止缓存过时的文件
        proxy_cache_bypass $http_pragma $http_authorization;
        add_header X-Cache-Status $upstream_cache_status;
        
        # 启用缓存但使用更适合重启的缓存设置
        expires 10m;
        add_header Cache-Control "public, must-revalidate";
    }
`;
    });
    
    // 读取模板文件
    const templatePath = path.join(__dirname, '../nginx/nginx.conf.template');
    let template = fs.readFileSync(templatePath, 'utf-8');
    
    // 替换占位符
    template = template.replace('# {{UPSTREAM_SERVERS}}', upstreamServers.trim());
    template = template.replace('# {{AUTH_CHECK_LOCATIONS}}', authCheckLocations.trim());
    template = template.replace('# {{RESCUE_MODE}}', rescueMode.trim());
    template = template.replace('# {{LOCATION_BLOCKS}}', locationBlocks.trim());
    template = template.replace(/server_name localhost;/g, `server_name ${MAIN_DOMAIN};`);
    template = template.replace(/listen 80;/g, `listen ${NGINX_PORT};`);
    
    // 写入生成的配置文件
    const outputPath = path.join(__dirname, '../nginx/nginx.conf');
    fs.writeFileSync(outputPath, template, 'utf-8');
    
    console.log('✅ Nginx 配置文件生成成功！');
    console.log(`📁 输出路径: ${outputPath}`);
    console.log();
    console.log('📋 配置信息：');
    console.log(`   域名: ${MAIN_DOMAIN}`);
    console.log(`   监听端口: ${NGINX_PORT}`);
    console.log(`   管理平台端口: ${MANAGER_PORT}`);
    console.log(`   用户数量: ${users.length}`);
    console.log();
    console.log('🔧 部署方法：');
    console.log();
    console.log('   方法 1：一键自动部署（推荐）');
    console.log('   npm run deploy-nginx');
    console.log();
    console.log('   方法 2：直接使用生成的配置');
    console.log('   sudo nginx -c ' + outputPath);
    console.log('   注意：使用此方法前请先停止现有 Nginx');
    console.log();
    console.log('   方法 3：复制到标准配置目录');
    console.log('   sudo cp nginx/nginx.conf /etc/nginx/nginx.conf');
    console.log('   sudo nginx -t && sudo nginx -s reload');
    console.log();
    console.log('🌐 访问地址示例：');
    if (users.length > 0) {
        const exampleUser = users[0];
        console.log(`   主站: http://${MAIN_DOMAIN}:${NGINX_PORT}/`);
        console.log(`   ${exampleUser.username} 的 ST: http://${MAIN_DOMAIN}:${NGINX_PORT}/${exampleUser.username}/st/`);
    }
    console.log();
    
    // 返回输出路径
    return outputPath;
    
    } catch (error) {
        // 处理错误
        console.error('❗ 生成Nginx配置文件时出错:', error.message);
        throw error; // 向上抛出错误
    }
}

// 如果直接运行此脚本
(async () => {
    try {
        await generateNginxConfig();
    } catch (error) {
        console.error('❌ 生成配置文件失败:', error.message);
        process.exit(1);
    }
})();

export { generateNginxConfig };
