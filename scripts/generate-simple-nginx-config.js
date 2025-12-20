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
