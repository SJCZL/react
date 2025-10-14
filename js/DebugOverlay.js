export class DebugOverlay {
    constructor() {
        this.overlay = null;
        this.sections = new Map();
        this.isVisible = false;
        this.apiStatsInterval = null;
        this.globalApiStats = {
            totalCharactersSent: 0,
            totalCharactersReceived: 0,
            totalRequests: 0
        };
        this.trackedServices = new Set();
        this.init();
    }

    init() {
        this.createOverlay();
        this.setupKeyboardShortcuts();
        this.setupApiStatsTracking();
        this.hide(); // Default hidden
    }

    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'debug-overlay';
        this.overlay.className = 'hidden';
        document.body.appendChild(this.overlay);
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Cross-platform Alt+D / Option+D detection
            // Check for Alt/Option key and the physical 'D' key (keyCode 68 or code 'KeyD')
            const isAltKey = e.altKey || (e.getModifierState && e.getModifierState('Alt'));
            const isDKey = e.keyCode === 68 || e.code === 'KeyD';
            
            if (isAltKey && isDKey) {
                e.preventDefault();
                this.toggle();
                return;
            }

            // Tab navigation shortcuts: Alt+1, Alt+2, Alt+3
            // Tab navigation shortcuts: Alt+1, Alt+2, Alt+3, Alt+4
            if (isAltKey) {
                // Check if the key is a digit between 1-4
                const digitMatch = e.code.match(/^Digit([1-4])$/);
                if (digitMatch) {
                    e.preventDefault();
                    
                    // Extract the tab index from the matched digit (1->0, 2->1, etc.)
                    const tabIndex = parseInt(digitMatch[1]) - 1;
                    
                    // Find and click the corresponding tab
                    const tabLinks = document.querySelectorAll('.tab-link');
                    if (tabLinks[tabIndex]) {
                        tabLinks[tabIndex].click();
                    }
                }
            }

        });
    }
    
    /**
     * Set up API statistics tracking
     */
    setupApiStatsTracking() {
        // Update API stats every second when overlay is visible
        this.apiStatsInterval = setInterval(() => {
            if (this.isVisible) {
                this.updateApiStats();
            }
        }, 1000);
    }
    
    /**
     * Register an API service for tracking
     */
    registerApiService(service, name = 'unknown') {
        if (service && service.getStats && !this.trackedServices.has(service)) {
            this.trackedServices.add(service);
            console.log(`[DebugOverlay] Registered API service: ${name}`);
        }
    }

    /**
     * Update API statistics in the debug overlay
     */
    updateApiStats() {
        // Collect stats from all registered services and scan for new ones
        this.collectAllApiStats();
        
        // Update the display
        this.set('LLM', 'Characters Sent', this.globalApiStats.totalCharactersSent.toLocaleString());
        this.set('LLM', 'Characters Received', this.globalApiStats.totalCharactersReceived.toLocaleString());
        this.set('LLM', 'Total Requests', this.globalApiStats.totalRequests.toLocaleString());
        this.set('LLM', 'Ratio', `${((this.globalApiStats.totalCharactersReceived / Math.max(this.globalApiStats.totalCharactersSent, 1)) * 100).toFixed(1)}%`);
    }

    /**
     * Collect API stats from all services in the application
     */
    collectAllApiStats() {
        let totalStats = {
            totalCharactersSent: 0,
            totalCharactersReceived: 0,
            totalRequests: 0
        };

        // Collect from all tracked services
        this.trackedServices.forEach(service => {
            try {
                const stats = service.getStats();
                totalStats.totalCharactersSent += stats.totalCharactersSent || 0;
                totalStats.totalCharactersReceived += stats.totalCharactersReceived || 0;
                totalStats.totalRequests += stats.totalRequests || 0;
            } catch (e) {
                console.warn('[DebugOverlay] Error getting stats from service:', e);
                // 记录错误信息到调试面板
                this.set('ERROR', 'Service Stats', e.message);
            }
        });

        // Scan for additional services
        this.scanForApiServices(totalStats);

        // Update global stats
        this.globalApiStats = totalStats;
        
        // 添加系统状态信息
        this.set('SYSTEM', 'Memory Usage', this.formatBytes(this.getMemoryUsage()));
        this.set('SYSTEM', 'Active Services', this.trackedServices.size);
    }

    /**
     * Scan for API services that might not be registered
     */
    scanForApiServices(totalStats) {
        // Check ChatService
        if (window.chatInstance && window.chatInstance.chatService) {
            const stats = window.chatInstance.chatService.apiService.getStats();
            this.addStats(totalStats, stats);
            this.registerApiService(window.chatInstance.chatService.apiService, 'ChatService');
        }

        // Check SceneConfigManager LLM generator
        if (window.sceneConfigManager) {
            const sceneService = window.sceneConfigManager.yamlDataManager?.yamlEditorManager?.promptGenerator?.llmGenerator?.apiService;
            if (sceneService) {
                const stats = sceneService.getStats();
                this.addStats(totalStats, stats);
                this.registerApiService(sceneService, 'SceneConfigManager');
            }
        }

        // Check AnalysisManager
        if (window.chatInstance && window.chatInstance.messageSelectionManager && window.chatInstance.messageSelectionManager.analysisManager) {
            const analysisManager = window.chatInstance.messageSelectionManager.analysisManager;
            const services = [
                analysisManager.customerPsychologyService,
                analysisManager.messageQualityService,
                analysisManager.salesPerformanceService
            ];
            
            services.forEach((service, index) => {
                if (service && service.apiService) {
                    const stats = service.apiService.getStats();
                    this.addStats(totalStats, stats);
                    this.registerApiService(service.apiService, `AnalysisService-${index}`);
                }
            });
        }
    }

    /**
     * Add stats to total
     */
    addStats(totalStats, stats) {
        totalStats.totalCharactersSent += stats.totalCharactersSent || 0;
        totalStats.totalCharactersReceived += stats.totalCharactersReceived || 0;
        totalStats.totalRequests += stats.totalRequests || 0;
    }

    /**
     * Get current memory usage
     */
    getMemoryUsage() {
        if (window.performance && window.performance.memory) {
            return window.performance.memory.usedJSHeapSize;
        }
        return 0;
    }

    /**
     * Format bytes to human readable format
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    toggle() {
        this.isVisible = !this.isVisible;
        if (this.isVisible) {
            this.show();
        } else {
            this.hide();
        }
    }

    show() {
        this.overlay.classList.remove('hidden');
        this.overlay.classList.add('visible');
        this.isVisible = true;
    }

    hide() {
        this.overlay.classList.remove('visible');
        this.overlay.classList.add('hidden');
        this.isVisible = false;
    }

    // Simple interface methods
    set(section, key, value) {
        if (!this.sections.has(section)) {
            this.sections.set(section, new Map());
        }
        this.sections.get(section).set(key, value);
        this.render();
    }

    get(section, key) {
        if (this.sections.has(section)) {
            return this.sections.get(section).get(key);
        }
        return null;
    }

    delete(section, key) {
        if (this.sections.has(section)) {
            this.sections.get(section).delete(key);
            if (this.sections.get(section).size === 0) {
                this.sections.delete(section);
            }
            this.render();
        }
    }

    clearSection(section) {
        this.sections.delete(section);
        this.render();
    }

    clear() {
        this.sections.clear();
        this.render();
    }

    // Format values for display
    formatValue(value) {
        if (value === null || value === undefined) {
            return '<span class="debug-value null">null</span>';
        }
        
        if (typeof value === 'boolean') {
            return `<span class="debug-value boolean">${value}</span>`;
        }
        
        if (typeof value === 'number') {
            return `<span class="debug-value number">${value}</span>`;
        }
        
        if (typeof value === 'string') {
            return `<span class="debug-value string">"${value}"</span>`;
        }
        
        if (typeof value === 'object') {
            return `<span class="debug-value string">${JSON.stringify(value)}</span>`;
        }
        
        return `<span class="debug-value">${String(value)}</span>`;
    }

    render() {
        let html = '';
        
        // Sort sections alphabetically
        const sortedSections = Array.from(this.sections.keys()).sort();
        
        sortedSections.forEach(sectionName => {
            const section = this.sections.get(sectionName);
            html += `<div class="debug-section">`;
            html += `<div class="debug-section-title">${sectionName}</div>`;
            
            // Sort keys alphabetically
            const sortedKeys = Array.from(section.keys()).sort();
            
            sortedKeys.forEach(key => {
                const value = section.get(key);
                html += `<div class="debug-item">`;
                html += `<span class="debug-key">${key}:</span>`;
                html += `<span class="debug-value">${this.formatValue(value)}</span>`;
                html += `</div>`;
            });
            
            html += `</div>`;
        });
        
        this.overlay.innerHTML = html || '<div class="debug-section"><div class="debug-section-title">Debug</div><div class="debug-item"><span class="debug-key">status:</span><span class="debug-value null">no data</span></div></div>';
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        if (this.apiStatsInterval) {
            clearInterval(this.apiStatsInterval);
            this.apiStatsInterval = null;
        }
    }
}

// Global instance for easy access
let debugOverlay = null;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        debugOverlay = new DebugOverlay();
    });
} else {
    debugOverlay = new DebugOverlay();
}

// Simple global interface
window.debug = {
    set: (section, key, value) => {
        if (debugOverlay) {
            debugOverlay.set(section, key, value);
        }
    },
    get: (section, key) => {
        if (debugOverlay) {
            return debugOverlay.get(section, key);
        }
        return null;
    },
    delete: (section, key) => {
        if (debugOverlay) {
            debugOverlay.delete(section, key);
        }
    },
    clear: (section) => {
        if (debugOverlay) {
            if (section) {
                debugOverlay.clearSection(section);
            } else {
                debugOverlay.clear();
            }
        }
    },
    toggle: () => {
        if (debugOverlay) {
            debugOverlay.toggle();
        }
    },
    show: () => {
        if (debugOverlay) {
            debugOverlay.show();
        }
    },
    hide: () => {
        if (debugOverlay) {
            debugOverlay.hide();
        }
    },
    registerApiService: (service, name) => {
        if (debugOverlay) {
            debugOverlay.registerApiService(service, name);
        }
    }
};