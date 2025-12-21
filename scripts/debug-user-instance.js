import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { findUserByUsername } from '../database.js';
import { getNginxConfig } from '../utils/config-manager.js';

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 调试用户实例访问问题
 * @param {string} username - 要调试的用户名
 */
async function debugUserInstance(username) {
    console.log('=============================================');
    console.log(`🔍 开始调试用户 ${username} 的实例访问问题`);
    console.log('=============================================\n');

    try {
        // 1. 检查用户是否存在
        console.log(`1️⃣ 检查用户 ${username} 是否存在`);
        const user = findUserByUsername(username);
        
        if (!user) {
            console.log(`❌ 用户 ${username} 不存在！`);
            return;
        }
        
        console.log(`✅ 用户存在: ${JSON.stringify({
            id: user.id,
            username: user.username,
            port: user.port,
            status: user.status
        })}`);
        
        // 2. 检查用户实例端口是否在运行
        console.log(`\n2️⃣ 检查端口 ${user.port} 是否在运行`);
        
        try {
            await checkPort(user.port);
            console.log(`✅ 端口 ${user.port} 已在监听，说明实例可能正在运行`);
        } catch (err) {
            console.log(`❌ 端口 ${user.port} 未在监听: ${err.message}`);
            console.log('  解决方法: 在管理面板中启动该用户的实例');
        }
        
        // 3. 检查 Nginx 配置
        console.log('\n3️⃣ 检查 Nginx 配置');
        const nginxConfig = getNginxConfig();
        console.log(`Nginx 配置: ${JSON.stringify(nginxConfig, null, 2)}`);
        
        if (!nginxConfig.enabled) {
            console.log('❌ Nginx 未启用，请在管理面板中启用 Nginx');
        }
        
        // 4. 生成直接访问链接
        console.log('\n4️⃣ 尝试直接访问用户实例');
        console.log(`直接访问链接: http://localhost:${user.port}`);
        console.log('请尝试访问此链接，验证实例是否正常运行');
        
        // 5. 检查用户路由配置
        console.log('\n5️⃣ 检查用户路由配置');
        const nginxConfPath = path.join(__dirname, '../nginx/nginx.conf');
        
        if (!fs.existsSync(nginxConfPath)) {
            console.log('❌ Nginx 配置文件不存在，请生成配置文件');
        } else {
            const nginxConfContent = fs.readFileSync(nginxConfPath, 'utf8');
            const userLocationPattern = new RegExp(`location \\/${username}\\/st\\s*\\{`);
            const hasUserLocation = userLocationPattern.test(nginxConfContent);
            
            console.log(`用户路由配置: ${hasUserLocation ? '✅ 已找到' : '❌ 未找到'}`);
            
            if (!hasUserLocation) {
                console.log('  可能需要重新生成 Nginx 配置');
                console.log('  运行: node scripts/generate-nginx-config.js');
            }
        }
        
        // 6. 检查 Cloudflare 隧道配置
        console.log('\n6️⃣ 检查 Cloudflare 隧道配置');
        
        if (!nginxConfig.cloudflare_tunnel_domain || nginxConfig.cloudflare_tunnel_domain.trim() === '') {
            console.log('❌ 未配置 Cloudflare 隧道域名');
        } else {
            console.log(`✅ 已配置隧道域名: ${nginxConfig.cloudflare_tunnel_domain}`);
        }
        
        // 7. 手动测试路由
        console.log('\n7️⃣ 手动测试路由');
        console.log('请使用以下命令测试路由:');
        console.log('\n# 测试直接访问实例:');
        console.log(`curl http://localhost:${user.port}`);
        
        console.log('\n# 测试通过 Nginx 访问:');
        console.log(`curl -H "Host: ${nginxConfig.domain}" http://localhost:${nginxConfig.port}/${username}/st/`);
        
        // 8. 解决建议
        console.log('\n8️⃣ 可能的解决方案');
        console.log('1. 确保用户实例已启动');
        console.log('2. 重新生成并重启 Nginx 配置');
        console.log('   node scripts/generate-nginx-config.js');
        console.log('   [重启 Nginx]');
        console.log('3. 检查 Cloudflare 隧道配置是否正确');
        console.log('4. 尝试手动运行脚本修复路由问题:');
        console.log('   node scripts/fix-tunnel-routing.js');
        
        console.log('\n=============================================');
        console.log('✅ 调试完成');
        console.log('=============================================');
    } catch (error) {
        console.error(`❌ 调试过程出错: ${error.message}`);
        console.error(error.stack);
    }
}

/**
 * 检查端口是否在监听
 * @param {number} port - 要检查的端口
 * @returns {Promise<boolean>} - 端口是否在监听
 */
function checkPort(port) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            host: 'localhost',
            port: port,
            path: '/',
            method: 'HEAD',
            timeout: 2000
        }, () => {
            resolve(true);
        });
        
        req.on('error', (err) => {
            reject(err);
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('请求超时'));
        });
        
        req.end();
    });
}

// 如果直接运行脚本
if (process.argv[2]) {
    const username = process.argv[2];
    debugUserInstance(username).catch(console.error);
} else {
    console.log('请提供用户名作为参数');
    console.log('示例: node scripts/debug-user-instance.js 123456');
}

export { debugUserInstance };
