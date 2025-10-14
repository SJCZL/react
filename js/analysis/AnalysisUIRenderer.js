/**
 * Analysis UI Components
 * Handles rendering of analysis results in the info panel
 */

import { ANALYSIS_CONFIG } from './AnalysisConfig.js';

export class AnalysisUIRenderer {
    constructor() {
        this.templates = this.createTemplates();
    }

    /**
     * Create HTML templates for different analysis types
     */
    createTemplates() {
        return {
            loading: `
                <div class="analysis-loading">
                    <div class="loading-spinner"></div>
                    <p>正在分析中...</p>
                </div>
            `,
            
            error: (error) => `
                <div class="analysis-error">
                    <div class="error-icon">ERROR</div>
                    <p>分析失败</p>
                    <small>${error}</small>
                </div>
            `,
            
            customerPsychology: (analysis) => {
                if (!analysis || !analysis.aggregatedScores) {
                    return '<div class="analysis-no-data">暂无心理分析数据</div>';
                }
                
                const { aggregatedScores, expertScores } = analysis;
                
                return `
                    <div class="analysis-section customer-psychology">
                        <h3>客户心理分析</h3>
                        
                        <div class="psychology-scores">
                            ${this.createPsychologyScore('trust', aggregatedScores.trust)}
                            ${this.createPsychologyScore('urgency', aggregatedScores.urgency)}
                            ${this.createPsychologyScore('priceSensitivity', aggregatedScores.priceSensitivity)}
                            ${this.createPsychologyScore('brandAspiration', aggregatedScores.brandAspiration)}
                            ${this.createPsychologyScore('decisionFatigue', aggregatedScores.decisionFatigue)}
                        </div>
                        
                        ${this.createExpertBreakdown(expertScores)}
                    </div>
                `;
            },
            
            messageQuality: (analysis) => {
                if (!analysis) {
                    return '<div class="analysis-no-data">暂无质量分析数据</div>';
                }
                
                return `
                    <div class="analysis-section message-quality">
                        <h3>消息质量评估</h3>
                        <div class="quality-scores">
                            ${this.createQualityScore('humanLike', analysis.humanLikeScore, '人性化程度')}
                            ${this.createQualityScore('botDetection', analysis.botDetectionScore, 'AI检测概率')}
                            ${this.createQualityScore('melodramatic', analysis.melodramaticScore, '戏剧化程度')}
                            ${this.createQualityScore('promptAdherence', analysis.promptAdherenceScore, '提示词遵循度')}
                            ${this.createQualityScore('realisticReaction', analysis.realisticReactionScore, '反应真实性')}
                        </div>
                        <div class="quality-analysis">
                            <h4>详细分析:</h4>
                            <p>${analysis.analysis || '暂无详细分析'}</p>
                        </div>
                    </div>
                `;
            },
            
            salesPerformance: (analysis) => {
                if (!analysis) {
                    return '<div class="analysis-no-data">暂无销售表现数据</div>';
                }
                
                return `
                    <div class="analysis-section sales-performance">
                        <h3>销售表现评估</h3>
                        <div class="performance-overview">
                            <div class="overall-score">
                                
                                <div class="score-circle">
                                    <span class="score-value">${Math.round(analysis.overallScore * 100)}</span>
                                </div>
                            </div>
                        </div>
                        
                        ${this.createExpertRatings(analysis.expertRatings)}
                        
                        ${analysis.techniquesUsed && analysis.techniquesUsed.length > 0 ? `
                            <div class="techniques-used">
                                <h4>使用技巧:</h4>
                                <ul class="technique-list">
                                    ${analysis.techniquesUsed.map(technique => `<li>${technique}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                        
                        ${analysis.suggestions && analysis.suggestions.length > 0 ? `
                            <div class="suggestions">
                                <h4>改进建议:</h4>
                                <ul class="suggestion-list">
                                    ${analysis.suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                        
                        <div class="performance-analysis">
                            <h4>详细分析:</h4>
                            <p>${analysis.analysis || '暂无详细分析'}</p>
                        </div>
                    </div>
                `;
            }
        };
    }

    /**
     * Create individual psychology score component
     */
    createPsychologyScore(key, score) {
        const labels = {
            trust: '信任度',
            urgency: '需求紧迫性',
            priceSensitivity: '价格敏感度',
            brandAspiration: '品牌追求',
            decisionFatigue: '决策疲劳'
        };
        
        const descriptions = {
            trust: '对销售人员的信任程度',
            urgency: '对产品需求的紧迫程度',
            priceSensitivity: '对价格的敏感程度',
            brandAspiration: '对品牌的追求程度',
            decisionFatigue: '决策疲劳程度'
        };
        
        return `
            <div class="psychology-score">
                <div class="score-header">
                    <span class="score-label">${labels[key]}</span>
                    <span class="score-value">${score !== undefined ? score.toFixed(1) : 'N/A'}</span>
                </div>
                <div class="score-bar">
                    <div class="score-fill" style="width: ${(score || 0) * 10}%"></div>
                </div>
                <div class="score-description">${descriptions[key]}</div>
            </div>
        `;
    }

    /**
     * Create individual quality score component
     */
    createQualityScore(key, score, label) {
        return `
            <div class="quality-score">
                <div class="score-header">
                    <span class="score-label">${label}</span>
                    <span class="score-value">${Math.round(score * 100)}%</span>
                </div>
                <div class="score-bar">
                    <div class="score-fill" style="width: ${score * 100}%"></div>
                </div>
            </div>
        `;
    }

    /**
     * Create expert ratings section for sales performance
     */
    createExpertRatings(expertRatings) {
        if (!expertRatings || Object.keys(expertRatings).length === 0) return '';
        
        return `
            <div class="expert-ratings">
                <h4>专家评分</h4>
                <div class="expert-rating-grid">
                    ${Object.entries(expertRatings).map(([expertName, rating]) => {
                        const expertConfig = ANALYSIS_CONFIG.SALES_RATING_EXPERTS.find(e => e.name === expertName);
                        const expertType = expertConfig ? expertConfig.type : 'unknown';
                        
                        return `
                            <div class="expert-rating-card ${expertType}">
                                <div class="expert-rating-header">
                                    <div class="expert-info">
                                        <div class="expert-name">${expertName}</div>
                                        <div class="expert-type">${expertType === 'gentle' ? '温和型' : '严格型'}</div>
                                    </div>
                                    <div class="expert-score-display">
                                        <span class="expert-score-value">${rating.score}</span>
                                    </div>
                                </div>
                                <div class="expert-review">
                                    <div class="review-label"> </div>
                                    <div class="review-text">${rating.review || '不予置评'}</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Create expert breakdown section
     */
    createExpertBreakdown(expertScores) {
        const experts = Object.keys(expertScores);
        if (experts.length === 0) return '';
        
        return `
            <div class="expert-breakdown">
                <h4>专家评分详情</h4>
                <div class="expert-list">
                    ${experts.map(expert => {
                        const scores = expertScores[expert];
                        return `
                            <div class="expert-item">
                                <div class="expert-name">${expert}</div>
                                <div class="expert-scores">
                                    <span>信任: ${scores.trust?.toFixed(1) || 'N/A'}</span>
                                    <span>紧迫: ${scores.urgency?.toFixed(1) || 'N/A'}</span>
                                    <span>价格: ${scores.priceSensitivity?.toFixed(1) || 'N/A'}</span>
                                    <span>品牌: ${scores.brandAspiration?.toFixed(1) || 'N/A'}</span>
                                    <span>疲劳: ${scores.decisionFatigue?.toFixed(1) || 'N/A'}</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render analysis for a message
     */
    renderAnalysis(messageInfo, container) {
        if (!messageInfo) {
            container.innerHTML = '<div class="analysis-no-data">选择一个消息以查看分析</div>';
            return;
        }
        
        // Show loading state
        if (messageInfo.analysisState === ANALYSIS_CONFIG.ANALYSIS_STATE.GENERATING || 
            messageInfo.analysisState === ANALYSIS_CONFIG.ANALYSIS_STATE.RETRYING) {
            container.innerHTML = this.templates.loading;
            return;
        }
        
        // Show error state
        if (messageInfo.analysisState === ANALYSIS_CONFIG.ANALYSIS_STATE.ERROR) {
            container.innerHTML = this.templates.error(messageInfo.error || '分析失败');
            return;
        }
        
        // Show analysis results
        let html = '';
        
        // Customer psychology analysis (for assistant messages)
        if (messageInfo.customerPsychology) {
            html += this.templates.customerPsychology(messageInfo.customerPsychology);
        }
        
        // Message quality analysis (for assistant messages)
        if (messageInfo.messageQuality) {
            html += this.templates.messageQuality(messageInfo.messageQuality);
        }
        
        // Sales performance analysis (for user messages)
        if (messageInfo.salesPerformance) {
            html += this.templates.salesPerformance(messageInfo.salesPerformance);
        }
        
        // No analysis data available
        if (!html) {
            html = '<div class="analysis-no-data">暂无分析数据<br><small>按 Alt+R 开始分析</small></div>';
        }
        
        container.innerHTML = html;
        
        // Add interactivity
        this.addInteractivity(container);
    }

    /**
     * Add interactive elements to rendered analysis
     */
    addInteractivity(container) {
        // Add click handlers for expert details toggle
        const expertHeaders = container.querySelectorAll('.expert-breakdown h4');
        expertHeaders.forEach(header => {
            header.style.cursor = 'pointer';
            header.addEventListener('click', () => {
                const breakdown = header.nextElementSibling;
                if (breakdown) {
                    breakdown.style.display = breakdown.style.display === 'none' ? 'block' : 'none';
                }
            });
        });
        
        // Add tooltips for score descriptions
        const scoreDescriptions = container.querySelectorAll('.score-description');
        scoreDescriptions.forEach(desc => {
            desc.title = desc.textContent;
        });
    }

    /**
     * Update analysis state in UI
     */
    updateAnalysisState(messageInfo, container) {
        const existingContent = container.innerHTML;
        
        // Don't update if there's detailed content (preserve user interaction)
        if (existingContent.includes('expert-breakdown') || existingContent.length > 500) {
            return;
        }
        
        this.renderAnalysis(messageInfo, container);
    }
}