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
    
    // 生成 location 块
    let locationBlocks = '';
    users.forEach(user => {
        locationBlocks += `
    # ${user.username} 的 SillyTavern 实例
    location /${user.username}/st {
        # 添加尾部斜杠重定向
        return 301 /${user.username}/st/;
    }
    
    location /${user.username}/st/ {
        # 使用正则替换，自动去除前缀
        rewrite ^/${user.username}/st/(.*)$ /$1 break;
        
        proxy_pass http://st_${user.username};
        proxy_http_version 1.1;
        
        # WebSocket 支持
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # 基本代理头
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 重要：告诉后端应用它的基础路径
        proxy_set_header X-Forwarded-Prefix /${user.username}/st;
        
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
