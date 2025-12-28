import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execPromise = promisify(exec);

const REPO_URL = 'https://github.com/SillyTavern/SillyTavern.git';

// 检查 Node.js 版本是否满足要求
const checkNodeVersion = () => {
    const requiredVersion = '20.11.0';
    const currentVersion = process.versions.node;
    
    const [reqMajor, reqMinor, reqPatch] = requiredVersion.split('.').map(Number);
    const [curMajor, curMinor, curPatch] = currentVersion.split('.').map(Number);
    
    if (curMajor < reqMajor || 
        (curMajor === reqMajor && curMinor < reqMinor) ||
        (curMajor === reqMajor && curMinor === reqMinor && curPatch < reqPatch)) {
        return {
            isValid: false,
            current: currentVersion,
            required: requiredVersion
        };
    }
    
    return {
        isValid: true,
        current: currentVersion,
        required: requiredVersion
    };
};

// 检查 git 是否可用
export const checkGitAvailable = async () => {
    try {
        await execPromise('git --version');
        return true;
    } catch (error) {
        return false;
    }
};

// Clone SillyTavern 仓库到指定目录
export const cloneSillyTavern = async (targetDir, version, onProgress) => {
    try {
        // 确保目标目录不存在
        if (fs.existsSync(targetDir)) {
            throw new Error(`Directory already exists: ${targetDir}`);
        }
        
        // 创建父目录
        const parentDir = path.dirname(targetDir);
        if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
        }
        
        if (onProgress) onProgress('开始克隆仓库...');
        
        // Clone 仓库（浅克隆以节省空间和时间）
        const cloneCmd = `git clone --depth 1 --branch ${version} ${REPO_URL} "${targetDir}"`;
        
        await execPromise(cloneCmd, { 
            maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        });
        
        if (onProgress) onProgress('克隆完成');
        
        return true;
    } catch (error) {
        console.error('Clone failed:', error);
        
        // 清理失败的克隆
        if (fs.existsSync(targetDir)) {
            try {
                fs.rmSync(targetDir, { recursive: true, force: true });
            } catch (cleanupError) {
                console.error('Cleanup failed:', cleanupError);
            }
        }
        
        throw new Error(`Failed to clone SillyTavern: ${error.message}`);
    }
};

// 更新已存在的 SillyTavern（拉取最新代码）
export const updateSillyTavern = async (stDir, onProgress) => {
    try {
        if (!fs.existsSync(stDir)) {
            throw new Error(`Directory does not exist: ${stDir}`);
        }
        
        if (onProgress) onProgress('开始更新...');
        
        // 拉取最新代码
        await execPromise('git pull', { 
            cwd: stDir,
            maxBuffer: 10 * 1024 * 1024
        });
        
        if (onProgress) onProgress('更新完成');
        
        return true;
    } catch (error) {
        console.error('Update failed:', error);
        throw new Error(`Failed to update SillyTavern: ${error.message}`);
    }
};

// 切换到指定版本
export const checkoutVersion = async (stDir, version, onProgress) => {
    try {
        if (!fs.existsSync(stDir)) {
            throw new Error(`Directory does not exist: ${stDir}`);
        }
        
        if (onProgress) onProgress(`切换到版本 ${version}...`);
        
        // Fetch 所有标签和分支
        await execPromise('git fetch --all --tags', { 
            cwd: stDir,
            maxBuffer: 10 * 1024 * 1024
        });
        
        // Checkout 到指定版本
        await execPromise(`git checkout ${version}`, { 
            cwd: stDir 
        });
        
        if (onProgress) onProgress('版本切换完成');
        
        return true;
    } catch (error) {
        console.error('Checkout failed:', error);
        throw new Error(`Failed to checkout version ${version}: ${error.message}`);
    }
};

// 获取当前版本
export const getCurrentVersion = async (stDir) => {
    try {
        if (!fs.existsSync(stDir)) {
            return null;
        }
        
        const { stdout } = await execPromise('git describe --tags --always', { 
            cwd: stDir 
        });
        
        return stdout.trim();
    } catch (error) {
        console.error('Failed to get current version:', error);
        return null;
    }
};

// 检查是否是 git 仓库
export const isGitRepository = (stDir) => {
    const gitDir = path.join(stDir, '.git');
    return fs.existsSync(gitDir);
};

