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

// 完整设置 SillyTavern（clone + install）
export const setupSillyTavern = async (targetDir, version, onProgress) => {
    try {
        // 1. 克隆仓库
        if (onProgress) onProgress(`正在克隆 SillyTavern ${version}...`);
        await cloneSillyTavern(targetDir, version, onProgress);
        
        // 2. 安装依赖
        if (onProgress) onProgress('正在安装依赖，这可能需要几分钟...');
        await installDependencies(targetDir, onProgress);
        
        if (onProgress) onProgress('设置完成！');
        
        return true;
    } catch (error) {
        console.error('Setup failed:', error);
        throw error;
    }
};
