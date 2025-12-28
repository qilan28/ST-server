import https from 'https';

const GITHUB_API = 'https://api.github.com';
const REPO_OWNER = 'SillyTavern';
const REPO_NAME = 'SillyTavern';

// 发起 GitHub API 请求
const githubRequest = (path) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: path,
            method: 'GET',
            headers: {
                'User-Agent': 'SillyTavern-Multi-Instance-Manager',
                'Accept': 'application/vnd.github.v3+json'
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (error) {
                        reject(new Error('Failed to parse GitHub API response'));
                    }
                } else {
                    reject(new Error(`GitHub API error: ${res.statusCode}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.end();
    });
};

// 获取所有 releases
export const getSillyTavernReleases = async () => {
    try {
        const releases = await githubRequest(`/repos/${REPO_OWNER}/${REPO_NAME}/releases`);
        
        return releases.map(release => ({
            name: release.name,
            tag: release.tag_name,
            published_at: release.published_at,
            prerelease: release.prerelease,
            draft: release.draft,
            body: release.body,
            html_url: release.html_url
        }));
    } catch (error) {
        console.error('Failed to fetch releases:', error);
        throw error;
    }
};

// 获取所有 tags（包括没有 release 的 tag）
export const getSillyTavernTags = async () => {
    try {
        const tags = await githubRequest(`/repos/${REPO_OWNER}/${REPO_NAME}/tags`);
        
        return tags.map(tag => ({
            name: tag.name,
            commit_sha: tag.commit.sha,
            commit_url: tag.commit.url
        }));
    } catch (error) {
        console.error('Failed to fetch tags:', error);
        throw error;
    }
};

// 获取所有分支
export const getSillyTavernBranches = async () => {
    try {
        const branches = await githubRequest(`/repos/${REPO_OWNER}/${REPO_NAME}/branches`);
        
        return branches.map(branch => ({
            name: branch.name,
            commit_sha: branch.commit.sha,
            protected: branch.protected
        }));
    } catch (error) {
        console.error('Failed to fetch branches:', error);
        throw error;
    }
};

// 获取完整的版本列表（releases + 主要分支）
export const getSillyTavernVersions = async () => {
    try {
        const [releases, branches] = await Promise.all([
            getSillyTavernReleases(),
            getSillyTavernBranches()
        ]);
        
        // 只保留主要分支
        const mainBranches = branches.filter(b => 
            ['release', 'staging', 'main', 'master'].includes(b.name)
        );
        
        return {
            releases: releases.filter(r => !r.draft),  // 排除草稿
            branches: mainBranches
        };
    } catch (error) {
        console.error('Failed to fetch versions:', error);
        throw error;
    }
};

// 获取仓库信息
export const getSillyTavernRepoInfo = async () => {
    try {
        const repo = await githubRequest(`/repos/${REPO_OWNER}/${REPO_NAME}`);
        
        return {
            name: repo.name,
            full_name: repo.full_name,
            description: repo.description,
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            default_branch: repo.default_branch,
            updated_at: repo.updated_at,
            html_url: repo.html_url,
            clone_url: repo.clone_url
        };
    } catch (error) {
        console.error('Failed to fetch repo info:', error);
        throw error;
    }
};
