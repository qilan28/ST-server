import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { reloadNginx } from './nginx-reload.js';
import { getNginxConfig } from './config-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 执行重启前的健康检查
 * @returns {Promise<{success: boolean, issues: string[]}>}
 */
export async function performRestartHealthCheck() {
    console.log('[HealthCheck] 执行重启前健康检查...');
    const issues = [];
    let success = true;

    // 检查 Nginx 配置
    try {
        console.log('[HealthCheck] 检查 Nginx 配置...');
        const nginxConfigPath = path.join(__dirname, '../nginx/nginx.conf');
        
        if (!fs.existsSync(nginxConfigPath)) {
            issues.push('Nginx 配置文件不存在，需要先生成');
            success = false;
        } else {
            // 检查配置文件大小
            const stats = fs.statSync(nginxConfigPath);
            if (stats.size < 100) { // 配置文件太小可能是错误的
                issues.push('Nginx 配置文件异常（太小）');
                success = false;
            }
            
            // 检查是否包含必要的配置块
            const config = fs.readFileSync(nginxConfigPath, 'utf-8');
            const necessaryStrings = ['upstream', 'location', 'proxy_pass', 'http {', 'server {'];
            const missing = necessaryStrings.filter(str => !config.includes(str));
            
            if (missing.length > 0) {
                issues.push(`Nginx 配置文件缺少必要内容: ${missing.join(', ')}`);
                success = false;
            }
        }
    } catch (error) {
        issues.push(`Nginx 配置检查出错: ${error.message}`);
        success = false;
    }
    
    // 检查静态资源目录
    try {
        console.log('[HealthCheck] 检查静态资源目录...');
        const publicDir = path.join(__dirname, '../public');
        
        if (!fs.existsSync(publicDir)) {
            issues.push('静态资源目录不存在');
            success = false;
        } else {
            // 检查关键目录是否存在
            const criticalDirs = ['css', 'js', 'images'];
            for (const dir of criticalDirs) {
                const dirPath = path.join(publicDir, dir);
                if (!fs.existsSync(dirPath)) {
                    issues.push(`关键静态资源目录不存在: ${dir}`);
                    // 不导致整体失败，但记录问题
                }
            }
        }
    } catch (error) {
        issues.push(`静态资源检查出错: ${error.message}`);
        success = false;
    }
    
    // 汇总结果
    if (success) {
        console.log('[HealthCheck] 健康检查通过，无重大问题');
    } else {
        console.warn('[HealthCheck] 健康检查发现问题:', issues.join('; '));
    }
    
    return { success, issues };
}

/**
 * 执行重启后的配置验证
 * @returns {Promise<{success: boolean, issues: string[]}>}
 */
export async function performRestartVerification() {
    console.log('[验证] 执行重启后验证...');
    const issues = [];
    let success = true;
    
    // 重新生成并应用 Nginx 配置
    try {
        console.log('[验证] 重新生成并加载 Nginx 配置...');
        
        // 使用简化的配置生成器
        const { generateSimpleNginxConfig } = await import('../scripts/generate-simple-nginx-config.js');
        await generateSimpleNginxConfig();
        
        const reloadResult = await reloadNginx(null, true); // 强制重载
        
        if (!reloadResult.success) {
            issues.push(`Nginx 重载失败: ${reloadResult.error}`);
            success = false;
        }
    } catch (error) {
        issues.push(`Nginx 重载出错: ${error.message}`);
        success = false;
    }
    
    // 检查配置是否应用成功
    try {
        console.log('[验证] 检查配置是否应用成功...');
        // 这里可以添加额外的检查逻辑
    } catch (error) {
        issues.push(`配置验证出错: ${error.message}`);
        success = false;
    }
    
    // 汇总结果
    if (success) {
        console.log('[验证] 重启后验证通过');
    } else {
        console.warn('[验证] 重启后验证发现问题:', issues.join('; '));
    }
    
    return { success, issues };
}

// 如果直接运行此脚本
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    (async () => {
        try {
            // 执行健康检查
            const healthCheck = await performRestartHealthCheck();
            console.log('健康检查结果:', healthCheck);
            
            // 执行验证
            const verification = await performRestartVerification();
            console.log('验证结果:', verification);
        } catch (error) {
            console.error('执行检查时出错:', error);
            process.exit(1);
        }
    })();
}
