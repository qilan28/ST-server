/**
 * 自动修复Nginx配置中的网站标题和静态文件404问题
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
 * 修复Nginx配置中的标题和404错误
 */
function fixNginxTitle() {
    try {
        console.log('开始修复Nginx配置中的网站标题和静态文件404问题...');
        
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
        
        // 1. 修复标题替换
        console.log('处理标题替换...');
        
        // 检查配置是否已包含标题替换指令
        const hasTitleFilter = nginxConfig.includes("sub_filter '<title>SillyTavern</title>'");
        
        // 如果已包含标题替换指令，更新标题
        if (hasTitleFilter) {
            console.log('- 更新现有标题替换指令');
            
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
            console.log('- 添加新的标题替换指令');
            
            // 为所有location块添加标题替换指令
            nginxConfig = nginxConfig.replace(
                /(location\s+\/[a-zA-Z0-9_-]+\/st\/\s*\{[^}]*)(proxy_set_header\s+Accept-Encoding\s+"";)/g,
                `$1$2

        # 替换HTML标题
        sub_filter '<title>SillyTavern</title>' '<title>${siteTitle}</title>';
        sub_filter '<title>SillyTavern </title>' '<title>${siteTitle}</title>';
        sub_filter '<title>SillyTavern - ' '<title>${siteTitle} - ';
        sub_filter_types text/html;`
            );
            
            // 确保 sub_filter_once设置为off
            if (nginxConfig.includes('sub_filter_once off') === false) {
                nginxConfig = nginxConfig.replace(
                    /(sub_filter_types[^\n]*)/g,
                    '$1\n        sub_filter_once off;'
                );
            }
        }
        
        // 2. 修复静态文件404问题
        console.log('修复静态文件404问题...');
        
        // 修夏Cookie救援模式 - 增强正则表达式的匹配能力
        console.log('- 加强 Cookie 救援模式');
        // 扩展救援模式中的路径匹配范围，包括 site_settings.js 和其他可能的404文件
        nginxConfig = nginxConfig.replace(
            /location ~ \^\/(api|locales|lib|css|scripts|img|assets|public|data|uploads|fonts|icons|csrf-token|version|node_modules|script\\\.js|thumbnail)/,
            'location ~ ^/(api|locales|lib|css|scripts|img|assets|public|data|uploads|fonts|icons|csrf-token|version|node_modules|script\\.js|thumbnail|favicon.ico|site_settings\.js|site-settings|auto-backup|status)'
        );
        
        // 修夏静态资源专门处理块
        console.log('- 增强静态资源处理');
        // 扩展静态资源模式中的路径匹配范围，增加更多的文件类型
        nginxConfig = nginxConfig.replace(
            /location ~ \^\/(\[a-zA-Z0-9_-\]\+)\/st\/(scripts|css|lib|img|assets|public|data|uploads|locales)\//g,
            'location ~ ^/([a-zA-Z0-9_-]+)/st/(scripts|css|lib|img|assets|public|data|uploads|locales|favicon.ico|site_settings\.js|site-settings|auto-backup|status)/'
        );
        
        // 添加dashboard路径的特殊处理 - 如果不存在
        if (!nginxConfig.includes('/dashboard.html')) {
            console.log('- 添加 dashboard 路径特殊处理');
            // 在location ~ ^/([a-zA-Z0-9_-]+)/st/匹配后插入特殊处理的代码
            nginxConfig = nginxConfig.replace(
                /(# \u7528\u6237\u5b9e\u4f8b\u5b50\u8def\u5f84\u914d\u7f6e[\s\S]*?\{[\s\S]*?)(?=# )/,
                `$1
    # dashboard 特殊处理
    location ~ ^/([a-zA-Z0-9_-]+)/st/dashboard\.html {    
        # 路径重写
        rewrite ^/([a-zA-Z0-9_-]+)/st/dashboard\.html$ /dashboard.html break;
        proxy_pass http://st_$1;
        proxy_http_version 1.1;
        
        # WebSocket 支持
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        
        # 代理头配置
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        
        # 替换HTML标题
        sub_filter '<title>SillyTavern</title>' '<title>${siteTitle}</title>';
        sub_filter '<title>SillyTavern </title>' '<title>${siteTitle}</title>';
        sub_filter '<title>SillyTavern - ' '<title>${siteTitle} - ';
        sub_filter_types text/html;
        sub_filter_once off;
    }
    
`
            );
        }
        
        // 3. 修夏请求参数问题
        console.log('- 修夏带参数的API请求');
        // 增强对带问号参数的请求处理
        nginxConfig = nginxConfig.replace(
            /proxy_cache_bypass \$http_upgrade;/g,
            'proxy_cache_bypass $http_upgrade;\n        # 保留原始请求参数\n        proxy_pass_request_headers on;\n        proxy_pass_request_body on;'
        );
        
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
        console.error('修复Nginx标题和404问题失败:', error);
        return false;
    }
}

// 执行修复
fixNginxTitle();
