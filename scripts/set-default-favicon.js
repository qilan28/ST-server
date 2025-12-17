/**
 * 设置默认网站图标脚本
 * 将指定的图标路径设置为网站默认图标
 */

import { db } from '../database.js';
import { updateSiteSettings } from '../database-site-settings.js';

// 默认图标路径
const DEFAULT_FAVICON_PATH = '/images/favicon.ico';

// 设置默认图标
function setDefaultFavicon() {
    try {
        console.log('开始设置默认网站图标...');
        console.log(`默认图标路径: ${DEFAULT_FAVICON_PATH}`);

        // 查看当前设置
        try {
            const currentSettings = db.prepare('SELECT * FROM site_settings WHERE id = 1').get();
            if (currentSettings) {
                console.log('当前设置:', {
                    project_name: currentSettings.project_name,
                    site_name: currentSettings.site_name,
                    favicon_path: currentSettings.favicon_path
                });
            } else {
                console.log('未找到站点设置记录');
            }
        } catch (error) {
            console.error('读取当前设置失败:', error);
        }

        // 更新图标路径
        const result = updateSiteSettings(db, null, null, DEFAULT_FAVICON_PATH);
        if (result) {
            console.log('✅ 成功设置默认图标');
            
            // 验证更新
            const updatedSettings = db.prepare('SELECT * FROM site_settings WHERE id = 1').get();
            console.log('更新后设置:', {
                project_name: updatedSettings.project_name,
                site_name: updatedSettings.site_name,
                favicon_path: updatedSettings.favicon_path
            });
            
            return true;
        } else {
            console.error('❌ 设置默认图标失败');
            return false;
        }
    } catch (error) {
        console.error('设置默认图标时出错:', error);
        return false;
    }
}

// 执行函数
const result = setDefaultFavicon();
console.log(`脚本执行${result ? '成功' : '失败'}`);

// 退出进程
process.exit(result ? 0 : 1);
