import { useState, useEffect, useRef, useCallback } from 'react';
import { ChatService } from '../services/chatService.js';
import { DEFAULT_INITIAL_RESPONSE, DEFAULT_RESPONSE_PROMPT } from '../config/constants.js';

function Chat({ modelConfig }) {
    const [chatService] = useState(() => new ChatService(
        modelConfig?.getApiKeyForProvider(modelConfig.currentProvider),
        modelConfig?.currentModel,
        modelConfig
    ));

    // 监听modelConfig变化
    useEffect(() => {
        if (chatService && modelConfig) {
            chatService.updateModelConfig(modelConfig);
        }
    }, [modelConfig, chatService]);

    const [conversation, setConversation] = useState([]);
    const [systemPrompt, setSystemPrompt] = useState('欢迎使用提示词结构演示系统！请先配置系统提示词。');

    // 从全局状态获取系统提示词更新
    useEffect(() => {
        const handleSystemPromptUpdate = (event) => {
            if (event.detail && event.detail.systemPrompt) {
                setSystemPrompt(event.detail.systemPrompt);
                if (chatService) {
                    chatService.setSystemPrompt(event.detail.systemPrompt);
                }
            }
        };

        window.addEventListener('systemPromptUpdated', handleSystemPromptUpdate);
        return () => window.removeEventListener('systemPromptUpdated', handleSystemPromptUpdate);
    }, [chatService]);
    const [messageInput, setMessageInput] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isAutoResponding, setIsAutoResponding] = useState(false);
    const [isContinuousResponding, setIsContinuousResponding] = useState(false);
    const [isAutoResponseEnabled, setIsAutoResponseEnabled] = useState(false);
    const [isContinuousResponseEnabled, setIsContinuousResponseEnabled] = useState(false);
    const [isToolbarVisible, setIsToolbarVisible] = useState(false);

    // Refs
    const chatContainerRef = useRef(null);
    const messageInputRef = useRef(null);
    const abortControllerRef = useRef(null);

    // 自动响应配置
    const [initialResponse, setInitialResponse] = useState(DEFAULT_INITIAL_RESPONSE);
    const [responsePrompt, setResponsePrompt] = useState(DEFAULT_RESPONSE_PROMPT);
    const [endCondition, setEndCondition] = useState('assistantRegex');
    const [dialogueRoundLimit, setDialogueRoundLimit] = useState(10);
    const [assistantRegexMatch, setAssistantRegexMatch] = useState('<?END_CHAT>');
    const [userRegexMatch, setUserRegexMatch] = useState('');
    const [touchStartX, setTouchStartX] = useState(0);

    useEffect(() => {
        // 当modelConfig变化时更新聊天服务
        if (modelConfig) {
            chatService.updateModelConfig(modelConfig);
        }
    }, [modelConfig, chatService]);

    const renderMessages = useCallback(() => {
        setConversation([...chatService.getConversation()]);
        setSystemPrompt(chatService.getSystemPrompt());
    }, [chatService]);

    const scrollToBottom = useCallback(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, []);

    useEffect(() => {
        renderMessages();
        scrollToBottom();
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [conversation, scrollToBottom]);

    const handleSendMessage = async () => {
        if (!messageInput.trim()) return;
        if (!modelConfig?.validateConfig()) {
            alert('请先配置API密钥');
            return;
        }
        if (!systemPrompt.trim()) {
            alert('请先设置系统提示词');
            return;
        }

        abortControllerRef.current = new AbortController();
        setIsGenerating(true);

        try {
            // 添加用户消息
            chatService.addMessage('user', messageInput.trim());
            renderMessages();

            const userMessage = chatService.getConversation().slice(-1)[0];
            setMessageInput('');

            // 生成机器人响应
            await fetchBotResponse(abortControllerRef.current.signal);
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('发送消息失败:', error);
                alert('发送消息失败: ' + error.message);
            }
        } finally {
            setIsGenerating(false);
            abortControllerRef.current = null;
        }
    };

    const fetchBotResponse = async (signal) => {
        // 添加空的助手消息
        chatService.addMessage('assistant', '');
        renderMessages();

        const botMessage = chatService.getConversation().slice(-1)[0];

        await chatService.fetchBotResponse(
            chatService.getConversation(),
            0.3, // temperature
            0.97, // top_p
            (content) => {
                // 更新消息内容
                botMessage.content = content;
                renderMessages();
            },
            () => {
                setIsGenerating(true);
            },
            signal
        );

        setIsGenerating(false);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const clearChat = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        chatService.setConversation([]);
        renderMessages();
    };

    const saveChat = () => {
        const record = {
            systemPrompt: chatService.getSystemPrompt(),
            conversation: chatService.getConversation()
        };
        const dataStr = JSON.stringify(record, null, 2);
        const blob = new Blob([dataStr], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-record-${new Date().toISOString()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleFileLoad = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const record = JSON.parse(e.target.result);
                if (record.systemPrompt && record.conversation) {
                    if (confirm("是否使用文件中的系统提示覆盖当前的系统提示？")) {
                        chatService.setSystemPrompt(record.systemPrompt);
                    }
                    chatService.setConversation(record.conversation);
                    renderMessages();
                } else {
                    alert("无效的聊天记录文件格式。");
                }
            } catch (err) {
                alert("读取或解析文件时出错: " + err.message);
            }
        };
        reader.readAsText(file);
    };

    const haltGeneration = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        chatService.haltGeneration();
        setIsGenerating(false);
    };

    const startAutoResponse = async () => {
        setIsAutoResponding(true);
        abortControllerRef.current = new AbortController();

        try {
            let autoGeneratedText = '';

            if (chatService.getConversation().length === 0) {
                autoGeneratedText = initialResponse;
                if (!autoGeneratedText) {
                    alert("初始响应不能为空。");
                    return false;
                }
                chatService.addMessage('user', autoGeneratedText);
                renderMessages();
            }

            setIsAutoResponding(false);

            if (autoGeneratedText) {
                await fetchBotResponse(abortControllerRef.current.signal);
            }

            return true;
        } catch (error) {
            if (error.name !== 'AbortError') {
                alert(`自动响应出错: ${error.message}`);
            }
            return false;
        } finally {
            setIsAutoResponding(false);
            abortControllerRef.current = null;
        }
    };

    const checkEndCondition = () => {
        const conversationTurns = Math.floor(conversation.length / 2);
        const lastMessage = conversation[conversation.length - 1];
        const userMessageForRegex = conversation[conversation.length - 2];

        switch (endCondition) {
            case 'roundLimit':
                return conversationTurns >= dialogueRoundLimit;
            case 'assistantRegex':
                if (lastMessage && lastMessage.role === 'assistant') {
                    const regex = new RegExp(assistantRegexMatch);
                    return regex.test(lastMessage.content);
                }
                return false;
            case 'userRegex':
                if (userMessageForRegex && userMessageForRegex.role === 'user') {
                    const regex = new RegExp(userRegexMatch);
                    return regex.test(userMessageForRegex.content);
                }
                return false;
            default:
                return false;
        }
    };

    const startContinuousResponse = async () => {
        setIsContinuousResponding(true);
        
        try {
            while (true) {
                const success = await startAutoResponse();
                if (!success) break;

                await new Promise(resolve => {
                    const check = () => {
                        if (!isGenerating && !isAutoResponding) {
                            resolve();
                        } else {
                            setTimeout(check, 100);
                        }
                    };
                    check();
                });

                if (checkEndCondition()) {
                    console.log("End condition met.");
                    break;
                }
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                alert(`连续响应出错: ${error.message}`);
            }
        } finally {
            setIsContinuousResponding(false);
            renderMessages();
        }
    };

    const handleSendClick = () => {
        if (isContinuousResponding) {
            setIsContinuousResponding(false);
        } else if (isAutoResponding) {
            // 停止自动响应
        } else if (isGenerating) {
            haltGeneration();
        } else if (isContinuousResponseEnabled) {
            startContinuousResponse();
        } else if (isAutoResponseEnabled) {
            startAutoResponse();
        } else {
            handleSendMessage();
        }
    };

    const updateSendButtonState = () => {
        let buttonText = '发送';
        let buttonClass = '';

        if (isContinuousResponding) {
            buttonText = '停止连续响应';
            buttonClass = 'halt-continuous-mode';
        } else if (isAutoResponding) {
            buttonText = '停止自动响应';
            buttonClass = 'halt-auto-mode';
        } else if (isGenerating) {
            buttonText = '停止生成';
            buttonClass = 'halt-mode';
        } else if (isContinuousResponseEnabled) {
            buttonText = '开始连续响应';
            buttonClass = 'continuous-mode';
        } else if (isAutoResponseEnabled) {
            buttonText = '开始自动响应';
            buttonClass = 'autosend-mode';
        }

        return { buttonText, buttonClass };
    };

    const { buttonText, buttonClass } = updateSendButtonState();

    return (
        <div id="chat-tab" className="tab-content active">
            <div
                id="chat-view"
                className={isToolbarVisible ? 'toolbar-visible' : ''}
                onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const mouseX = e.clientX - rect.left;
                    const triggerWidth = 30;

                    if (mouseX < triggerWidth && !isToolbarVisible) {
                        setIsToolbarVisible(true);
                    }
                }}
                onMouseLeave={() => {
                    setIsToolbarVisible(false);
                }}
                onTouchStart={(e) => {
                    setTouchStartX(e.changedTouches[0].screenX);
                }}
                onTouchEnd={(e) => {
                    const touchEndX = e.changedTouches[0].screenX;
                    const swipeDistance = touchEndX - touchStartX;
                    const swipeThreshold = 50;

                    if (swipeDistance > swipeThreshold && !isToolbarVisible) {
                        setIsToolbarVisible(true);
                    } else if (swipeDistance < -swipeThreshold && isToolbarVisible) {
                        setIsToolbarVisible(false);
                    }
                }}
            >
                {/* 左侧工具栏 */}
                <div id="left-toolbar">
                    <div className="setting">
                        <label htmlFor="initial-response">初始响应</label>
                        <textarea
                            id="initial-response"
                            value={initialResponse}
                            onChange={(e) => setInitialResponse(e.target.value)}
                            placeholder="自动响应机制的第一条消息"
                        />
                    </div>
                    <div className="setting">
                        <label htmlFor="response-prompt">响应提示</label>
                        <textarea
                            id="response-prompt"
                            value={responsePrompt}
                            onChange={(e) => setResponsePrompt(e.target.value)}
                            placeholder="操控自动响应机制的提示词"
                        />
                    </div>
                    <div className="toggle-switch">
                        <input
                            type="checkbox"
                            id="auto-response-toggle"
                            checked={isAutoResponseEnabled}
                            onChange={(e) => setIsAutoResponseEnabled(e.target.checked)}
                        />
                        <label htmlFor="auto-response-toggle" className="slider"></label>
                        <label htmlFor="auto-response-toggle">启用自动响应</label>
                    </div>
                    <div className="toggle-switch">
                        <input
                            type="checkbox"
                            id="continuous-response-toggle"
                            checked={isContinuousResponseEnabled}
                            onChange={(e) => setIsContinuousResponseEnabled(e.target.checked)}
                            disabled={!isAutoResponseEnabled}
                        />
                        <label htmlFor="continuous-response-toggle" className="slider"></label>
                        <label htmlFor="continuous-response-toggle">启用连续响应</label>
                    </div>

                    {isContinuousResponseEnabled && (
                        <div id="end-condition-container" className="setting">
                            <label htmlFor="end-condition-select">结束条件</label>
                            <select
                                id="end-condition-select"
                                value={endCondition}
                                onChange={(e) => setEndCondition(e.target.value)}
                            >
                                <option value="roundLimit">对话轮次限制</option>
                                <option value="assistantRegex">助教正则匹配</option>
                                <option value="userRegex">用户正则匹配</option>
                            </select>

                            {endCondition === 'roundLimit' && (
                                <div>
                                    <input
                                        type="number"
                                        id="dialogue-round-limit-input"
                                        value={dialogueRoundLimit}
                                        onChange={(e) => setDialogueRoundLimit(parseInt(e.target.value))}
                                        min="1"
                                    />
                                </div>
                            )}

                            {endCondition === 'assistantRegex' && (
                                <div>
                                    <input
                                        type="text"
                                        id="assistant-regex-match-input"
                                        value={assistantRegexMatch}
                                        onChange={(e) => setAssistantRegexMatch(e.target.value)}
                                        placeholder="输入正则表达式"
                                    />
                                </div>
                            )}

                            {endCondition === 'userRegex' && (
                                <div>
                                    <input
                                        type="text"
                                        id="user-regex-match-input"
                                        value={userRegexMatch}
                                        onChange={(e) => setUserRegexMatch(e.target.value)}
                                        placeholder="输入正则表达式"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 消息区域 */}
                <div id="bubble-region">
                    <div
                        id="chat-container"
                        ref={chatContainerRef}
                        style={{ padding: '20px', overflowY: 'auto' }}
                    >
                        {/* 系统提示词显示 */}
                        {systemPrompt && (
                            <div className="message system-prompt-message" style={{
                                opacity: 0.6,
                                maxWidth: '90%',
                                alignSelf: 'center',
                                borderStyle: 'dashed',
                                backgroundColor: '#f5f5f5',
                                color: '#222'
                            }}>
                                <span>{systemPrompt}</span>
                            </div>
                        )}

                        {/* 对话消息 */}
                        {conversation.map((message) => (
                            <div
                                key={message.id}
                                className={`message ${message.role}-message`}
                                data-id={message.id}
                            >
                                <span>{message.content || '...'}</span>
                                {isGenerating && message === conversation[conversation.length - 1] && message.role === 'assistant' && (
                                    <div style={{opacity: 0.7, fontSize: '12px', marginTop: '5px'}}>
                                        正在生成中...
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 输入区域 */}
            <div id="input-container">
                <button id="clear-chat-button" onClick={clearChat}>
                    清除
                </button>
                <textarea
                    id="message-input"
                    ref={messageInputRef}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="输入您的消息..."
                    disabled={isGenerating}
                />
                <input
                    type="file"
                    id="load-chat-input"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={handleFileLoad}
                />
                <button id="load-chat-button" onClick={() => document.getElementById('load-chat-input').click()}>
                    读取记录
                </button>
                <button id="save-chat-button" onClick={saveChat}>
                    保存记录
                </button>
                <button
                    id="send-button"
                    className={buttonClass}
                    onClick={handleSendClick}
                    disabled={isGenerating && !isAutoResponding}
                >
                    {buttonText}
                </button>
            </div>
        </div>
    );
}

export default Chat;