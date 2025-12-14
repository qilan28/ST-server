import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAllUsers } from '../database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const MAIN_DOMAIN = process.env.MAIN_DOMAIN || 'localhost';
const NGINX_PORT = process.env.NGINX_PORT || '80';
const MANAGER_PORT = process.env.MANAGER_PORT || '3000';

function generateNginxConfig() {
    console.log('正在生成 Nginx 配置文件...');
    
    // 读取所有用户（排除管理员）
    const allUsers = getAllUsers();
    const users = allUsers.filter(user => user.role !== 'admin');
    
    console.log(`找到 ${users.length} 个用户需要配置`);
    
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
    
    // 生成 location 块
    let locationBlocks = '';
    users.forEach(user => {
        locationBlocks += `
    # ${user.username} 的 SillyTavern 实例
    location /${user.username}/st/ {
        proxy_pass http://st_${user.username}/;
        proxy_http_version 1.1;
        
        # WebSocket 支持
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # 基本代理头
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # 路径重写（移除前缀）
        rewrite ^/${user.username}/st/(.*) /$1 break;
        
        # 缓存控制
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # 缓冲设置
        proxy_buffering off;
        proxy_request_buffering off;
    }
`;
    });
    
    // 读取模板文件
    const templatePath = path.join(__dirname, '../nginx/nginx.conf.template');
    let template = fs.readFileSync(templatePath, 'utf-8');
    
    // 替换占位符
    template = template.replace('# {{UPSTREAM_SERVERS}}', upstreamServers.trim());
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
    console.log('🔧 使用方法：');
    console.log('   1. 复制生成的配置文件到 Nginx 配置目录');
    console.log('   2. 测试配置: nginx -t');
    console.log('   3. 重载配置: nginx -s reload');
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
