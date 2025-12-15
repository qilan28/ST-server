import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAllUsers } from '../database.js';
import { getNginxConfig } from '../utils/config-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function generateNginxConfig() {
    console.log('正在生成 Nginx 配置文件...');
    
    // 读取配置
    const nginxConfig = getNginxConfig();
    const MAIN_DOMAIN = nginxConfig.domain || 'localhost';
    const NGINX_PORT = nginxConfig.port || 80;
    const MANAGER_PORT = process.env.PORT || 3000;
    
    // 读取所有用户（排除管理员和没有端口的用户）
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
    server 127.0.0.1:${user.port};
}
`;
    });
    
    // 生成 Cookie 救援模式 location 块
    let rescueMode = `location ~ ^/(api|locales|lib|css|scripts|img|assets|public|data|uploads|fonts|icons|csrf-token|version|node_modules|script\\.js|thumbnail) {
            
`;
    
    // 为每个用户添加 Cookie 检查
    users.forEach(user => {
        const pathSegment = user.path_uuid || 'st';
        rescueMode += `            # ${user.username} 用户的 Cookie 检查
            if ($cookie_st_context = "${user.username}") {
                rewrite ^(.*)$ /${user.username}/${pathSegment}$1 last;
            }
            
`;
    });
    
    // 添加 Referer 备用检查
    rescueMode += `            # 备用：Referer 救援 (双重保险)
`;
    users.forEach(user => {
        const pathSegment = user.path_uuid || 'st';
        rescueMode += `            if ($http_referer ~* "/${user.username}/${pathSegment}/") { rewrite ^(.*)$ /${user.username}/${pathSegment}$1 last; }
`;
    });
    
    rescueMode += `
            # 默认转发给管理端
            proxy_pass http://st_manager;
        }`;
    
    // 生成 location 块
    let locationBlocks = '';
    users.forEach(user => {
        const pathSegment = user.path_uuid || 'st'; // 使用 UUID 或回退到 'st'
        locationBlocks += `
    # ${user.username} 的 SillyTavern 实例 (路径: /${user.username}/${pathSegment}/)
    location /${user.username}/${pathSegment} {
        # 添加尾部斜杠重定向
        return 301 /${user.username}/${pathSegment}/;
    }
    
    location /${user.username}/${pathSegment}/ {
        # 路径重写：去除 /${user.username}/${pathSegment}/ 前缀
        rewrite ^/${user.username}/${pathSegment}/(.*)$ /$1 break;
        
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
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
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
        sub_filter '<head>' '<head><base href="/${user.username}/${pathSegment}/">';
        
        # 重写 HTML 属性中的绝对路径
        sub_filter 'src="/' 'src="/${user.username}/${pathSegment}/';
        sub_filter 'href="/' 'href="/${user.username}/${pathSegment}/';
        sub_filter "src='/" "src='/${user.username}/${pathSegment}/";
        sub_filter "href='/" "href='/${user.username}/${pathSegment}/";
        sub_filter 'action="/' 'action="/${user.username}/${pathSegment}/';
        sub_filter 'data-src="/' 'data-src="/${user.username}/${pathSegment}/';
        
        # 重写 CSS 中的路径
        sub_filter 'url(/' 'url(/${user.username}/${pathSegment}/';
        sub_filter 'url("/' 'url("/${user.username}/${pathSegment}/';
        sub_filter "url('/" "url('/${user.username}/${pathSegment}/";
        sub_filter '@import "/' '@import "/${user.username}/${pathSegment}/';
        sub_filter "@import '/" "@import '/${user.username}/${pathSegment}/";
        
        # 重写 JavaScript 中的常见路径模式
        sub_filter '"/api/' '"/${user.username}/${pathSegment}/api/';
        sub_filter "'/api/" "'/${user.username}/${pathSegment}/api/";
        sub_filter '"/scripts/' '"/${user.username}/${pathSegment}/scripts/';
        sub_filter "'/scripts/" "'/${user.username}/${pathSegment}/scripts/";
        sub_filter '"/css/' '"/${user.username}/${pathSegment}/css/';
        sub_filter "'/css/" "'/${user.username}/${pathSegment}/css/";
        sub_filter '"/lib/' '"/${user.username}/${pathSegment}/lib/';
        sub_filter "'/lib/" "'/${user.username}/${pathSegment}/lib/";
        sub_filter '"/public/' '"/${user.username}/${pathSegment}/public/';
        sub_filter "'/public/" "'/${user.username}/${pathSegment}/public/";
        sub_filter '"/img/' '"/${user.username}/${pathSegment}/img/';
        sub_filter "'/img/" "'/${user.username}/${pathSegment}/img/";
        sub_filter '"/thumbnail/' '"/${user.username}/${pathSegment}/thumbnail/';
        sub_filter "'/thumbnail/" "'/${user.username}/${pathSegment}/thumbnail/";
        sub_filter '"/assets/' '"/${user.username}/${pathSegment}/assets/';
        sub_filter "'/assets/" "'/${user.username}/${pathSegment}/assets/";
        sub_filter '"/data/' '"/${user.username}/${pathSegment}/data/';
        sub_filter "'/data/" "'/${user.username}/${pathSegment}/data/";
        sub_filter '"/user/' '"/${user.username}/${pathSegment}/user/';
        sub_filter "'/user/" "'/${user.username}/${pathSegment}/user/";
        sub_filter '"/uploads/' '"/${user.username}/${pathSegment}/uploads/';
        sub_filter "'/uploads/" "'/${user.username}/${pathSegment}/uploads/";
        
        # 重写 fetch/XMLHttpRequest 等 API 调用
        sub_filter 'fetch("/' 'fetch("/${user.username}/${pathSegment}/';
        sub_filter "fetch('/" "fetch('/${user.username}/${pathSegment}/";
        sub_filter '.open("GET", "/' '.open("GET", "/${user.username}/${pathSegment}/';
        sub_filter ".open('GET', '/" ".open('GET', '/${user.username}/${pathSegment}/";
        sub_filter '.open("POST", "/' '.open("POST", "/${user.username}/${pathSegment}/';
        sub_filter ".open('POST', '/" ".open('POST', '/${user.username}/${pathSegment}/";
        
        # 重写常见的根路径引用
        sub_filter '="/"' '="/${user.username}/${pathSegment}/"';
        sub_filter "='/" "='/${user.username}/${pathSegment}/";
        
        # 处理重定向
        proxy_redirect / /${user.username}/${pathSegment}/;
        
        # 缓存控制
        proxy_cache_bypass $http_upgrade;
    }
    
    # ${user.username} - 静态资源专门处理（优化性能）
    location ~ ^/${user.username}/${pathSegment}/(scripts|css|lib|img|assets|public|data|uploads|locales)/ {
        rewrite ^/${user.username}/${pathSegment}/(.*)$ /$1 break;
        proxy_pass http://st_${user.username};
        proxy_http_version 1.1;
        
        # 设置 Cookie 标记用户上下文
        add_header Set-Cookie "st_context=${user.username}; Path=/; Max-Age=86400; SameSite=Lax";
        
        # 静态资源不需要 sub_filter，直接代理
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 启用缓存
        expires 7d;
        add_header Cache-Control "public, immutable";
        
        # 关闭缓冲提高性能
        proxy_buffering off;
    }
`;
    });
    
    // 读取模板文件
    const templatePath = path.join(__dirname, '../nginx/nginx.conf.template');
    let template = fs.readFileSync(templatePath, 'utf-8');
    
    // 替换占位符
    template = template.replace('# {{UPSTREAM_SERVERS}}', upstreamServers.trim());
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
}

// 如果直接运行此脚本
try {
    generateNginxConfig();
} catch (error) {
    console.error('❌ 生成配置文件失败:', error.message);
    process.exit(1);
}

export { generateNginxConfig };
