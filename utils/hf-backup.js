import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';
import { Readable } from 'stream';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 压缩目录为 zip 文件
 * @param {string} sourceDir - 源目录路径
 * @param {string} outputPath - 输出的 zip 文件路径
 * @returns {Promise<void>}
 */
export async function compressDirectory(sourceDir, outputPath) {
    return new Promise((resolve, reject) => {
        // 确保输出目录存在
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // 创建输出流
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', {
            zlib: { level: 9 } // 最高压缩级别
        });

        output.on('close', () => {
            console.log(`[HF Backup] 压缩完成: ${archive.pointer()} 字节`);
            resolve();
        });

        archive.on('error', (err) => {
            reject(err);
        });

        archive.pipe(output);
        
        // 添加目录内容到压缩包
        archive.directory(sourceDir, false);
        
        archive.finalize();
    });
}

/**
 * 上传文件到 Hugging Face
 * @param {string} filePath - 要上传的文件路径
 * @param {string} hfToken - Hugging Face token
 * @param {string} hfRepo - Hugging Face 仓库名 (格式: username/repo-name)
 * @param {string} filename - 在仓库中的文件名
 * @returns {Promise<object>} 上传结果
 */
export async function uploadToHuggingFace(filePath, hfToken, hfRepo, filename) {
    let repoPath = null;
    
    try {
        // 验证参数
        if (!fs.existsSync(filePath)) {
            throw new Error(`文件不存在: ${filePath}`);
        }
        
        if (!hfToken || !hfRepo) {
            throw new Error('缺少 Hugging Face Token 或仓库名');
        }

        // 验证仓库名格式
        if (!hfRepo.includes('/')) {
            throw new Error('仓库名格式错误，应为: username/repo-name');
        }

        // 提取用户名和仓库名
        const [hfUser, repoName] = hfRepo.split('/');
        
        // 获取文件大小
        const fileStats = fs.statSync(filePath);
        const fileSize = fileStats.size;
        const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);
        const fileSizeGB = (fileSize / 1024 / 1024 / 1024).toFixed(2);
        
        // 文件大小警告
        if (fileSize > 100 * 1024 * 1024) { // > 100MB
            console.log(`[HF Backup] ⚠️  大文件: ${fileSizeGB} GB`);
        }
        
        console.log(`[HF Backup] 开始上传文件: ${filename} (${fileSizeMB} MB)`);
        
        // 创建临时工作目录
        const workDir = path.join(__dirname, '..', 'temp', 'hf-repo');
        if (!fs.existsSync(workDir)) {
            fs.mkdirSync(workDir, { recursive: true });
        }
        
        repoPath = path.join(workDir, repoName);
        
        // 如果已存在，先删除
        if (fs.existsSync(repoPath)) {
            console.log('[HF Backup] 清理旧仓库...');
            fs.rmSync(repoPath, { recursive: true, force: true });
        }
        
        // 构建带认证的 Git URL
        const gitUrl = `https://${hfUser}:${hfToken}@huggingface.co/datasets/${hfRepo}`;
        
        console.log('[HF Backup] 克隆仓库...');
        try {
            await execAsync(`git clone ${gitUrl} "${repoPath}"`, { 
                timeout: 60000,
                maxBuffer: 10 * 1024 * 1024 
            });
        } catch (cloneError) {
            // 如果克隆失败，可能是空仓库，尝试初始化
            console.log('[HF Backup] 仓库可能为空，尝试初始化...');
            fs.mkdirSync(repoPath, { recursive: true });
            await execAsync(`git init`, { cwd: repoPath });
            await execAsync(`git remote add origin ${gitUrl}`, { cwd: repoPath });
        }
        
        // 配置 Git
        await execAsync(`git config user.email "backup@sillytavern.local"`, { cwd: repoPath });
        await execAsync(`git config user.name "ST Backup"`, { cwd: repoPath });
        
        // 如果文件大于 10MB，配置 Git LFS
        if (fileSize > 10 * 1024 * 1024) {
            console.log('[HF Backup] 配置 Git LFS...');
            try {
                await execAsync('git lfs install', { cwd: repoPath });
                await execAsync('git lfs track "*.zip"', { cwd: repoPath });
                
                // 添加 .gitattributes
                if (fs.existsSync(path.join(repoPath, '.gitattributes'))) {
                    await execAsync('git add .gitattributes', { cwd: repoPath });
                }
            } catch (lfsError) {
                console.log('[HF Backup] Git LFS 未安装，使用常规 Git 上传');
            }
        }
        
        // 复制备份文件到仓库
        console.log('[HF Backup] 复制备份文件...');
        const targetPath = path.join(repoPath, filename);
        fs.copyFileSync(filePath, targetPath);
        
        // Git 操作
        console.log('[HF Backup] 提交更改...');
        await execAsync('git add .', { cwd: repoPath });
        
        try {
            await execAsync(`git commit -m "Backup: ${filename} (${fileSizeMB} MB)"`, { cwd: repoPath });
        } catch (commitError) {
            if (commitError.message.includes('nothing to commit')) {
                console.log('[HF Backup] 没有新的变更需要提交');
                throw new Error('备份文件已存在，无需重复上传');
            }
            throw commitError;
        }
        
        // 推送到远程
        console.log('[HF Backup] 推送到 Hugging Face...');
        try {
            await execAsync('git push origin main', { 
                cwd: repoPath,
                timeout: 300000 // 5分钟超时
            });
        } catch (pushError) {
            // 尝试 master 分支
            try {
                await execAsync('git push origin master', { 
                    cwd: repoPath,
                    timeout: 300000 
                });
            } catch (masterError) {
                throw new Error(`推送失败: ${pushError.message}`);
            }
        }
        
        console.log('[HF Backup] ✅ 上传成功');
        
        // 清理临时仓库
        if (fs.existsSync(repoPath)) {
            fs.rmSync(repoPath, { recursive: true, force: true });
        }
        
        // 构建文件URL
        const fileUrl = `https://huggingface.co/datasets/${hfRepo}/blob/main/${filename}`;
        
        return {
            success: true,
            url: fileUrl,
            size: fileSize,
            uploadMethod: fileSize > 10 * 1024 * 1024 ? 'Git LFS' : 'Git'
        };
    } catch (error) {
        console.error('[HF Backup] ❌ 上传失败:', error);
        
        // 清理临时仓库
        if (repoPath && fs.existsSync(repoPath)) {
            try {
                fs.rmSync(repoPath, { recursive: true, force: true });
            } catch (cleanupError) {
                console.error('[HF Backup] 清理临时文件失败:', cleanupError);
            }
        }
        
        // 提供更友好的错误信息
        const errorMsg = error.message || String(error);
        if (errorMsg.includes('401') || errorMsg.includes('Authentication failed')) {
            throw new Error('Token 无效或已过期，请检查您的 Hugging Face Token');
        } else if (errorMsg.includes('404') || errorMsg.includes('not found')) {
            throw new Error('仓库不存在，请先在 Hugging Face 创建 Dataset 仓库');
        } else if (errorMsg.includes('timeout')) {
            throw new Error('上传超时，文件可能太大或网络不稳定');
        }
        
        throw error;
    }
}

