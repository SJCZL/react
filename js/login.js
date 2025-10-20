import { authManager } from './auth-manager.js';

/**
 * LoginManager - 登录页面管理器
 */
class LoginManager {
    constructor() {
        this.loginForm = document.getElementById('login-form');
        this.registerForm = document.getElementById('register-form');
        this.showRegisterLink = document.getElementById('show-register');
        this.showLoginLink = document.getElementById('show-login');
        this.messageElement = document.getElementById('message');
        this.loadingSpinner = document.getElementById('loading-spinner');

        this.init();
    }

    init() {
        // 检查是否已登录
        if (authManager.isAuthenticated()) {
            this.redirectToMain();
            return;
        }

        this.bindEvents();
    }

    bindEvents() {
        // 表单提交事件
        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        this.registerForm.addEventListener('submit', (e) => this.handleRegister(e));

        // 切换表单事件
        this.showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.showRegisterForm();
        });

        this.showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginForm();
        });

        // 实时验证
        this.registerForm.querySelector('#register-confirm-password').addEventListener('input', (e) => {
            this.validatePasswordMatch(e.target);
        });
    }

    showLoginForm() {
        document.getElementById('login-form-container').style.display = 'block';
        document.getElementById('register-form-container').style.display = 'none';
        this.clearMessages();
    }

    showRegisterForm() {
        document.getElementById('login-form-container').style.display = 'none';
        document.getElementById('register-form-container').style.display = 'block';
        this.clearMessages();
    }

    async handleLogin(e) {
        e.preventDefault();

        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value.trim();

        console.log('=== HANDLE LOGIN ===');
        console.log('Raw username from DOM:', document.getElementById('login-username').value);
        console.log('Raw password from DOM:', document.getElementById('login-password').value);
        console.log('Trimmed username:', username);
        console.log('Trimmed password:', password);
        console.log('Credentials object:', { username, password });

        if (!username || !password) {
            this.showMessage('请输入用户名和密码', 'error');
            return;
        }

        this.showLoading(true);

        try {
            console.log('Calling authManager.login...');
            await authManager.login({ username, password });
            this.showMessage('登录成功，正在跳转...', 'success');
            setTimeout(() => this.redirectToMain(), 1000);
        } catch (error) {
            console.error('Login error:', error);
            this.showMessage(error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async handleRegister(e) {
        e.preventDefault();

        const username = document.getElementById('register-username').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;

        // 基础验证
        if (!username || !email || !password || !confirmPassword) {
            this.showMessage('请填写所有必填字段', 'error');
            return;
        }

        if (password !== confirmPassword) {
            this.showMessage('两次输入的密码不一致', 'error');
            return;
        }

        if (password.length < 6) {
            this.showMessage('密码长度至少为6个字符', 'error');
            return;
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            this.showMessage('用户名只能包含字母、数字和下划线', 'error');
            return;
        }

        this.showLoading(true);

        try {
            await authManager.register({ username, email, password });
            this.showMessage('注册成功，正在跳转...', 'success');
            setTimeout(() => this.redirectToMain(), 1000);
        } catch (error) {
            // 处理验证错误详情
            if (error.errors && Array.isArray(error.errors)) {
                const errorMessages = error.errors.map(err => err.msg || err.message).join('\n');
                this.showMessage(errorMessages, 'error');
            } else {
                this.showMessage(error.message, 'error');
            }
        } finally {
            this.showLoading(false);
        }
    }

    validatePasswordMatch(confirmInput) {
        const password = document.getElementById('register-password').value;
        const confirmPassword = confirmInput.value;

        if (confirmPassword && password !== confirmPassword) {
            confirmInput.setCustomValidity('两次输入的密码不一致');
        } else {
            confirmInput.setCustomValidity('');
        }
    }

    showMessage(message, type) {
        this.messageElement.textContent = message;
        this.messageElement.className = `message ${type}`;
        this.messageElement.style.display = 'block';
    }

    clearMessages() {
        this.messageElement.style.display = 'none';
    }

    showLoading(show) {
        this.loadingSpinner.style.display = show ? 'block' : 'none';

        // 禁用/启用表单
        const forms = [this.loginForm, this.registerForm];
        forms.forEach(form => {
            const inputs = form.querySelectorAll('input');
            const buttons = form.querySelectorAll('button');

            [...inputs, ...buttons].forEach(element => {
                element.disabled = show;
            });
        });
    }

    redirectToMain() {
        window.location.href = '/index.html';
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    new LoginManager();
});