import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getNginxConfig } from '../utils/config-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateSimpleNginxConfig() {
    console.log('正在生成简化的 Nginx 配置文件...');
    
    try {
        // 读取配置
        const nginxConfig = getNginxConfig();
        const MAIN_DOMAIN = nginxConfig.domain || 'localhost';
        const NGINX_PORT = nginxConfig.port || 80;
        const MANAGER_PORT = process.env.PORT || 3000;
        
        console.log(`域名: ${MAIN_DOMAIN}, 端口: ${NGINX_PORT}`);
        
        // 读取所有用户
        const { getAllUsers } = await import('../database.js');
        const allUsers = getAllUsers();
        const users = allUsers.filter(user => {
            if (user.role === 'admin') return false;
            if (!user.port || user.port === 0) return false;
            return true;
        });
        
        console.log(`找到 ${users.length} 个普通用户需要配置`);
        
        // 生成 upstream 块 - 简化版
        let upstreamServers = '';
        users.forEach(user => {
            upstreamServers += `
# ${user.username} 的 SillyTavern 实例
upstream st_${user.username} {
    server 127.0.0.1:${user.port};
}
`;
        });
        
        // 生成 location 块 - 简化版
        let locationBlocks = '';
        users.forEach(user => {
            locationBlocks += `
        # ${user.username} 的 SillyTavern 实例
        location /${user.username}/st {
            return 301 /${user.username}/st/;
        }
        
        location /${user.username}/st/ {
            # 路径重写
            rewrite ^/${user.username}/st/(.*)$ /$1 break;
            
            proxy_pass http://st_${user.username};
            proxy_http_version 1.1;
            
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
            sub_filter_types text/html text/css text/javascript application/javascript application/json;
            
            # 注入 base 标签到 HTML 以确保所有相对路径正确
            sub_filter '<head>' '<head><base href="/${user.username}/st/">';
            
            # 重写 HTML 属性中的绝对路径
            sub_filter 'src="/' 'src="/${user.username}/st/';
            sub_filter 'href="/' 'href="/${user.username}/st/';
            sub_filter "src='/" "src='/${user.username}/st/";
            sub_filter "href='/" "href='/${user.username}/st/";
            sub_filter 'action="/' 'action="/${user.username}/st/';
            
            # 重写 CSS 中的路径
            sub_filter 'url(/' 'url(/${user.username}/st/';
            sub_filter 'url("/' 'url("/${user.username}/st/';
            sub_filter "url('/" "url('/${user.username}/st/";
            
            # 重写 JavaScript 中的常见路径模式
            sub_filter '"/api/' '"/${user.username}/st/api/';
            sub_filter "'/api/" "'/${user.username}/st/api/";
            sub_filter '"/css/' '"/${user.username}/st/css/';
            sub_filter "'/css/" "'/${user.username}/st/css/";
            sub_filter '"/scripts/' '"/${user.username}/st/scripts/';
            sub_filter "'/scripts/" "'/${user.username}/st/scripts/";
            sub_filter '"/lib/' '"/${user.username}/st/lib/';
            sub_filter "'/lib/" "'/${user.username}/st/lib/";
            sub_filter '"/public/' '"/${user.username}/st/public/';
            sub_filter "'/public/" "'/${user.username}/st/public/";
            
            # 处理重定向
            proxy_redirect / /${user.username}/st/;
        }
        
        # ${user.username} - 静态资源专门处理
        location ~ ^/${user.username}/st/(scripts|css|lib|img|assets|public|data|uploads|locales|style|styles|js|node_modules|fonts|icons|static)/ {
            rewrite ^/${user.username}/st/(.*)$ /$1 break;
            proxy_pass http://st_${user.username};
            proxy_http_version 1.1;
            
            # 静态资源不需要 sub_filter，直接代理
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # 对静态资源使用更长的超时时间
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
            
            # 关闭缓冲提高性能
            proxy_buffering off;
            
            # 禁用缓存确保重启后获取最新文件
            expires -1;
            add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" always;
        }
        
        # ${user.username} - 文件后缀匹配（防止静态资源 404）
        location ~ ^/${user.username}/st/.*\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|map|json)$ {
            rewrite ^/${user.username}/st/(.*)$ /$1 break;
            proxy_pass http://st_${user.username};
            proxy_http_version 1.1;
            
            # 必要的代理头
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            
            # 禁用缓存确保重启后获取最新文件
            expires -1;
            add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" always;
        }
`;
        });
        
        // 读取简化模板文件
        const templatePath = path.join(__dirname, '../nginx/nginx-simple-fix.conf.template');
        let template = fs.readFileSync(templatePath, 'utf-8');
        
        // 替换占位符
        template = template.replace('# {{UPSTREAM_SERVERS}}', upstreamServers.trim());
        template = template.replace('# {{LOCATION_BLOCKS}}', locationBlocks.trim());
        template = template.replace(/server_name localhost;/g, `server_name ${MAIN_DOMAIN};`);
        template = template.replace(/listen 80;/g, `listen ${NGINX_PORT};`);
        
        // 写入生成的配置文件
        const outputPath = path.join(__dirname, '../nginx/nginx.conf');
        fs.writeFileSync(outputPath, template, 'utf-8');
        
        console.log('✅ 简化的 Nginx 配置文件生成成功！');
        console.log(`📁 输出路径: ${outputPath}`);
        console.log();
        console.log('📋 配置信息：');
        console.log(`   域名: ${MAIN_DOMAIN}`);
        console.log(`   监听端口: ${NGINX_PORT}`);
        console.log(`   用户数量: ${users.length}`);
        
        return outputPath;
        
    } catch (error) {
        console.error('❗ 生成简化Nginx配置文件时出错:', error.message);
        throw error;
    }
}

// 如果直接运行此脚本
if (process.argv[1].includes('generate-simple-nginx-config.js')) {
    (async () => {
        try {
            await generateSimpleNginxConfig();
        } catch (error) {
            console.error('❌ 生成配置文件失败:', error.message);
            process.exit(1);
        }
    })();
}

export { generateSimpleNginxConfig };
