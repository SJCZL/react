/**
 * AuthManager - 前端认证管理器
 * 处理用户登录状态、token存储和API认证
 */
export class AuthManager {
    constructor() {
        this.token = null;
        this.user = null;
        this.apiBaseUrl = 'http://localhost:3001/api';
        this.init();
    }

    init() {
        // 从localStorage恢复认证状态
        this.token = localStorage.getItem('auth_token');
        const userStr = localStorage.getItem('auth_user');
        if (userStr) {
            try {
                this.user = JSON.parse(userStr);
            } catch (e) {
                console.error('解析用户信息失败:', e);
                this.clearAuth();
            }
        }
    }

    /**
     * 检查用户是否已登录
     */
    isAuthenticated() {
        return !!(this.token && this.user);
    }

    /**
     * 获取当前用户信息
     */
    getCurrentUser() {
        return this.user;
    }

    /**
     * 获取认证token
     */
    getToken() {
        return this.token;
    }

    /**
     * 设置认证信息
     */
    setAuth(token, user) {
        this.token = token;
        this.user = user;
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_user', JSON.stringify(user));
    }

    /**
     * 清除认证信息
     */
    clearAuth() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
    }

    /**
     * 创建认证头
     */
    getAuthHeaders() {
        if (!this.token) {
            return {};
        }
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * 发起认证API请求
     */
    async makeAuthRequest(endpoint, options = {}) {
        const url = `${this.apiBaseUrl}${endpoint}`;
        const headers = this.getAuthHeaders();

        const config = {
            ...options,
            headers: {
                ...headers,
                ...options.headers
            }
        };

        console.log('=== MAKE AUTH REQUEST ===');
        console.log('URL:', url);
        console.log('Method:', config.method);
        console.log('Headers:', config.headers);
        console.log('Body:', config.body);
        console.log('Body type:', typeof config.body);
        console.log('Body length:', config.body ? config.body.length : 0);

        try {
            const response = await fetch(url, config);
            console.log('Response status:', response.status);
            console.log('Response headers:', Object.fromEntries(response.headers.entries()));

            // 处理401未授权
            if (response.status === 401) {
                this.clearAuth();
                window.location.href = '/login.html';
                throw new Error('认证失败，请重新登录');
            }

            return response;
        } catch (error) {
            console.error('Fetch error:', error);
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('网络连接失败，请检查后端服务是否运行');
            }
            throw error;
        }
    }

    /**
     * 用户登录
     */
    async login(credentials) {
        console.log('=== LOGIN METHOD ===');
        console.log('Credentials:', credentials);
        console.log('Username type:', typeof credentials.username, 'value:', credentials.username);
        console.log('Password type:', typeof credentials.password, 'value:', credentials.password);

        // 强制转换为字符串并trim
        const cleanCredentials = {
            username: String(credentials.username || '').trim(),
            password: String(credentials.password || '').trim()
        };

        console.log('Clean credentials:', cleanCredentials);
        console.log('JSON stringified:', JSON.stringify(cleanCredentials));

        // 使用JSON格式发送数据，与注册保持一致
        console.log('Using JSON format');

        const response = await this.makeAuthRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify(cleanCredentials),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.log('Error response body:', errorText);
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                errorData = { message: errorText || '登录失败' };
            }
            throw new Error(errorData.message || '登录失败');
        }

        const responseText = await response.text();
        console.log('Success response body:', responseText);
        const data = JSON.parse(responseText);
        this.setAuth(data.data.token, data.data.user);
        return data;
    }

    /**
     * 用户注册
     */
    async register(userData) {
        const response = await this.makeAuthRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: '注册失败' }));
            throw new Error(errorData.message || '注册失败');
        }

        const data = await response.json();
        this.setAuth(data.data.token, data.data.user);
        return data;
    }

    /**
     * 获取用户信息
     */
    async getProfile() {
        const response = await this.makeAuthRequest('/auth/profile');

        if (!response.ok) {
            throw new Error('获取用户信息失败');
        }

        const data = await response.json();
        return data;
    }

    /**
     * 用户登出
     */
    logout() {
        this.clearAuth();
        window.location.href = '/login.html';
    }

    /**
     * 检查token是否过期（通过profile请求验证）
     */
    async validateToken() {
        if (!this.isAuthenticated()) {
            return false;
        }

        try {
            await this.getProfile();
            return true;
        } catch (error) {
            this.clearAuth();
            return false;
        }
    }
}

// 创建全局实例
export const authManager = new AuthManager();