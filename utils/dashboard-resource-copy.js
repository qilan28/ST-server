/**
 * 仪表板资源复制工具
 * 用于确保所有需要的资源文件都可用
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 复制仪表板相关资源到公共目录
 * 确保所有资源文件都可用
 */
export function copyDashboardResources() {
    console.log('[资源复制] 开始确保仪表板资源文件可用...');
    
    const publicDir = path.join(__dirname, '../public');
    
    // 确保所有必需的目录存在
    const requiredDirs = ['css', 'js', 'images'];
    for (const dir of requiredDirs) {
        const dirPath = path.join(publicDir, dir);
        if (!fs.existsSync(dirPath)) {
            console.log(`[资源复制] 创建目录: ${dirPath}`);
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }
    
    // 1. 确保基本样式表存在
    const styleCssPath = path.join(publicDir, 'css', 'style.css');
    const styleExists = fs.existsSync(styleCssPath);
    if (!styleExists) {
        // 尝试从 public/style.css 复制
        const rootStylePath = path.join(publicDir, 'style.css');
        if (fs.existsSync(rootStylePath)) {
            console.log(`[资源复制] 复制样式表: ${rootStylePath} -> ${styleCssPath}`);
            fs.copyFileSync(rootStylePath, styleCssPath);
        } else {
            // 创建一个基本的样式表
            console.log(`[资源复制] 创建基本样式表: ${styleCssPath}`);
            fs.writeFileSync(styleCssPath, `/* 基本样式 - 自动创建 */
body {
    font-family: Arial, sans-serif;
    line-height: 1.6;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 15px;
}

/* 表单样式 */
input, select, button {
    padding: 8px 12px;
    margin-bottom: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
}

button {
    background: #4a6cf7;
    color: white;
    cursor: pointer;
}

button:hover {
    background: #3a5ce7;
}

/* 表格样式 */
table {
    width: 100%;
    border-collapse: collapse;
}

table, th, td {
    border: 1px solid #ddd;
}

th, td {
    padding: 8px;
    text-align: left;
}

th {
    background-color: #f2f2f2;
}
`);
        }
    }
    
    // 2. 确保所有仪表板资源存在
    const dashboardResources = [
        { path: '/dashboard.html.11', content: '/* 仪表板资源 11 */' },
        { path: '/dashboard.html.12', content: '/* 仪表板资源 12 */' },
        { path: '/dashboard.html.14', content: '/* 仪表板资源 14 */' },
        { path: '/dashboard.html.15', content: '/* 仪表板资源 15 */' },
        { path: '/dashboard.html.16', content: '/* 仪表板资源 16 */' },
        { path: '/dashboard.html.28', content: '/* 仪表板资源 28 */' },
        { path: '/dashboard.html.54', content: '/* 仪表板资源 54 */' },
        { path: '/dashboard.html.355', content: '/* 仪表板资源 355 */' },
        { path: '/dashboard.js', content: '// 仪表板 JS' },
        { path: '/adapter.js', content: '// 适配器 JS' },
        { path: '/runtime.js', content: '// 运行时 JS' }
    ];
    
    for (const resource of dashboardResources) {
        const resourcePath = path.join(publicDir, resource.path);
        if (!fs.existsSync(resourcePath)) {
            console.log(`[资源复制] 创建缺失资源: ${resourcePath}`);
            
            // 创建目录
            const resourceDir = path.dirname(resourcePath);
            if (!fs.existsSync(resourceDir)) {
                fs.mkdirSync(resourceDir, { recursive: true });
            }
            
            // 写入文件
            fs.writeFileSync(resourcePath, resource.content);
        }
    }
    
    console.log('[资源复制] 仪表板资源检查完成');
}

// 导出辅助函数
export function ensureDashboardResources() {
    return copyDashboardResources();
}

// 如果直接运行此文件
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    copyDashboardResources();
}

export default { copyDashboardResources, ensureDashboardResources };
