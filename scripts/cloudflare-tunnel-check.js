import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getNginxConfig } from '../utils/config-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 检查 Cloudflare Tunnel 配置并诊断连接问题
 */
async function checkCloudflareTunnel() {
    console.log('=============================================');
    console.log('🛠️  Cloudflare Tunnel 连接诊断工具');
    console.log('=============================================\n');
    
    // 读取 Nginx 配置
    const nginxConfig = getNginxConfig();
    console.log('当前 Nginx 配置:');
    console.log(JSON.stringify(nginxConfig, null, 2));
    console.log('\n');
    
    // 检查配置是否有 Cloudflare Tunnel 域名
    if (!nginxConfig.cloudflare_tunnel_domain || nginxConfig.cloudflare_tunnel_domain.trim() === '') {
        console.log('❌ 未配置 Cloudflare Tunnel 域名');
        console.log('解决方法: 在管理员面板中配置 Cloudflare Tunnel 域名');
        console.log('例如: your-tunnel.trycloudflare.com');
        console.log('\n');
    } else {
        console.log('✅ 已配置 Cloudflare Tunnel 域名:', nginxConfig.cloudflare_tunnel_domain);
        console.log('\n');
    }
    
    // 检查本地服务
    console.log('检查本地服务...');
    
    // 检查 Nginx 端口是否在监听
    const nginxPort = nginxConfig.port || 80;
    checkPort(nginxPort, '✅ Nginx 端口正在监听', `❌ Nginx 端口 ${nginxPort} 未监听`);
    
    // 检查 ST-server 端口是否在监听
    const stPort = process.env.PORT || 3000;
    checkPort(stPort, '✅ ST-server 端口正在监听', `❌ ST-server 端口 ${stPort} 未监听`);
    
    // 检查 Cloudflare 错误日志中提到的端口
    checkPort(8001, '✅ 端口 8001 已在监听 (Cloudflare Tunnel 正在尝试连接的端口)', 
                    '❌ 端口 8001 未监听 (这可能是 Cloudflare Tunnel 配置错误的原因)');
    
    console.log('\n');
    console.log('Cloudflare Tunnel 修复建议:');
    console.log('1. 检查您的 cloudflared 配置文件 (config.yml)');
    console.log(`   确保它指向正确的本地端口 (${stPort} 或 ${nginxPort})`);
    console.log('2. 尝试以下配置:');
    console.log('   ingress:');
    console.log(`     - hostname: ${nginxConfig.cloudflare_tunnel_domain || 'your-domain.com'}`);
    console.log(`     - service: http://localhost:${stPort}`);
    console.log('     - service: http_status:404');
    console.log('\n');
    console.log('要测试连接，请在命令行运行:');
    console.log(`   curl http://localhost:${stPort}`);
    console.log('\n');
    console.log('如果您使用的是 cloudflared 命令行，尝试:');
    console.log(`   cloudflared tunnel --url http://localhost:${stPort}`);
}

/**
 * 检查端口是否在监听
 * @param {number} port 要检查的端口
 * @param {string} successMsg 成功消息
 * @param {string} failMsg 失败消息
 */
function checkPort(port, successMsg, failMsg) {
    const testServer = http.createServer();
    
    testServer.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(successMsg);
        } else {
            console.log(`端口 ${port} 检查错误:`, err.message);
        }
        testServer.close();
    });
    
    testServer.once('listening', () => {
        console.log(failMsg);
        testServer.close();
    });
    
    testServer.listen(port);
}

// 执行检查
checkCloudflareTunnel().catch(err => {
    console.error('诊断工具出错:', err);
});
