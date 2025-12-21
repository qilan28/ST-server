// Cloudflare Tunnel 配置指南

/**
 * 如何配置 Cloudflare Tunnel 与 ST-server 正确连接
 * 
 * 问题: Cloudflare Tunnel 尝试连接 [::1]:8001 (localhost:8001) 但连接被拒绝
 * 错误: dial tcp [::1]:8001: connect: connection refused
 * 
 * 解决步骤:
 */

/**
 * 1. 确保您的 Cloudflare Tunnel 配置指向正确的端口
 * 
 * 在您的 cloudflared 配置文件中 (config.yml)，将本地服务设置为 Nginx 监听的端口:
 * 
 * tunnel: your-tunnel-id
 * credentials-file: /path/to/credentials.json
 * 
 * ingress:
 *   - hostname: your-domain.com
 *     service: http://127.0.0.1:80  # 使用 Nginx 监听的端口 (默认为 80)
 *   - service: http_status:404
 */

/**
 * 2. 确保 Nginx 正在监听正确的端口
 * 
 * 在 ST-server 的 config.json 中设置:
 * "nginx": {
 *   "enabled": true,
 *   "domain": "your-domain.com", 
 *   "port": 80,               // 使用标准 HTTP 端口
 *   "https": false,           // Cloudflare 已处理 HTTPS
 *   "cloudflare_tunnel_domain": "your-domain.com",
 *   "enableAccessControl": true
 * }
 * 
 * 然后重新生成 Nginx 配置并重启 Nginx
 */

/**
 * 3. 调整 Cloudflare 端口转发 
 * 
 * 您的问题是 Cloudflare 尝试连接 8001 端口，但该端口没有服务
 * 
 * 解决方法 A: 修改您的 cloudflared 配置以使用正确的端口
 * 解决方法 B: 在本地运行反向代理将 8001 端口转发到您的 Nginx 端口
 * 解决方法 C: 配置您的 cloudflared 指向 3000 端口 (ST-server 的默认端口)
 */ 

/**
 * 推荐配置 (config.yml):
 * 
 * tunnel: your-tunnel-id
 * credentials-file: /path/to/credentials.json
 * 
 * ingress:
 *   - hostname: your-domain.com
 *     service: http://localhost:3000    # 直接指向 ST-server
 *   - service: http_status:404
 */
