import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';
import { Readable } from 'stream';

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

        // 读取文件
        const fileBuffer = fs.readFileSync(filePath);
        const fileSize = fs.statSync(filePath).size;
        
        console.log(`[HF Backup] 开始上传文件: ${filename} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
        
        // Hugging Face API 端点
        const url = `https://huggingface.co/api/datasets/${hfRepo}/upload/main/${filename}`;
        
        // 使用 fetch 上传文件
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${hfToken}`,
                'Content-Type': 'application/zip',
            },
            body: fileBuffer
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`上传失败 (${response.status}): ${errorText}`);
        }

        const result = await response.json();
        console.log('[HF Backup] ✅ 上传成功');
        
        return {
            success: true,
            url: `https://huggingface.co/datasets/${hfRepo}/blob/main/${filename}`,
            size: fileSize,
            ...result
        };
    } catch (error) {
        console.error('[HF Backup] ❌ 上传失败:', error);
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
        console.log(`[HF Backup] 压缩包大小: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

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
