/**
 * 使用修复版Nginx配置文件
 * 解决API请求404问题和MIME类型错误
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 使用修复版配置文件
 */
function useFixedNginxConfig() {
    try {
        console.log('[Nginx修复] 开始应用修复版配置文件...');
        
        // 配置文件路径
        const fixedConfigPath = path.join(__dirname, '../nginx/nginx-fixed.conf');
        const targetConfigPath = path.join(__dirname, '../nginx/nginx.conf');
        
        // 检查修复版配置文件是否存在
        if (!fs.existsSync(fixedConfigPath)) {
            console.error('[Nginx修复] 错误: 修复版配置文件不存在');
            return false;
        }
        
        // 如果目标文件已存在，先备份
        if (fs.existsSync(targetConfigPath)) {
            const backupPath = `${targetConfigPath}.bak-${Date.now()}`;
            fs.copyFileSync(targetConfigPath, backupPath);
            console.log(`[Nginx修复] 已备份原配置到: ${backupPath}`);
        }
        
        // 复制修复版配置到目标位置
        fs.copyFileSync(fixedConfigPath, targetConfigPath);
        console.log(`[Nginx修复] 配置文件已更新: ${targetConfigPath}`);
        
        // 尝试重载Nginx配置
        try {
            const isWindows = process.platform === 'win32';
            if (!isWindows) {
                console.log('[Nginx修复] 尝试测试Nginx配置...');
                execSync('nginx -t', { stdio: 'pipe' });
                console.log('[Nginx修复] Nginx配置测试通过');
                
                console.log('[Nginx修复] 尝试重载Nginx配置...');
                execSync('nginx -s reload', { stdio: 'pipe' });
                console.log('[Nginx修复] ✅ Nginx配置重载成功');
            } else {
                console.log('[Nginx修复] Windows环境，请手动重启Nginx');
            }
        } catch (error) {
            console.error('[Nginx修复] 重载Nginx配置失败:', error.message);
            console.error('[Nginx修复] 请手动验证配置并重启Nginx');
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('[Nginx修复] 错误:', error);
        return false;
    }
}

// 如果直接运行此文件，执行修复
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const result = useFixedNginxConfig();
    if (result) {
        console.log('[Nginx修复] 修复完成');
        process.exit(0);
    } else {
        console.error('[Nginx修复] 修复失败');
        process.exit(1);
    }
}

export default useFixedNginxConfig;
