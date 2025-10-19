# 提示词结构演示系统 - React版本

这是一个完全使用React + Vite + JavaScript重写的提示词结构演示系统，完全迁移了原项目的核心功能。

## 🚀 功能特性

### ✅ 已完成功能
- **完整的React架构** - 使用React 19 + Hooks + Vite
- **模型配置系统** - 支持多供应商、多模型选择
- **场景配置模块** - YAML编辑器、表单视图、三种映射方式
- **聊天系统** - 消息管理、自动响应、连续对话
- **响应式设计** - 支持桌面和移动设备
- **现代化UI** - 与原项目一致的视觉体验

### 🔄 支持的模型供应商和模型

#### **DeepSeek** (深度求索)
- DeepSeek Chat - 深度思考对话模型
- DeepSeek Reasoner - 推理增强模型

#### **千问** (Qwen)
- Qwen Max - 最强大的通用模型
- Qwen Plus - 高性能通用模型
- Qwen Turbo - 快速响应模型
- Qwen Long - 长文本处理模型
- Qwen3 Max - 第三代最强模型
- Qwen Image Plus - 图像理解模型
- Qwen Flash - 闪电响应模型

#### **ChatGPT** (OpenAI)
- GPT-4o - 多模态旗舰模型
- GPT-4o Mini - 轻量高效版本
- GPT-4 Turbo - 最新优化版本
- GPT-4 - 原版GPT-4模型
- GPT-3.5 Turbo - 快速经济模型
- GPT-5 Chat Latest - 最新GPT-5模型
- GPT-5 Mini/Nano - 迷你版GPT-5

#### **Gemini** (Google)
- Gemini 2.5 Pro - 专业版模型
- Gemini 2.5 Flash - 快速版模型
- Gemini 2.5 Flash Lite - 轻量版模型
- Gemini 2.0 Flash - 第二代快速模型

#### **智谱AI** (Zhipu)
- GLM-4.6 - 最新旗舰模型
- GLM-4.5 - 高性能模型
- GLM-4.5 X - 增强版模型
- GLM-4.5 Flash - 快速响应模型
- GLM-4.5V - 视觉增强模型
- GLM-4.5 Air - 轻量版模型

#### **Claude** (Anthropic)
- Claude Opus 4.1 - 最强创意模型
- Claude Opus 4.0 - 原版Opus模型
- Claude Sonnet 4.5 - 平衡性能模型
- Claude Sonnet 4.0 - 原版Sonnet模型
- Claude 3.7 Sonnet - 最新Sonnet模型

#### **豆包** (Doubao)
- Doubao Seed 1.6 - 种子模型1.6版
- Doubao 1.5 Pro 32K - 专业版32K上下文

## 🛠️ 技术栈

- **React 19** - 现代化前端框架
- **Vite** - 快速构建工具
- **JavaScript (ES6+)** - 无TypeScript版本
- **CSS3** - 现代化样式系统
- **Axios** - HTTP客户端
- **js-yaml** - YAML文件处理

## 📦 安装和运行

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

## 🎯 使用指南

### 1. 配置模型
- 点击右上角"⚙️ 模型设置"
- 为各个供应商配置API密钥
- 选择服务商后点击对应的模型卡片进行选择
- 配置Temperature和Top-P参数

### 2. 编辑场景配置
- 点击"待测试prompt配置"标签页
- 在左侧YAML编辑器中配置顾客画像和场景信息
- 或者使用右侧表单视图进行可视化编辑

### 3. 生成系统提示词
- 选择映射方式：
  - **模板替换** - 使用{{占位符}}进行替换
  - **LLM生成** - 使用AI生成系统提示词
  - **直接输出** - 固定文本输出
- 点击"生成系统提示"按钮

### 4. 应用到聊天
- 点击"应用到主对话"按钮
- 切换到"主对话"标签页开始聊天

### 5. 聊天功能
- **左侧设置按钮** - 鼠标悬停或滑动显示左侧工具栏
- 发送消息与AI对话
- 配置自动响应和连续对话
- 保存和加载聊天记录

## 📁 项目结构

```
src/
├── components/          # React组件
│   ├── App.jsx         # 主应用组件
│   ├── Header.jsx      # 头部组件
│   ├── TabContainer.jsx # 标签页容器
│   ├── Chat.jsx        # 聊天组件
│   ├── ScenarioConfig.jsx # 场景配置组件
│   ├── ModelConfig.jsx # 模型配置组件
│   └── HelpSystem.jsx  # 帮助系统组件
├── services/           # 业务逻辑服务
│   ├── apiService.js   # API通信服务
│   ├── chatService.js  # 聊天业务逻辑
│   └── modelConfigService.js # 模型配置服务
├── config/             # 配置文件
│   └── constants.js    # 项目常量
├── hooks/              # 自定义Hooks（预留）
├── utils/              # 工具函数（预留）
└── App.css             # 全局样式
```

## 🔧 核心组件说明

### ModelConfigService
- 管理所有供应商和模型配置
- 处理API密钥存储和管理
- 提供模型切换功能

### ChatService
- 处理聊天消息管理
- 集成流式API响应
- 支持自动响应和连续对话

### ScenarioConfig
- YAML编辑器和表单视图
- 支持三种提示词生成方式
- 实时预览生成结果

## 🌟 特色功能

- **多供应商支持** - 一站式配置7家主流AI服务商，30+热门模型
- **可视化模型选择** - 点击选择供应商后，可视化模型卡片选择
- **智能场景配置** - 可视化YAML编辑和表单双视图
- **灵活映射方式** - 模板替换、LLM生成、直接输出三种模式
- **实时协作** - 场景配置和聊天系统实时同步
- **现代化架构** - React Hooks + 组件化设计
- **响应式设计** - 完美支持桌面和移动设备交互
- **左侧设置面板** - 鼠标悬停或滑动显示设置面板

## 📝 开发说明

这是一个完全重写的React版本，保留了原项目的全部核心功能，同时采用了现代化的React开发模式：

- **组件化设计** - 每个功能模块都是独立的React组件
- **状态管理** - 使用React Hooks进行状态管理
- **事件通信** - 通过自定义事件实现组件间通信
- **样式系统** - 完整的CSS样式，与原项目视觉一致

## 🔮 未来计划

- [ ] 并行测试模块 - 多模型对比测试
- [ ] 预设管理模块 - 聊天配置保存加载
- [ ] 分析系统 - 客户心理和销售表现分析
- [ ] 调试系统 - 性能监控和错误处理

---

*基于原版提示词结构演示系统，完全使用React + Vite + JavaScript重写*
