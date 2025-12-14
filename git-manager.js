import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execPromise = promisify(exec);

const REPO_URL = 'https://github.com/SillyTavern/SillyTavern.git';

// 兼容旧版本 Node.js 的递归删除目录函数
const removeDirectory = (dirPath) => {
    if (!fs.existsSync(dirPath)) return;
    
    // 如果有 rmSync (Node.js 14.14.0+)，使用它
    if (fs.rmSync) {
        fs.rmSync(dirPath, { recursive: true, force: true });
        return;
    }
    
    // 否则使用旧的方法
    const removeRecursive = (dir) => {
        if (fs.existsSync(dir)) {
            fs.readdirSync(dir).forEach((file) => {
                const curPath = path.join(dir, file);
                if (fs.lstatSync(curPath).isDirectory()) {
                    removeRecursive(curPath);
                } else {
                    fs.unlinkSync(curPath);
                }
            });
            fs.rmdirSync(dir);
        }
    };
    
    removeRecursive(dirPath);
};

// 检查 Node.js 版本
export const checkNodeVersion = () => {
    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0]);
    
    // SillyTavern 需要 Node.js 18+
    const required = 18;
    
    return {
        current: version,
        major: major,
        required: required,
        isCompatible: major >= required
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
        // 如果目标目录已存在，先删除（处理之前失败的安装）
        if (fs.existsSync(targetDir)) {
            if (onProgress) onProgress('清理旧目录...');
            try {
                removeDirectory(targetDir);
            } catch (cleanupError) {
                console.error('Cleanup old directory failed:', cleanupError);
                throw new Error(`无法删除旧目录: ${cleanupError.message}`);
            }
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
                removeDirectory(targetDir);
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

// 安装 npm 依赖（带重试机制）
export const installDependencies = async (stDir, onProgress) => {
    const maxRetries = 3;
    let lastError;
    
    if (!fs.existsSync(stDir)) {
        throw new Error(`Directory does not exist: ${stDir}`);
    }
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            if (onProgress) {
                if (attempt > 1) {
                    onProgress(`重试安装依赖 (${attempt}/${maxRetries})...`);
                } else {
                    onProgress('安装依赖...');
                }
            }
            
            // 使用 --omit=dev 替代 --production
            // 如果配置了 NPM 镜像源，使用它
            const registry = process.env.NPM_REGISTRY 
                ? `--registry=${process.env.NPM_REGISTRY}` 
                : '';
            
            const installCommand = `npm install --omit=dev ${registry}`.trim();
            
            await execPromise(installCommand, { 
                cwd: stDir,
                maxBuffer: 50 * 1024 * 1024,  // 50MB buffer for npm output
                timeout: 600000  // 10分钟超时
            });
            
            if (onProgress) onProgress('依赖安装完成');
            
            return true;
        } catch (error) {
            lastError = error;
            console.error(`Install dependencies failed (attempt ${attempt}/${maxRetries}):`, error.message);
            
            // 如果不是最后一次尝试，等待后重试
            if (attempt < maxRetries) {
                const waitTime = attempt * 2000; // 递增等待时间：2秒, 4秒
                if (onProgress) onProgress(`安装失败，${waitTime/1000}秒后重试...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }
    
    // 所有重试都失败
    throw new Error(`安装依赖失败（已重试${maxRetries}次）: ${lastError.message}`);
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