// 安装 npm 依赖
export const installDependencies = async (stDir, onProgress) => {
    try {
        if (!fs.existsSync(stDir)) {
            throw new Error(`Directory does not exist: ${stDir}`);
        }
        
        // 检查 Node.js 版本
        const versionCheck = checkNodeVersion();
        if (!versionCheck.isValid) {
            const errorMsg = `Node.js 版本过低！\n` +
                `当前版本: v${versionCheck.current}\n` +
                `需要版本: v${versionCheck.required} 或更高\n\n` +
                `SillyTavern 需要 Node.js v20.11.0 或更高版本。\n` +
                `请参考 NODEJS-UPGRADE.md 文件升级 Node.js。\n\n` +
                `快速升级方法：\n` +
                `1. 使用 NVM: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash && nvm install 20\n` +
                `2. 或访问: https://nodejs.org/`;
            
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
        
        if (onProgress) onProgress('安装依赖...');
        
        // 使用 npm install
        await execPromise('npm install --production', { 
            cwd: stDir,
            maxBuffer: 20 * 1024 * 1024  // 20MB buffer for npm output
        });
        
        if (onProgress) onProgress('依赖安装完成');
        
        return true;
    } catch (error) {
        console.error('Install dependencies failed:', error);
        throw new Error(`Failed to install dependencies: ${error.message}`);
    }
};

// 完整设置 SillyTavern（clone + install + custom title）
export const setupSillyTavern = async (targetDir, version, onProgress) => {
    try {
        // 1. 克隆仓库
        if (onProgress) onProgress(`正在克隆 SillyTavern ${version}...`);
        await cloneSillyTavern(targetDir, version, onProgress);
        
        // 2. 安装依赖
        if (onProgress) onProgress('正在安装依赖，这可能需要几分钟...');
        await installDependencies(targetDir, onProgress);
        
        // 3. 自定义网站标题
        try {
            // 从数据库获取网站设置（通过动态导入，避免循环依赖）
            const { db } = await import('./database.js');
            const { getSiteSettings } = await import('./database-site-settings.js');
            
            // 获取站点名称
            const settings = getSiteSettings(db);
            const siteName = settings && settings.site_name ? settings.site_name : '【管理员后台设置网站名称】';
            
            if (onProgress) onProgress(`正在更新网站标题为: ${siteName}`);
            
            // 替换标题
            await replaceSillyTavernTitle(targetDir, siteName);
        } catch (titleError) {
            console.error('更新网站标题失败:', titleError);
            // 继续运行，不影响整体安装
        }
        
        if (onProgress) onProgress('设置完成！');
        
        return true;
    } catch (error) {
        console.error('Setup failed:', error);
        throw error;
    }
};

// 删除 SillyTavern 目录
export const deleteSillyTavern = async (stDir) => {
    try {
        if (!fs.existsSync(stDir)) {
            return true; // 目录不存在，认为删除成功
        }
        
        // 删除整个目录
        fs.rmSync(stDir, { recursive: true, force: true });
        
        return true;
    } catch (error) {
        console.error('Delete SillyTavern failed:', error);
        throw new Error(`Failed to delete SillyTavern: ${error.message}`);
    }
};

// 检查依赖是否已安装
// 替换SillyTavern的标题
export const replaceSillyTavernTitle = async (stDir, title) => {
    try {
        let success = false;
        const publicDir = path.join(stDir, 'public');
        
        // 检查 public 目录是否存在
        if (!fs.existsSync(publicDir)) {
            console.warn(`[Title] public 目录不存在: ${publicDir}`);
            return false;
        }
        
        // 处理 login.html
        const loginHtmlPath = path.join(publicDir, 'login.html');
        if (fs.existsSync(loginHtmlPath)) {
            success = replaceFileTitle(loginHtmlPath, title) || success;
        } else {
            console.warn(`[Title] login.html 文件不存在: ${loginHtmlPath}`);
        }
        
        // 处理 index.html
        const indexHtmlPath = path.join(publicDir, 'index.html');
        if (fs.existsSync(indexHtmlPath)) {
            success = replaceFileTitle(indexHtmlPath, title) || success;
        } else {
            console.warn(`[Title] index.html 文件不存在: ${indexHtmlPath}`);
        }
        
        return success;
    } catch (error) {
        console.error('[Title] 替换标题失败:', error);
        return false;
    }
};

// 帮助函数：替换单个文件的标题
function replaceFileTitle(filePath, title) {
    try {
        // 读取文件内容
        let content = fs.readFileSync(filePath, 'utf8');
        const fileName = path.basename(filePath);
        
        // 替换标题
        const originalTitleRegex = /<title>SillyTavern<\/title>/;
        
        if (!originalTitleRegex.test(content)) {
            // 尝试更宽松的标题模式
            const looseRegex = /<title>([^<]+)<\/title>/;
            if (looseRegex.test(content)) {
                content = content.replace(looseRegex, `<title>${title}</title>`);
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`[Title] 已替换 ${fileName} 的标题为: ${title}`);
                return true;
            } else {
                console.warn(`[Title] 未在 ${fileName} 中找到匹配的标题标签`);
                return false;
            }
        }
        
        // 使用配置的站点名称替换标题
        const newContent = content.replace(originalTitleRegex, `<title>${title}</title>`);
        
        // 写入文件
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`[Title] 已替换 ${fileName} 的标题为: ${title}`);
        
        return true;
    } catch (error) {
        console.error(`[Title] 替换 ${path.basename(filePath)} 标题失败:`, error);
        return false;
    }
}

export const checkDependenciesInstalled = (stDir) => {
    try {
        if (!fs.existsSync(stDir)) {
            return { installed: false, reason: 'Directory does not exist' };
        }
        
        const nodeModulesPath = path.join(stDir, 'node_modules');
        const packageJsonPath = path.join(stDir, 'package.json');
        
        if (!fs.existsSync(packageJsonPath)) {
            return { installed: false, reason: 'package.json not found' };
        }
        
        if (!fs.existsSync(nodeModulesPath)) {
            return { installed: false, reason: 'node_modules not found' };
        }
        
        // 检查 node_modules 是否为空
        const files = fs.readdirSync(nodeModulesPath);
        if (files.length === 0) {
            return { installed: false, reason: 'node_modules is empty' };
        }
        
        return { installed: true, reason: 'Dependencies are installed' };
    } catch (error) {
        console.error('Check dependencies failed:', error);
        return { installed: false, reason: error.message };
    }
};
