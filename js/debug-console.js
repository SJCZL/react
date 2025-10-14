/**
 * 调试控制台
 * 提供一个简单的界面来显示和过滤调试信息
 */

class DebugConsole {
    constructor() {
        this.container = null;
        this.isVisible = false;
        this.filter = 'ALL'; // ALL, ERROR, WARN, INFO
        this.maxEntries = 100;
        this.entries = [];
        this.init();
    }

    init() {
        // 创建调试控制台容器
        this.container = document.createElement('div');
        this.container.id = 'debug-console';
        this.container.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            width: 400px;
            height: 300px;
            background-color: rgba(0, 0, 0, 0.8);
            color: #fff;
            font-family: monospace;
            font-size: 12px;
            border-radius: 5px;
            padding: 10px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: none;
            flex-direction: column;
        `;

        // 创建标题栏
        const titleBar = document.createElement('div');
        titleBar.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 1px solid #555;
        `;

        const title = document.createElement('div');
        title.textContent = 'Debug Console';
        title.style.fontWeight = 'bold';

        const closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.style.cssText = `
            background: none;
            border: none;
            color: #fff;
            font-size: 16px;
            cursor: pointer;
            padding: 0;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        closeButton.addEventListener('click', () => this.hide());

        titleBar.appendChild(title);
        titleBar.appendChild(closeButton);

        // 创建过滤器
        const filterBar = document.createElement('div');
        filterBar.style.cssText = `
            display: flex;
            margin-bottom: 10px;
            gap: 5px;
        `;

        const filters = ['ALL', 'ERROR', 'WARN', 'INFO'];
        filters.forEach(filter => {
            const button = document.createElement('button');
            button.textContent = filter;
            button.style.cssText = `
                background: ${filter === this.filter ? '#555' : '#333'};
                border: 1px solid #555;
                color: #fff;
                padding: 2px 5px;
                font-size: 10px;
                cursor: pointer;
                border-radius: 3px;
            `;
            button.addEventListener('click', () => this.setFilter(filter));
            filterBar.appendChild(button);
        });

        // 创建清除按钮
        const clearButton = document.createElement('button');
        clearButton.textContent = 'Clear';
        clearButton.style.cssText = `
            background: #333;
            border: 1px solid #555;
            color: #fff;
            padding: 2px 5px;
            font-size: 10px;
            cursor: pointer;
            border-radius: 3px;
            margin-left: auto;
        `;
        clearButton.addEventListener('click', () => this.clear());
        filterBar.appendChild(clearButton);

        // 创建日志容器
        const logContainer = document.createElement('div');
        logContainer.style.cssText = `
            flex: 1;
            overflow-y: auto;
            background-color: rgba(0, 0, 0, 0.5);
            padding: 5px;
            border-radius: 3px;
        `;
        logContainer.id = 'debug-log-container';

        // 组装控制台
        this.container.appendChild(titleBar);
        this.container.appendChild(filterBar);
        this.container.appendChild(logContainer);
        document.body.appendChild(this.container);

        // 监听调试面板更新
        if (window.debug) {
            const originalSet = window.debug.set;
            window.debug.set = (level, category, message) => {
                originalSet.call(window.debug, level, category, message);
                this.addEntry(level, category, message);
            };
        }

        // 添加键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                this.toggle();
            }
        });

        console.log('[Debug Console] Initialized (Ctrl+Shift+D to toggle)');
    }

    addEntry(level, category, message) {
        const entry = {
            timestamp: new Date(),
            level,
            category,
            message
        };

        this.entries.push(entry);

        // 限制条目数量
        if (this.entries.length > this.maxEntries) {
            this.entries.shift();
        }

        // 如果控制台可见，立即更新显示
        if (this.isVisible) {
            this.updateDisplay();
        }
    }

    updateDisplay() {
        const logContainer = document.getElementById('debug-log-container');
        if (!logContainer) return;

        // 清空容器
        logContainer.innerHTML = '';

        // 过滤并排序条目
        const filteredEntries = this.filter === 'ALL' 
            ? this.entries 
            : this.entries.filter(entry => entry.level === this.filter);

        // 添加条目到容器
        filteredEntries.forEach(entry => {
            const entryElement = document.createElement('div');
            entryElement.style.cssText = `
                margin-bottom: 5px;
                padding: 3px;
                border-radius: 2px;
                word-wrap: break-word;
            `;

            // 根据级别设置背景色
            switch (entry.level) {
                case 'ERROR':
                    entryElement.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
                    break;
                case 'WARN':
                    entryElement.style.backgroundColor = 'rgba(255, 165, 0, 0.3)';
                    break;
                case 'INFO':
                    entryElement.style.backgroundColor = 'rgba(0, 0, 255, 0.2)';
                    break;
                default:
                    entryElement.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            }

            // 格式化时间戳
            const timeStr = entry.timestamp.toLocaleTimeString();
            
            entryElement.innerHTML = `
                <span style="color: #aaa;">[${timeStr}]</span> 
                <span style="color: ${this.getLevelColor(entry.level)};">[${entry.level}]</span> 
                <span style="color: #0ff;">[${entry.category}]</span> 
                <span>${entry.message}</span>
            `;

            logContainer.appendChild(entryElement);
        });

        // 滚动到底部
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    getLevelColor(level) {
        switch (level) {
            case 'ERROR': return '#f00';
            case 'WARN': return '#ff0';
            case 'INFO': return '#0ff';
            default: return '#fff';
        }
    }

    setFilter(filter) {
        this.filter = filter;
        this.updateDisplay();
        
        // 更新按钮样式
        const filterBar = this.container.querySelector('div:nth-child(2)');
        const buttons = filterBar.querySelectorAll('button');
        buttons.forEach(button => {
            if (button.textContent === filter) {
                button.style.backgroundColor = '#555';
            } else if (['ALL', 'ERROR', 'WARN', 'INFO'].includes(button.textContent)) {
                button.style.backgroundColor = '#333';
            }
        });
    }

    clear() {
        this.entries = [];
        this.updateDisplay();
    }

    show() {
        if (this.container) {
            this.container.style.display = 'flex';
            this.isVisible = true;
            this.updateDisplay();
        }
    }

    hide() {
        if (this.container) {
            this.container.style.display = 'none';
            this.isVisible = false;
        }
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
}

// 等待DOM加载完成后再创建调试控制台
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.debugConsole = new DebugConsole();
    });
} else {
    // DOM已经加载完成，直接创建调试控制台
    window.debugConsole = new DebugConsole();
}