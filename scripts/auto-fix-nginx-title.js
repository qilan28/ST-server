/**
 * 自动修复Nginx配置中的网站标题
 * 在服务器启动时运行
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 读取站点设置获取标题
 * @returns {string} 站点标题
 */
function getSiteTitle() {
    try {
        // 尝试从站点设置文件获取标题
        const settingsPath = path.join(__dirname, '../data/site_settings.json');
        if (fs.existsSync(settingsPath)) {
            const settingsContent = fs.readFileSync(settingsPath, 'utf8');
            const settings = JSON.parse(settingsContent);
            if (settings && settings.settings && settings.settings.site_name) {
                return settings.settings.site_name;
            }
        }
        
        // 如果找不到设置文件或没有站点名称，使用默认值
        return '公益云酒馆多开管理平台';
    } catch (error) {
        console.error('获取站点标题失败:', error);
        return '公益云酒馆多开管理平台';
    }
}

/**
 * 修复Nginx配置中的标题
 */
function fixNginxTitle() {
    try {
        console.log('开始修复Nginx配置中的网站标题...');
        
        // 获取站点标题
        const siteTitle = getSiteTitle();
        console.log(`当前站点标题: ${siteTitle}`);
        
        // Nginx配置文件路径
        const nginxConfigPath = path.join(__dirname, '../nginx/nginx.conf');
        
        // 检查配置文件是否存在
        if (!fs.existsSync(nginxConfigPath)) {
            console.error('错误: Nginx配置文件不存在，请先生成配置文件');
            return false;
        }
        
        // 读取配置文件
        let nginxConfig = fs.readFileSync(nginxConfigPath, 'utf8');
        
        // 检查配置是否已包含标题替换指令
        const hasTitleFilter = nginxConfig.includes("sub_filter '<title>SillyTavern</title>'");
        
        // 如果已包含标题替换指令，更新标题
        if (hasTitleFilter) {
            console.log('配置文件中已有标题替换指令，更新标题值...');
            
            // 更新标题值
            nginxConfig = nginxConfig.replace(
                /sub_filter '<title>SillyTavern<\/title>' '<title>[^<]*<\/title>'/g, 
                `sub_filter '<title>SillyTavern</title>' '<title>${siteTitle}</title>'`
            );
            
            nginxConfig = nginxConfig.replace(
                /sub_filter '<title>SillyTavern <\/title>' '<title>[^<]*<\/title>'/g, 
                `sub_filter '<title>SillyTavern </title>' '<title>${siteTitle}</title>'`
            );
            
            nginxConfig = nginxConfig.replace(
                /sub_filter '<title>SillyTavern - ' '<title>[^<]* - '/g, 
                `sub_filter '<title>SillyTavern - ' '<title>${siteTitle} - '`
            );
        } 
        // 否则，为每个location块添加标题替换指令
        else {
            console.log('添加标题替换指令到配置文件...');
            
            // 为所有location块添加标题替换指令
            nginxConfig = nginxConfig.replace(
                /(location\s+\/[a-zA-Z0-9_-]+\/st\/\s*\{[^}]*)(proxy_set_header\s+Accept-Encoding\s+"";)/g,
                `$1$2\n
        # 替换HTML标题
        sub_filter '<title>SillyTavern</title>' '<title>${siteTitle}</title>';
        sub_filter '<title>SillyTavern </title>' '<title>${siteTitle}</title>';
        sub_filter '<title>SillyTavern - ' '<title>${siteTitle} - ';
        sub_filter_types text/html;`
            );
            
            // 确保sub_filter_once设置为off
            if (nginxConfig.includes('sub_filter_once off') === false) {
                nginxConfig = nginxConfig.replace(
                    /(sub_filter_types[^\n]*)/g,
                    '$1\n        sub_filter_once off;'
                );
            }
        }
        
        // 写回配置文件
        fs.writeFileSync(nginxConfigPath, nginxConfig, 'utf8');
        console.log('✅ 成功更新Nginx配置文件');
        
        // 尝试重载Nginx配置
        try {
            const isWindows = process.platform === 'win32';
            if (!isWindows) {
                console.log('尝试重载Nginx配置...');
                execSync('nginx -t', { stdio: 'pipe' });
                execSync('nginx -s reload', { stdio: 'pipe' });
                console.log('✅ Nginx配置重载成功');
            } else {
                console.log('Windows环境下，请手动重启Nginx');
            }
        } catch (error) {
            console.error('重载Nginx配置失败:', error.message);
            console.log('请手动验证Nginx配置并重启服务');
        }
        
        return true;
    } catch (error) {
        console.error('修复Nginx标题失败:', error);
        return false;
    }
}

// 执行修复
fixNginxTitle();
