import { generateSimpleNginxConfig } from './generate-simple-nginx-config.js';
import { reloadNginx } from '../utils/nginx-reload.js';

/**
 * 修复静态文件404问题
 */
async function fixStaticFiles() {
    try {
        console.log('🔧 开始修复静态文件404问题...');
        
        // 重新生成Nginx配置
        console.log('📝 重新生成Nginx配置...');
        await generateSimpleNginxConfig();
        
        // 强制重载Nginx
        console.log('🔄 重载Nginx配置...');
        const reloadResult = await reloadNginx(null, true);
        
        if (reloadResult.success) {
            console.log(`✅ Nginx重载成功，方法: ${reloadResult.method}`);
            console.log('🎉 静态文件404问题修复完成！');
            console.log('📋 请刷新浏览器页面查看效果');
        } else {
            console.error(`❌ Nginx重载失败: ${reloadResult.error}`);
        }
        
    } catch (error) {
        console.error('❗ 修复过程出错:', error.message);
    }
}

// 直接运行
fixStaticFiles();
