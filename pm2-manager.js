import pm2 from 'pm2';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { updateUserStatus } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PM2 连接状态
let pm2Connected = false;

// 连接到PM2
const connectPM2 = () => {
    return new Promise((resolve, reject) => {
        // 如果已经连接，直接返回
        if (pm2Connected) {
            resolve();
            return;
        }
        
        pm2.connect((err) => {
            if (err) {
                console.error('PM2 connect error:', err);
                pm2Connected = false;
                reject(err);
            } else {
                pm2Connected = true;
                resolve();
            }
        });
    });
};

// 断开PM2连接
const disconnectPM2 = () => {
    try {
        if (pm2Connected && pm2.client) {
            pm2.disconnect();
            pm2Connected = false;
        }
    } catch (error) {
        console.error('PM2 disconnect error:', error);
        pm2Connected = false;
    }
};

// 启动SillyTavern实例
export const startInstance = async (username, port, stDir, dataDir) => {
    try {
        await connectPM2();
    } catch (error) {
        throw new Error(`Failed to connect to PM2: ${error.message}`);
    }
    
    return new Promise((resolve, reject) => {
        const stServerPath = path.join(stDir, 'server.js');
        
        pm2.start({
            name: `st-${username}`,
            script: stServerPath,
            args: `--port ${port} --dataRoot ${dataDir}`,
            cwd: stDir,
            interpreter: 'node',
            env: {
                NODE_ENV: 'production'
            },
            max_memory_restart: '500M',
            error_file: path.join(__dirname, 'logs', `${username}-error.log`),
            out_file: path.join(__dirname, 'logs', `${username}-out.log`),
            time: true
        }, (err, apps) => {
            disconnectPM2();
            
            if (err) {
                console.error(`Failed to start instance for ${username}:`, err);
                reject(err);
            } else {
                updateUserStatus(username, 'running');
                resolve(apps);
            }
        });
    });
};

// 停止实例
export const stopInstance = async (username) => {
    try {
        await connectPM2();
    } catch (error) {
        throw new Error(`Failed to connect to PM2: ${error.message}`);
    }
    
    return new Promise((resolve, reject) => {
        pm2.stop(`st-${username}`, (err, proc) => {
            disconnectPM2();
            
            if (err) {
                reject(err);
            } else {
                updateUserStatus(username, 'stopped');
                resolve(proc);
            }
        });
    });
};

// 重启实例
export const restartInstance = async (username) => {
    try {
        await connectPM2();
    } catch (error) {
        throw new Error(`Failed to connect to PM2: ${error.message}`);
    }
    
    return new Promise((resolve, reject) => {
        pm2.restart(`st-${username}`, (err, proc) => {
            disconnectPM2();
            
            if (err) {
                reject(err);
            } else {
                updateUserStatus(username, 'running');
                resolve(proc);
            }
        });
    });
};

// 删除实例
export const deleteInstance = async (username) => {
    try {
        await connectPM2();
    } catch (error) {
        throw new Error(`Failed to connect to PM2: ${error.message}`);
    }
    
    return new Promise((resolve, reject) => {
        pm2.delete(`st-${username}`, (err, proc) => {
            disconnectPM2();
            
            if (err) {
                reject(err);
            } else {
                resolve(proc);
            }
        });
    });
};

// 获取实例状态
export const getInstanceStatus = async (username) => {
    try {
        await connectPM2();
    } catch (error) {
        throw new Error(`Failed to connect to PM2: ${error.message}`);
    }
    
    return new Promise((resolve, reject) => {
        pm2.describe(`st-${username}`, (err, processDescription) => {
            disconnectPM2();
            
            if (err) {
                reject(err);
            } else if (processDescription.length === 0) {
                resolve(null);
            } else {
                const proc = processDescription[0];
                resolve({
                    status: proc.pm2_env.status,
                    cpu: proc.monit.cpu,
                    memory: proc.monit.memory,
                    uptime: proc.pm2_env.pm_uptime,
                    restarts: proc.pm2_env.restart_time
                });
            }
        });
    });
};

// 获取所有实例列表
export const listAllInstances = async () => {
    try {
        await connectPM2();
    } catch (error) {
        throw new Error(`Failed to connect to PM2: ${error.message}`);
    }
    
    return new Promise((resolve, reject) => {
        pm2.list((err, processDescriptionList) => {
            disconnectPM2();
            
            if (err) {
                reject(err);
            } else {
                const stInstances = processDescriptionList
                    .filter(proc => proc.name.startsWith('st-'))
                    .map(proc => ({
                        name: proc.name,
                        username: proc.name.replace('st-', ''),
                        status: proc.pm2_env.status,
                        cpu: proc.monit.cpu,
                        memory: proc.monit.memory,
                        uptime: proc.pm2_env.pm_uptime,
                        restarts: proc.pm2_env.restart_time
                    }));
                resolve(stInstances);
            }
        });
    });
};

// 获取日志内容
export const getInstanceLogs = (username, logType = 'out', lines = 100) => {
    const logFileName = logType === 'error' 
        ? `${username}-error.log` 
        : `${username}-out.log`;
    const logFilePath = path.join(__dirname, 'logs', logFileName);
    
    return new Promise((resolve, reject) => {
        // 检查日志文件是否存在
        if (!fs.existsSync(logFilePath)) {
            resolve({ logs: [], exists: false });
            return;
        }
        
        try {
            // 读取文件内容
            const content = fs.readFileSync(logFilePath, 'utf-8');
            const allLines = content.split('\n').filter(line => line.trim());
            
            // 获取最后N行
            const lastLines = allLines.slice(-lines);
            
            resolve({
                logs: lastLines,
                exists: true,
                totalLines: allLines.length
            });
        } catch (error) {
            reject(error);
        }
    });
};

// 获取日志文件路径
export const getLogFilePath = (username, logType = 'out') => {
    const logFileName = logType === 'error' 
        ? `${username}-error.log` 
        : `${username}-out.log`;
    return path.join(__dirname, 'logs', logFileName);
};
