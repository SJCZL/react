import { authManager } from './auth-manager.js';

/**
 * APIManager - 前端API管理器
 * 处理与后端API的所有通信
 */
export class APIManager {
    constructor() {
        this.baseUrl = 'http://localhost:3001/api';
    }

    /**
     * 发起API请求
     */
    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = authManager.getAuthHeaders();

        const config = {
            ...options,
            headers: {
                ...headers,
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, config);

            // 处理401未授权
            if (response.status === 401) {
                authManager.clearAuth();
                window.location.href = '/login.html';
                throw new Error('认证失败，请重新登录');
            }

            return response;
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('网络连接失败，请检查后端服务是否运行');
            }
            throw error;
        }
    }

    /**
     * 获取用户提示词列表
     */
    async getUserPrompts(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = `/prompts${queryString ? `?${queryString}` : ''}`;

        const response = await this.makeRequest(url);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: '获取提示词失败' }));
            throw new Error(errorData.message || '获取提示词失败');
        }

        return await response.json();
    }

    /**
     * 获取单个提示词详情
     */
    async getPromptById(id) {
        const response = await this.makeRequest(`/prompts/${id}`);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: '获取提示词详情失败' }));
            throw new Error(errorData.message || '获取提示词详情失败');
        }

        return await response.json();
    }

    /**
     * 创建新提示词
     */
    async createPrompt(promptData) {
        const response = await this.makeRequest('/prompts', {
            method: 'POST',
            body: JSON.stringify(promptData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: '创建提示词失败' }));
            throw new Error(errorData.message || '创建提示词失败');
        }

        return await response.json();
    }

    /**
     * 更新提示词
     */
    async updatePrompt(id, promptData) {
        const response = await this.makeRequest(`/prompts/${id}`, {
            method: 'PUT',
            body: JSON.stringify(promptData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: '更新提示词失败' }));
            throw new Error(errorData.message || '更新提示词失败');
        }

        return await response.json();
    }

    /**
     * 删除提示词
     */
    async deletePrompt(id) {
        const response = await this.makeRequest(`/prompts/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: '删除提示词失败' }));
            throw new Error(errorData.message || '删除提示词失败');
        }

        return await response.json();
    }

    /**
     * 导出用户提示词
     */
    async exportPrompts() {
        const response = await this.makeRequest('/prompts/export/all');

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: '导出提示词失败' }));
            throw new Error(errorData.message || '导出提示词失败');
        }

        return await response.json();
    }

    /**
     * 导入提示词
     */
    async importPrompts(presetsData) {
        const response = await this.makeRequest('/prompts/import', {
            method: 'POST',
            body: JSON.stringify({ presets: presetsData })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: '导入提示词失败' }));
            throw new Error(errorData.message || '导入提示词失败');
        }

        return await response.json();
    }
}

// 创建全局实例
export const apiManager = new APIManager();