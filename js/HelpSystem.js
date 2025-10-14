/**
 * Help System for Webapp
 * Manages help popup functionality and comprehensive keyboard shortcuts documentation
 */

export class HelpSystem {
    constructor() {
        this.helpIcon = null;
        this.helpPopup = null;
        this.closeHelp = null;
        
        // Initialize help system
        this.init();
    }

    /**
     * Initialize the help system
     */
    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupHelp());
        } else {
            this.setupHelp();
        }
    }

    /**
     * Set up help functionality
     */
    setupHelp() {
        this.helpIcon = document.getElementById('help-icon');
        this.helpPopup = document.getElementById('help-popup');
        this.closeHelp = document.getElementById('close-help');

        if (!this.helpIcon || !this.helpPopup || !this.closeHelp) {
            console.warn('[HelpSystem] Required elements not found');
            return;
        }

        this.setupEventListeners();
        this.updateHelpContent();
        console.log('[HelpSystem] Help system initialized');
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Show popup when help icon is clicked
        this.helpIcon.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showHelpPopup();
        });

        // Hide popup when close button is clicked
        this.closeHelp.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.hideHelpPopup();
        });

        // Hide popup when clicking outside the content
        this.helpPopup.addEventListener('click', (e) => {
            if (e.target === this.helpPopup) {
                this.hideHelpPopup();
            }
        });

        // Hide popup when pressing Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.helpPopup.classList.contains('show')) {
                this.hideHelpPopup();
            }
        });

        // Prevent popup content clicks from closing the popup
        const helpContent = this.helpPopup.querySelector('.help-popup-content');
        if (helpContent) {
            helpContent.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    }

    /**
     * Show help popup
     */
    showHelpPopup() {
        this.helpPopup.classList.add('show');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    /**
     * Hide help popup
     */
    hideHelpPopup() {
        this.helpPopup.classList.remove('show');
        document.body.style.overflow = ''; // Restore scrolling
    }

    /**
     * Get comprehensive help content
     */
    static getHelpContent() {
        return `
            <div class="help-link"><a href="https://strong.yuque.com/mu8o3k/pg7l4n/vkrdydr9gma85wcb#LulTK" target="_blank" rel="noopener noreferrer">完整帮助</a></div>
            <div>&nbsp;</div>
            <div class="help-section">
                <h4>【全局】标签页切换</h4>
                <ul>
                    <li><kbd>Alt + 1</kbd> —— 切换到 主对话 标签页</li>
                    <li><kbd>Alt + 2</kbd> —— 切换到 场景配置 标签页</li>
                    <li><kbd>Alt + 3</kbd> —— 切换到 并行测试 标签页</li>
                    <li><kbd>Alt + 4</kbd> —— 切换到 预设管理 标签页</li>
                </ul>
            </div>
            
            <div class="help-section">
                <h4>【全局】文本框快照</h4>
                <ul>
                    <li>标记 <kbd>[S]</kbd> 的文本框支持快照功能。</li>
                    <li>&nbsp;</li>
                    <li><kbd>Alt + 左/右方向键</kbd> —— 切换快照</li>
                    <li><kbd>Alt + S</kbd> —— 保存当前文本为快照</li>
                    <li><kbd>Alt + Backspace</kbd> —— 删除当前快照</li>
                    <li><kbd>Shift + Alt + S</kbd> —— 导出快照历史</li>
                </ul>
            </div>
            
            <div class="help-section">
                <h4>主对话界面</h4>
                <ul>
                    <li><kbd>点击消息体</kbd> —— 查看分析</li>
                    <li><kbd>方向键</kbd> —— 切换选中的消息</li>
                    <li><kbd>Alt + R</kbd> —— 重新生成分析</li>
                    <li><kbd>Alt + H</kbd> —— 展开或隐藏推理内容</li>
                    <li><kbd>Enter</kbd> —— 发送消息</li>
                    <li><kbd>Shift + Enter</kbd> —— 换行</li>
                    <li><kbd>Spacebar</kbd> —— 跳转到对话开头</li>
                </ul>
            </div>
            
            <div class="help-section">
                <h4>场景配置界面</h4>
                    <li><kbd>Spacebar</kbd> —— 回到上方</li>
                    <h5>YAML 编辑器</h5>
                    <ul>
                        <li><kbd>Tab</kbd> —— 添加缩进</li>
                        <li><kbd>选中 + Tab</kbd> —— 添加行缩进</li>
                        <li><kbd>Enter</kbd> —— 保留缩进换行</li>
                    </ul>
                    <h5>配置窗口</h5>
                    <ul>
                        <li><kbd>点击字段名称</kbd> —— 复制占位符</li>
                    </ul>
                    <h5>模版替换文本框</h5>
                    <ul>
                        <li><kbd>点击占位符</kbd> —— 选中整个占位符</li>
                    </ul>
            </div>
            
            <div class="help-section">
                <h4>并行测试界面</h4>
                <ul>
                    <li><kbd>双击任务</kbd> —— 查看该任务配置</li>
                    <li><kbd>Alt + 点击任务</kbd> —— 强制切断生成</li>
                    <li><kbd>Shift + 点击任务</kbd> —— 在主对话界面查看对话记录</li>
                    <li><kbd>点击错误指示灯</kbd> —— 查看错误详情</li>
                    <li><kbd>点击分数</kbd> —— 查看分数详情</li>
                </ul>
            </div>

            <div class="help-section">
                <h4>预设管理界面</h4>
                <ul>
                    <li><kbd>上/下方向键</kbd> —— 切换选中的预设</li>
                    <li><kbd>Enter</kbd> —— 应用选中的预设</li>
                </ul>
            </div>
        `;
    }

    /**
     * Update help content in the popup
     */
    updateHelpContent() {
        const helpBody = document.querySelector('.help-popup-body');
        if (helpBody) {
            helpBody.innerHTML = HelpSystem.getHelpContent();
        }
    }

    /**
     * Static method for external calls
     */
    static updateHelpContent() {
        const helpBody = document.querySelector('.help-popup-body');
        if (helpBody) {
            helpBody.innerHTML = HelpSystem.getHelpContent();
        }
    }
}

// Initialize help system when imported
const helpSystem = new HelpSystem();

export default helpSystem;