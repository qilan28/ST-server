import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * 检测 SillyTavern 是否已安装并可用
 * @param {string} stDir - SillyTavern 目录路径
 * @returns {Object} 检测结果
 */
export const detectSillyTavernInstallation = (stDir) => {
    const result = {
        exists: false,
        hasServerJs: false,
        hasPackageJson: false,
        hasDependencies: false,
        isValid: false,
        version: null,
        needsSetup: true
    };

    try {
        // 1. 检查目录是否存在
        if (!fs.existsSync(stDir)) {
            return result;
        }
        result.exists = true;

        // 2. 检查关键文件：server.js
        const serverJsPath = path.join(stDir, 'server.js');
        if (!fs.existsSync(serverJsPath)) {
            return result;
        }
        result.hasServerJs = true;

        // 3. 检查 package.json
        const packageJsonPath = path.join(stDir, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
            return result;
        }
        result.hasPackageJson = true;

        // 4. 读取 package.json 验证是否是 SillyTavern
        try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            if (packageJson.name !== 'sillytavern') {
                console.log('Directory is not a SillyTavern installation');
                return result;
            }
            result.version = packageJson.version || 'unknown';
        } catch (error) {
            console.error('Failed to read package.json:', error.message);
            return result;
        }

        // 5. 检查 node_modules 是否存在（依赖是否已安装）
        const nodeModulesPath = path.join(stDir, 'node_modules');
        if (!fs.existsSync(nodeModulesPath)) {
            result.needsSetup = true; // 需要安装依赖
            return result;
        }
        result.hasDependencies = true;

        // 6. 检查关键依赖是否存在
        const criticalDependencies = ['express', 'yaml'];
        let allDepsExist = true;
        for (const dep of criticalDependencies) {
            const depPath = path.join(nodeModulesPath, dep);
            if (!fs.existsSync(depPath)) {
                allDepsExist = false;
                console.log(`Missing critical dependency: ${dep}`);
                break;
            }
        }

        if (!allDepsExist) {
            result.needsSetup = true; // 依赖不完整，需要重新安装
            return result;
        }

        // 7. 所有检查通过
        result.isValid = true;
        result.needsSetup = false;

        return result;
    } catch (error) {
        console.error('Detection error:', error);
        return result;
    }
};

/**
 * 获取 Git 版本信息
 * @param {string} stDir - SillyTavern 目录路径
 * @returns {string|null} Git 分支或标签名
 */
export const getGitVersion = (stDir) => {
    try {
        const gitDir = path.join(stDir, '.git');
        if (!fs.existsSync(gitDir)) {
            return null;
        }

        // 尝试获取当前分支或标签
        const branch = execSync('git rev-parse --abbrev-ref HEAD', {
            cwd: stDir,
            encoding: 'utf-8'
        }).trim();

        if (branch && branch !== 'HEAD') {
            return branch;
        }

        // 如果是 detached HEAD，尝试获取标签
        try {
            const tag = execSync('git describe --tags --exact-match', {
                cwd: stDir,
                encoding: 'utf-8'
            }).trim();
            return tag;
        } catch {
            return 'unknown';
        }
    } catch (error) {
        console.error('Failed to get git version:', error.message);
        return null;
    }
};