/**
 * 备份用户数据到 Hugging Face
 * @param {string} dataDir - 用户数据目录 (st-data)
 * @param {string} username - 用户名
 * @param {string} hfToken - Hugging Face token
 * @param {string} hfRepo - Hugging Face 仓库名
 * @returns {Promise<object>} 备份结果
 */
export async function backupToHuggingFace(dataDir, username, hfToken, hfRepo) {
    try {
        console.log('[HF Backup] 开始备份流程...');
        console.log(`[HF Backup] 数据目录: ${dataDir}`);
        
        // 验证数据目录是否存在
        if (!fs.existsSync(dataDir)) {
            throw new Error(`数据目录不存在: ${dataDir}`);
        }

        // 创建临时目录
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // 生成备份文件名（包含时间戳）
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const time = new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('-')[0];
        const backupFilename = `${username}_backup_${timestamp}_${time}.zip`;
        const tempZipPath = path.join(tempDir, backupFilename);

        // 压缩数据目录
        console.log('[HF Backup] 正在压缩数据目录...');
        await compressDirectory(dataDir, tempZipPath);

        // 获取文件大小
        const fileSize = fs.statSync(tempZipPath).size;
        const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);
        const fileSizeGB = (fileSize / 1024 / 1024 / 1024).toFixed(2);
        
        console.log(`[HF Backup] 压缩包大小: ${fileSizeMB} MB`);
        
        // 大文件警告
        if (fileSize > 5 * 1024 * 1024 * 1024) { // > 5GB
            console.warn(`[HF Backup] ⚠️  警告: 文件非常大 (${fileSizeGB} GB)，上传可能需要较长时间`);
        } else if (fileSize > 1 * 1024 * 1024 * 1024) { // > 1GB
            console.log(`[HF Backup] ℹ️  文件较大 (${fileSizeGB} GB)，上传可能需要几分钟`);
        }

        // 上传到 Hugging Face
        console.log('[HF Backup] 正在上传到 Hugging Face...');
        const uploadResult = await uploadToHuggingFace(
            tempZipPath,
            hfToken,
            hfRepo,
            backupFilename
        );

        // 清理临时文件
        console.log('[HF Backup] 清理临时文件...');
        fs.unlinkSync(tempZipPath);

        console.log('[HF Backup] ✅ 备份完成！');
        
        return {
            success: true,
            filename: backupFilename,
            size: fileSize,
            url: uploadResult.url,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('[HF Backup] ❌ 备份失败:', error);
        throw error;
    }
}

/**
 * 测试 Hugging Face 连接
 * @param {string} hfToken - Hugging Face token
 * @param {string} hfRepo - Hugging Face 仓库名
 * @returns {Promise<object>} 测试结果
 */
export async function testHuggingFaceConnection(hfToken, hfRepo) {
    try {
        console.log('[HF Backup] 测试 Hugging Face 连接...');
        
        // 验证仓库名格式
        if (!hfRepo.includes('/')) {
            throw new Error('仓库名格式错误，应为: username/repo-name');
        }

        // 测试 API 访问
        const url = `https://huggingface.co/api/datasets/${hfRepo}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${hfToken}`
            }
        });

        if (response.status === 404) {
            return {
                success: false,
                message: '仓库不存在或无权访问。请确认仓库名正确且 Token 有效。'
            };
        }

        if (!response.ok) {
            const errorText = await response.text();
            return {
                success: false,
                message: `连接失败 (${response.status}): ${errorText}`
            };
        }

        const repoInfo = await response.json();
        
        console.log('[HF Backup] ✅ 连接测试成功');
        
        return {
            success: true,
            message: '连接成功！',
            repoInfo: {
                id: repoInfo.id,
                author: repoInfo.author,
                name: repoInfo.name || repoInfo.id?.split('/')[1],
                private: repoInfo.private
            }
        };
    } catch (error) {
        console.error('[HF Backup] ❌ 连接测试失败:', error);
        return {
            success: false,
            message: `连接测试失败: ${error.message}`
        };
    }
}
