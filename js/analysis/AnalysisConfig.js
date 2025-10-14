/**
 * Analysis System Configuration
 * Central configuration for all analysis features
 */

export const ANALYSIS_CONFIG = {
    // Expert judge nicknames for customer psychology analysis
    EXPERT_JUDGE_NICKNAMES: [
        '陈博士', '王教授', '李博士', '张博士'
    ],
    
    // Sales performance rating experts
    SALES_RATING_EXPERTS: [
        {
            name: '温和导师-刘教练',
            type: 'gentle',
            style: '鼓励型教练，注重发现优点和潜力，评分相对宽松',
            approach: '强调进步空间和积极因素，给予建设性的温和反馈'
        },
        {
            name: '支持型顾问-陈顾问',
            type: 'gentle',
            style: '以客户为中心的顾问，重视销售代表的努力和意图',
            approach: '从同理心角度评估，认可尝试和努力，给予鼓励性评价'
        },
        {
            name: '严格导师-王总监',
            type: 'harsh',
            style: '高标准严要求的前销售总监，注重细节和完美执行',
            approach: '以行业最高标准评估，对任何瑕疵都要求改进，追求卓越'
        },
        {
            name: '批判型分析师-李分析师',
            type: 'harsh',
            style: '数据驱动的分析师，专注于效率和结果导向',
            approach: '以成交效果为唯一标准，对无效沟通和浪费时间零容忍'
        }
    ],
    
    
    // Customer psychology variables
    PSYCHOLOGY_VARIABLES: {
        TRUST: {
            key: 'trust',
            name: '对销售代表的信任度',
            description: '客户相信销售代表诚实、有能力并为客户最佳利益着想的程度',
            min: 0,
            max: 10
        },
        URGENCY: {
            key: 'urgency',
            name: '需求紧迫性',
            description: '客户当前感受到产品能解决的痛点或需求的强烈程度',
            min: 0,
            max: 10
        },
        PRICE_SENSITIVITY: {
            key: 'priceSensitivity',
            name: '价格敏感度',
            description: '客户在价格与其他利益之间的权衡程度（0 = "价格不是问题"，10 = "每一分钱都很重要"）',
            min: 0,
            max: 10
        },
        BRAND_ASPIRATION: {
            key: 'brandAspiration',
            name: '品牌/地位期望',
            description: '客户对拥有品牌所带来的社会形象或自我提升的重视程度',
            min: 0,
            max: 10
        },
        DECISION_FATIGUE: {
            key: 'decisionFatigue',
            name: '决策疲劳度',
            description: '客户的精神负担或不耐烦程度；分数越高越可能拖延、委托或放弃购买',
            min: 0,
            max: 10
        }
    },
    
    // Default analysis settings
    DEFAULT_SETTINGS: {
        expertCount: 4,
        autoGenerate: true,
        customerPsychologyModel: 'qwen3-30b-a3b-thinking-2507',
        messageQualityModel: 'qwen3-30b-a3b-thinking-2507',
        salesPerformanceModel: 'qwen3-30b-a3b-thinking-2507',
        analysisTemperature: 0.7,
        retryCount: 3,
        timeoutMs: 30000
    },
    
    // Analysis state enum
    ANALYSIS_STATE: {
        PENDING: 'pending',
        GENERATING: 'generating',
        COMPLETED: 'completed',
        ERROR: 'error',
        RETRYING: 'retrying'
    }
};

// Extended message info structure
export class ExtendedMessageInfo {
    constructor(messageId) {
        this.messageId = messageId;
        this.customerPsychology = null;
        this.messageQuality = null;
        this.salesPerformance = null;
        this.customerRoleAssessment = null;
        this.salesRoleAssessment = null;
        this.analysisState = ANALYSIS_CONFIG.ANALYSIS_STATE.PENDING;
        this.lastUpdated = null;
        this.error = null;
        this.retryCount = 0;
    }
}

// Customer psychology analysis result
export class CustomerPsychologyAnalysis {
    constructor() {
        this.expertScores = {}; // { expertNickname: { trust, urgency, priceSensitivity, brandAspiration, decisionFatigue } }
        this.aggregatedScores = {}; // { trust, urgency, priceSensitivity, brandAspiration, decisionFatigue }
        this.confidence = 0; // Overall confidence score 0-1
        this.analysisTimestamp = null;
    }
}

// Message quality analysis result
export class MessageQualityAnalysis {
    constructor() {
        this.humanLikeScore = 0; // 0-1 score
        this.botDetectionScore = 0; // 0-1 score
        this.melodramaticScore = 0; // 0-1 score
        this.promptAdherenceScore = 0; // 0-1 score
        this.realisticReactionScore = 0; // 0-1 score
        this.analysis = ''; // Textual analysis
        this.analysisTimestamp = null;
    }
}

// Sales performance analysis result
export class SalesPerformanceAnalysis {
    constructor() {
        this.expertRatings = {}; // { expertName: { score: 0-100, review: "concise review" } }
        this.overallScore = 0; // 0-1 score (average of expert scores)
        this.techniquesUsed = []; // Array of identified techniques
        this.suggestions = []; // Array of improvement suggestions
        this.analysis = ''; // Textual analysis
        this.analysisTimestamp = null;
    }
}