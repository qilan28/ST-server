import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';
import { Readable } from 'stream';
import { exec } from 'child_process';
import { promisify } from 'util';
import { pipeline } from 'stream/promises';
import extract from 'extract-zip';

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
export async function uploadToHuggingFace(filePath, hfToken, hfRepo, filename, username, hfEmail, logCallback = null) {
    let repoPath = null;
    const log = (msg, type = 'info') => {
        console.log(`[HF Backup] ${msg}`);
        if (logCallback) logCallback(msg, type);
    };
    
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
        
        log(`📤 开始上传文件: ${filename} (${fileSizeMB} MB)`);
        
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
        
        log('📥 克隆仓库...');
        try {
            await execAsync(`git clone ${gitUrl} "${repoPath}"`, { 
                timeout: 60000,
                maxBuffer: 10 * 1024 * 1024 
            });
        } catch (cloneError) {
            // 如果克隆失败，可能是空仓库，尝试初始化
            log('🔧 仓库为空，初始化...');
            fs.mkdirSync(repoPath, { recursive: true });
            await execAsync(`git init`, { cwd: repoPath });
            await execAsync(`git remote add origin ${gitUrl}`, { cwd: repoPath });
        }
        
        // 配置 Git 用户信息（使用用户配置的邮箱）
        const gitEmail = hfEmail || 'backup@sillytavern.local';
        const gitName = username || 'ST-Backup-Bot';
        await execAsync(`git config user.email "${gitEmail}"`, { cwd: repoPath });
        await execAsync(`git config user.name "${gitName}"`, { cwd: repoPath });
        
        // 管理备份文件（删除旧文件）
        log('🔍 检查并管理现有备份文件...');
        const filesToDelete = manageBackupFiles(repoPath, logCallback);
        
        // 双重删除：本地 Git + HF API（确保彻底清理）
        if (filesToDelete.length > 0) {
            log(`🧹 准备清理 ${filesToDelete.length} 个旧备份...`);
            
            // 1. 先删除本地仓库中的文件
            for (const fileToDelete of filesToDelete) {
                const filePath = path.join(repoPath, fileToDelete);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    log(`🗑️ 本地删除: ${fileToDelete}`);
                }
            }
            
            // 2. 提交本地删除到 Git
            log('💬 提交删除操作到 Git...');
            await execAsync('git add -A', { cwd: repoPath });
            try {
                await execAsync(`git commit -m "清理旧备份文件"`, { cwd: repoPath });
            } catch (commitError) {
                // 忽略 "nothing to commit" 错误
                const stdout = commitError.stdout || '';
                if (!stdout.includes('nothing to commit')) {
                    log('⚠️ Git commit 失败，继续执行...', 'warning');
                }
            }
            
            // 3. 先拉取远程更新，再推送（避免冲突）
            log('🔄 同步远程更新...');
            try {
                await execAsync('git pull origin main --rebase', { cwd: repoPath });
            } catch (pullError) {
                try {
                    await execAsync('git pull origin master --rebase', { cwd: repoPath });
                } catch (masterPullError) {
                    log('⚠️ 拉取远程更新失败，尝试强制推送...', 'warning');
                }
            }
            
            // 4. 推送删除到远程
            log('🚀 推送删除到远程...');
            try {
                await execAsync('git push origin main', { cwd: repoPath });
            } catch (pushError) {
                try {
                    await execAsync('git push origin master', { cwd: repoPath });
                } catch (masterError) {
                    log('⚠️ 推送删除失败，继续执行...', 'warning');
                }
            }
            
            // 4. 使用 HF API 再次确保删除（双保险，防止文件留在 Git 历史）
            log('🔥 通过 API 确保彻底删除...');
            for (const fileToDelete of filesToDelete) {
                await deleteFileViaAPI(hfToken, hfRepo, fileToDelete, logCallback);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        // 如果文件大于 10MB，配置 Git LFS
        if (fileSize > 10 * 1024 * 1024) {
            log('💾 配置 Git LFS（大文件支持）...');
            try {
                await execAsync('git lfs install', { cwd: repoPath });
                await execAsync('git lfs track "*.zip"', { cwd: repoPath });
                
                // 添加 .gitattributes
                if (fs.existsSync(path.join(repoPath, '.gitattributes'))) {
                    await execAsync('git add .gitattributes', { cwd: repoPath });
                }
            } catch (lfsError) {
                log('⚠️ Git LFS 未安装，使用常规 Git 上传', 'warning');
            }
        }
        
        // 复制备份文件到仓库（如果已存在则覆盖）
        log('📋 复制备份文件到仓库...');
        const targetPath = path.join(repoPath, filename);
        
        // 如果文件已存在，先删除（处理重复备份）
        if (fs.existsSync(targetPath)) {
            log('🗑️ 删除旧文件...');
            fs.unlinkSync(targetPath);
        }
        
        fs.copyFileSync(filePath, targetPath);
        
        // Git 操作
        log('💬 提交更改到 Git...');
        await execAsync('git add .', { cwd: repoPath });
        
        // 生成 commit 信息：用户名-备份时间（大小）（中国时区）
        const commitDate = new Date().toLocaleString('zh-CN', {
            timeZone: 'Asia/Shanghai',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).replace(/\//g, '-').replace(',', '');
        const commitMessage = `${username}-${commitDate} (${fileSizeMB} MB)`;
        
        try {
            await execAsync(`git commit -m "${commitMessage}"`, { cwd: repoPath });
        } catch (commitError) {
            // 检查是否是 "没有变更" 错误
            const stdout = commitError.stdout || '';
            if (stdout.includes('nothing to commit') || stdout.includes('working tree clean')) {
                log('⚠️ 没有新的变更（文件已存在且内容相同）', 'warning');
                
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
                    message: '备份文件已存在，无需重复上传',
                    skipped: true
                };
            }
            throw commitError;
        }
        
        // 先拉取远程更新，避免推送冲突
        log('🔄 同步远程更新...');
        try {
            await execAsync('git pull origin main --rebase', { 
                cwd: repoPath,
                timeout: 60000 
            });
        } catch (pullError) {
            try {
                await execAsync('git pull origin master --rebase', { 
                    cwd: repoPath,
                    timeout: 60000 
                });
            } catch (masterPullError) {
                log('⚠️ 拉取远程更新失败，尝试直接推送...', 'warning');
            }
        }
        
        // 推送到远程
        log('🚀 推送到 Hugging Face...');
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
        
        log('✅ 上传成功', 'success');
        
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
 * 列出 Hugging Face 仓库中的备份文件
 * @param {string} repoPath - 仓库本地路径
 * @returns {Array<{filename: string, timestamp: number, date: string}>} 备份文件列表
 */
function listBackupFiles(repoPath) {
    try {
        if (!fs.existsSync(repoPath)) {
            return [];
        }
        
        const files = fs.readdirSync(repoPath);
        const backupFiles = files
            .filter(f => f.endsWith('.zip') && /^\d+\.zip$/.test(f))
            .map(filename => {
                const timestamp = parseInt(filename.replace('.zip', ''));
                const date = new Date(timestamp);
                const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
                return { filename, timestamp, date: dateStr };
            })
            .sort((a, b) => b.timestamp - a.timestamp); // 从新到旧排序
        
        return backupFiles;
    } catch (error) {
        console.error('[HF Backup] 列出备份文件失败:', error);
        return [];
    }
}

/**
 * 使用 Hugging Face API 删除文件（参考空间删除的API方式）
 * @param {string} hfToken - Hugging Face token
 * @param {string} hfRepo - 仓库名 (username/repo-name)
 * @param {string} filename - 要删除的文件名
 * @param {function} logCallback - 日志回调函数
 * @returns {Promise<boolean>} 是否删除成功
 */
async function deleteFileViaAPI(hfToken, hfRepo, filename, logCallback = null) {
    const log = (msg, type = 'info') => {
        console.log(`[HF Backup] ${msg}`);
        if (logCallback) logCallback(msg, type);
    };
    
    try {
        // 方法1：使用 HF Hub API 删除文件（推荐）
        const [owner, repoName] = hfRepo.split('/');
        const commitUrl = `https://huggingface.co/api/datasets/${hfRepo}/commit/main`;
        
        const commitPayload = {
            operations: [
                {
                    operation: "delete",
                    path: filename
                }
            ],
            summary: `删除旧备份文件: ${filename}`
        };
        
        const response = await fetch(commitUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${hfToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(commitPayload)
        });
        
        if (response.ok) {
            log(`✅ API删除成功: ${filename}`);
            return true;
        } else {
            const errorText = await response.text();
            log(`⚠️ API删除失败 (${response.status}): ${filename} - ${errorText}`, 'warning');
            return false;
        }
    } catch (error) {
        log(`⚠️ API删除异常: ${filename} - ${error.message}`, 'warning');
        return false;
    }
}

/**
 * 管理备份文件：保留3天，每天最后一个
 * @param {string} repoPath - 仓库本地路径
 * @param {function} logCallback - 日志回调函数
 * @returns {Array<string>} 需要删除的文件列表
 */
function manageBackupFiles(repoPath, logCallback = null) {
    const log = (msg, type = 'info') => {
        console.log(`[HF Backup] ${msg}`);
        if (logCallback) logCallback(msg, type);
    };
    
    try {
        const backupFiles = listBackupFiles(repoPath);
        
        if (backupFiles.length === 0) {
            return [];
        }
        
        log(`📋 当前仓库中有 ${backupFiles.length} 个备份文件`);
        
        // 按日期分组
        const filesByDate = {};
        backupFiles.forEach(file => {
            if (!filesByDate[file.date]) {
                filesByDate[file.date] = [];
            }
            filesByDate[file.date].push(file);
        });
        
        // 获取今天的日期
        const today = new Date().toISOString().split('T')[0];
        
        const filesToDelete = [];
        
        // 1. 每天只保留最后一个（最新的）备份
        Object.keys(filesByDate).forEach(date => {
            const filesOnDate = filesByDate[date];
            if (filesOnDate.length > 1) {
                // 保留第一个（最新的），删除其他
                const toDelete = filesOnDate.slice(1);
                toDelete.forEach(file => {
                    log(`🗑️ 删除同日旧备份: ${file.filename} (${file.date})`);
                    filesToDelete.push(file.filename);
                });
            }
        });
        
        // 2. 重新统计（删除同日重复后）
        const remainingFiles = backupFiles.filter(f => !filesToDelete.includes(f.filename));
        const uniqueDates = [...new Set(remainingFiles.map(f => f.date))].sort().reverse();
        
        // 3. 只保留3天的备份
        if (uniqueDates.length > 3) {
            const datesToKeep = uniqueDates.slice(0, 3);
            remainingFiles.forEach(file => {
                if (!datesToKeep.includes(file.date)) {
                    log(`🗑️ 删除超过3天的备份: ${file.filename} (${file.date})`);
                    filesToDelete.push(file.filename);
                }
            });
        }
        
        if (filesToDelete.length > 0) {
            log(`🧹 共需删除 ${filesToDelete.length} 个旧备份`);
        } else {
            log(`✅ 备份文件符合保留策略，无需删除`);
        }
        
        return filesToDelete;
    } catch (error) {
        console.error('[HF Backup] 管理备份文件失败:', error);
        return [];
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
export async function backupToHuggingFace(dataDir, username, hfToken, hfRepo, hfEmail, logCallback = null) {
    const log = (msg, type = 'info') => {
        console.log(`[HF Backup] ${msg}`);
        if (logCallback) logCallback(msg, type);
    };
    
    try {
        
        // 验证数据目录是否存在
        if (!fs.existsSync(dataDir)) {
            throw new Error(`数据目录不存在: ${dataDir}`);
        }

        // 创建临时目录
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // 生成备份文件名（纯时间戳格式）
        const now = new Date();
        const timestamp = now.getTime(); // Unix 时间戳（毫秒）
        const backupFilename = `${timestamp}.zip`;
        const tempZipPath = path.join(tempDir, backupFilename);

        // 压缩数据目录
        log('🗜️ 正在压缩数据目录...');
        await compressDirectory(dataDir, tempZipPath);

        // 获取文件大小
        const fileSize = fs.statSync(tempZipPath).size;
        const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);
        const fileSizeGB = (fileSize / 1024 / 1024 / 1024).toFixed(2);
        
        log(`📦 压缩完成: ${fileSizeMB} MB`);
        
        // 大文件警告
        if (fileSize > 5 * 1024 * 1024 * 1024) { // > 5GB
            log(`⚠️ 文件非常大 (${fileSizeGB} GB)，上传可能需要较长时间`, 'warning');
        } else if (fileSize > 1 * 1024 * 1024 * 1024) { // > 1GB
            log(`ℹ️ 文件较大 (${fileSizeGB} GB)，上传可能需要几分钟`, 'info');
        }

        // 上传到 Hugging Face
        const uploadResult = await uploadToHuggingFace(
            tempZipPath,
            hfToken,
            hfRepo,
            backupFilename,
            username,
            hfEmail,
            logCallback
        );

        // 清理临时文件
        log('🧹 清理临时文件...');
        fs.unlinkSync(tempZipPath);
        
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

/**
 * 列出 Hugging Face 仓库中的所有备份文件
 * @param {string} hfToken - Hugging Face token
 * @param {string} hfRepo - Hugging Face 仓库名
 * @returns {Promise<Array>} 备份文件列表
 */
export async function listBackupFilesFromHF(hfToken, hfRepo) {
    try {
        console.log('[HF Backup] 获取仓库备份列表...');
        
        const url = `https://huggingface.co/api/datasets/${hfRepo}/tree/main`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${hfToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`获取文件列表失败: ${response.status}`);
        }
        
        const files = await response.json();
        
        // 筛选出 .zip 备份文件
        const backupFiles = files
            .filter(f => f.type === 'file' && f.path.endsWith('.zip') && /^\d+\.zip$/.test(f.path))
            .map(f => {
                const timestamp = parseInt(f.path.replace('.zip', ''));
                const date = new Date(timestamp);
                return {
                    filename: f.path,
                    timestamp: timestamp,
                    date: date.toISOString(),
                    size: f.size,
                    downloadUrl: `https://huggingface.co/datasets/${hfRepo}/resolve/main/${f.path}`
                };
            })
            .sort((a, b) => b.timestamp - a.timestamp); // 从新到旧排序
        
        console.log(`[HF Backup] 找到 ${backupFiles.length} 个备份文件`);
        return backupFiles;
    } catch (error) {
        console.error('[HF Backup] 获取备份列表失败:', error);
        throw error;
    }
}

/**
 * 从 Hugging Face 下载备份文件
 * @param {string} downloadUrl - 文件下载 URL
 * @param {string} outputPath - 输出路径
 * @param {string} hfToken - Hugging Face token（用于私有仓库）
 * @param {function} progressCallback - 进度回调
 * @returns {Promise<void>}
 */
async function downloadFile(downloadUrl, outputPath, hfToken, progressCallback = null) {
    try {
        const headers = {};
        if (hfToken) {
            headers['Authorization'] = `Bearer ${hfToken}`;
        }
        
        const response = await fetch(downloadUrl, { headers });
        
        if (!response.ok) {
            throw new Error(`下载失败: ${response.status}`);
        }
        
        const fileSize = parseInt(response.headers.get('content-length') || '0');
        let downloadedSize = 0;
        
        // 创建写入流
        const fileStream = fs.createWriteStream(outputPath);
        
        // 监听下载进度
        const reader = response.body.getReader();
        
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            downloadedSize += value.length;
            fileStream.write(value);
            
            // 回调进度
            if (progressCallback && fileSize > 0) {
                const progress = Math.round((downloadedSize / fileSize) * 100);
                progressCallback(progress, downloadedSize, fileSize);
            }
        }
        
        fileStream.end();
        
        // 等待文件写入完成
        await new Promise((resolve, reject) => {
            fileStream.on('finish', resolve);
            fileStream.on('error', reject);
        });
        
    } catch (error) {
        console.error('[HF Backup] 下载文件失败:', error);
        throw error;
    }
}

/**
 * 恢复备份到本地
 * @param {string} hfToken - Hugging Face token
 * @param {string} hfRepo - Hugging Face 仓库名
 * @param {string} dataDir - 用户数据目录 (st-data)
 * @param {string} filename - 备份文件名（可选，默认最早的）
 * @param {function} logCallback - 日志回调
 * @returns {Promise<object>} 恢复结果
 */
export async function restoreFromHuggingFace(hfToken, hfRepo, dataDir, filename = null, logCallback = null) {
    const log = (msg, type = 'info') => {
        console.log(`[HF Backup] ${msg}`);
        if (logCallback) logCallback(msg, type);
    };
    
    let tempZipPath = null;
    let tempExtractPath = null;
    
    try {
        log('🔍 获取备份文件列表...');
        
        // 获取备份文件列表
        const backupFiles = await listBackupFilesFromHF(hfToken, hfRepo);
        
        if (backupFiles.length === 0) {
            throw new Error('仓库中没有找到备份文件');
        }
        
        // 选择要恢复的备份文件
        let targetBackup;
        if (filename) {
            targetBackup = backupFiles.find(f => f.filename === filename);
            if (!targetBackup) {
                throw new Error(`找不到指定的备份文件: ${filename}`);
            }
            const dateStr = new Date(targetBackup.timestamp).toLocaleString('zh-CN', { 
                timeZone: 'Asia/Shanghai',
                hour12: false 
            });
            log(`📦 选择备份: ${filename} (${dateStr})`);
        } else {
            // 默认选择最早的备份（最后一个）
            targetBackup = backupFiles[backupFiles.length - 1];
            const dateStr = new Date(targetBackup.timestamp).toLocaleString('zh-CN', { 
                timeZone: 'Asia/Shanghai',
                hour12: false 
            });
            log(`📦 使用最早的备份: ${targetBackup.filename} (${dateStr})`);
        }
        
        // 创建临时目录
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        tempZipPath = path.join(tempDir, `restore_${Date.now()}.zip`);
        tempExtractPath = path.join(tempDir, `restore_${Date.now()}`);
        
        // 下载备份文件
        log('⬇️ 下载备份文件...');
        const fileSizeMB = (targetBackup.size / 1024 / 1024).toFixed(2);
        log(`   文件大小: ${fileSizeMB} MB`);
        
        await downloadFile(targetBackup.downloadUrl, tempZipPath, hfToken, (progress, downloaded, total) => {
            const downloadedMB = (downloaded / 1024 / 1024).toFixed(2);
            const totalMB = (total / 1024 / 1024).toFixed(2);
            log(`   下载进度: ${progress}% (${downloadedMB}/${totalMB} MB)`, 'progress');
        });
        
        log('✅ 下载完成');
        
        // 解压备份文件
        log('📂 解压备份文件...');
        await extract(tempZipPath, { dir: tempExtractPath });
        log('✅ 解压完成');
        
        // 清除现有数据（如果存在）
        if (fs.existsSync(dataDir)) {
            log('🗑️ 清除现有数据...');
            fs.rmSync(dataDir, { recursive: true, force: true });
        }
        
        // 恢复数据
        log('🔄 恢复数据到目标目录...');
        if (!fs.existsSync(path.dirname(dataDir))) {
            fs.mkdirSync(path.dirname(dataDir), { recursive: true });
        }
        
        // 移动解压后的文件到数据目录
        fs.renameSync(tempExtractPath, dataDir);
        
        // 清理临时文件
        log('🧹 清理临时文件...');
        if (fs.existsSync(tempZipPath)) {
            fs.unlinkSync(tempZipPath);
        }
        
        log('✅ 恢复完成！');
        
        return {
            success: true,
            filename: targetBackup.filename,
            timestamp: new Date(targetBackup.timestamp).toISOString(),
            size: targetBackup.size,
            dataDir: dataDir
        };
        
    } catch (error) {
        console.error('[HF Backup] 恢复失败:', error);
        
        // 清理临时文件
        if (tempZipPath && fs.existsSync(tempZipPath)) {
            try {
                fs.unlinkSync(tempZipPath);
            } catch (e) {
                console.error('[HF Backup] 清理临时文件失败:', e);
            }
        }
        
        if (tempExtractPath && fs.existsSync(tempExtractPath)) {
            try {
                fs.rmSync(tempExtractPath, { recursive: true, force: true });
            } catch (e) {
                console.error('[HF Backup] 清理临时目录失败:', e);
            }
        }
        
        throw error;
    }
}
