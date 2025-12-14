import pm2 from 'pm2';
import path from 'path';
import { fileURLToPath } from 'url';
import { updateUserStatus } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 连接到PM2
const connectPM2 = () => {
    return new Promise((resolve, reject) => {
        pm2.connect((err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

// 断开PM2连接
const disconnectPM2 = () => {
    pm2.disconnect();
};

// 启动SillyTavern实例
export const startInstance = async (username, port, stDir, dataDir) => {
    await connectPM2();
    
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
    await connectPM2();
    
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
    await connectPM2();
    
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
    await connectPM2();
    
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
    await connectPM2();
    
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
    await connectPM2();
    
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
