import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { getNginxConfig } from '../utils/config-manager.js';
import { generateNginxConfig } from './generate-nginx-config.js';

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 修复 Cloudflare Tunnel 路由问题
 * 问题: 访问 /username/st/ 路径时错误地显示管理平台而不是用户的 SillyTavern 实例
 */
async function fixTunnelRouting() {
    console.log('=============================================');
    console.log('🛠️  开始修复 Cloudflare Tunnel 路由问题');
    console.log('=============================================\n');

    try {
        // 1. 重新生成 Nginx 配置
        console.log('1️⃣ 重新生成 Nginx 配置文件');
        const configPath = await generateNginxConfig();
        console.log(`✅ 配置文件已生成: ${configPath}`);

        // 2. 读取生成的配置
        console.log('\n2️⃣ 验证配置文件中的路径规则');
        const configContent = fs.readFileSync(configPath, 'utf8');
        
        // 检查配置中是否包含关键路由规则
        const hasLocationBlocks = configContent.includes('location ~* ^/(.+)/st/');
        console.log(`路由规则检查: ${hasLocationBlocks ? '✅ 找到' : '❌ 未找到'}`);

        // 3. 检查 Cloudflare 隧道配置
        console.log('\n3️⃣ 检查 Cloudflare 隧道配置');
        const nginxConfig = getNginxConfig();
        
        if (!nginxConfig.cloudflare_tunnel_domain || nginxConfig.cloudflare_tunnel_domain.trim() === '') {
            console.log('❌ 未配置 Cloudflare 隧道域名，请在管理面板中配置');
        } else {
            console.log(`✅ 已配置隧道域名: ${nginxConfig.cloudflare_tunnel_domain}`);
        }
        
        // 4. 检查 Nginx 配置路径
        const nginxPath = path.join(__dirname, '../nginx');
        console.log('\n4️⃣ 检查 Nginx 配置目录');
        console.log(`Nginx 配置目录: ${nginxPath}`);
        
        if (!fs.existsSync(nginxPath)) {
            console.log('❌ Nginx 目录不存在，尝试创建');
            fs.mkdirSync(nginxPath, { recursive: true });
        }

        // 5. 提示重启 Nginx
        console.log('\n5️⃣ 需要重启 Nginx 和 cloudflared 服务');
        console.log('请执行以下命令重启服务:');
        console.log('\n# Windows:');
        console.log('1. 重启 Nginx:');
        console.log('   停止: taskkill /F /IM nginx.exe');
        console.log(`   启动: nginx -c "${configPath}"`);
        console.log('\n2. 重启 cloudflared:');
        console.log('   停止当前的 cloudflared 进程');
        console.log('   启动: cloudflared tunnel run <隧道名>');
        
        console.log('\n# Linux:');
        console.log('1. 重启 Nginx:');
        console.log('   sudo systemctl restart nginx');
        console.log('\n2. 重启 cloudflared:');
        console.log('   sudo systemctl restart cloudflared');

        // 6. 确认 Cloudflare 配置
        console.log('\n6️⃣ 确认 Cloudflare 配置');
        console.log('确保 Cloudflare 隧道配置正确指向您的服务器。建议配置:');
        console.log('\nconfig.yml 文件内容:');
        console.log('```');
        console.log('tunnel: <您的隧道ID>');
        console.log('credentials-file: <路径到证书文件>');
        console.log('ingress:');
        console.log(`  - hostname: ${nginxConfig.cloudflare_tunnel_domain || '您的域名'}`);
        console.log(`  - service: http://localhost:${process.env.PORT || 3000}`);
        console.log('  - service: http_status:404');
        console.log('```');

        // 7. 验证步骤
        console.log('\n7️⃣ 验证步骤');
        console.log('重启服务后，请尝试:');
        console.log(`1. 访问管理平台: https://${nginxConfig.cloudflare_tunnel_domain || '您的域名'}/`);
        console.log(`2. 访问用户实例: https://${nginxConfig.cloudflare_tunnel_domain || '您的域名'}/用户名/st/`);
        
        console.log('\n如果问题依然存在，请检查:');
        console.log('1. 用户实例是否已启动');
        console.log('2. Cloudflare 隧道日志中是否有错误');
        console.log('3. Nginx 错误日志 (/var/log/nginx/error.log)');

        console.log('\n=============================================');
        console.log('✅ 修复过程完成');
        console.log('=============================================');
    } catch (error) {
        console.error(`❌ 修复过程出错: ${error.message}`);
        console.error(error.stack);
    }
}

// 执行修复
fixTunnelRouting().catch(console.error);
