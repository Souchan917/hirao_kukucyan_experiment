// frontend-chat.js

import { saveMessage, saveSummaryData } from "../libs/firebase.js";

console.log("=== frontend-chat.js 読み込み開始 ===");

// 定数定義
const STORAGE_KEYS = {
    SESSION: 'kukuchan_session_id',
    SUMMARY: 'kukuchan_chat_summary'
};

// DOM要素の取得
const apiUrl = "/api/chat";
const chatContainer = document.getElementById("chatContainer");
const questionInput = document.getElementById("questionInput");
const sendButton = document.getElementById("sendQuestion");
const resetButton = document.getElementById("resetChat");
const endChatButton = document.getElementById("endChat");
const surveyForm = document.getElementById("survey-form");
const submitSurveyButton = document.getElementById("submitSurvey");
const loadingState = document.getElementById("loading-state");

// 評価ボタングループの取得
const visitCountButtons = surveyForm.querySelectorAll('input[name="visitCount"]');
const satisfactionButtons = surveyForm.querySelectorAll('input[name="satisfaction"]');
const personalizedButtons = surveyForm.querySelectorAll('input[name="personalization"]');
const comparisonButtons = surveyForm.querySelectorAll('input[name="comparison"]');
const intentionButtons = surveyForm.querySelectorAll('input[name="intention"]');
const ageButtons = surveyForm.querySelectorAll('input[name="age"]');
const genderButtons = surveyForm.querySelectorAll('input[name="gender"]');
const occupationButtons = surveyForm.querySelectorAll('input[name="occupation"]');
const experienceButtons = surveyForm.querySelectorAll('input[name="experience"]');
const feedbackTextarea = document.getElementById('feedback');

// 状態管理
let state = {
    isSubmitting: false,
    lastMessageEvaluated: true,
    currentSummary: '',
    surveyAnswers: {
        visitCount: '',
        satisfaction: 0,
        personalization: 0,
        comparison: 0,
        intention: 0,
        age: 0,
        gender: '',
        occupation: '',
        experience: '',
        feedback: ''
    },
    sessionData: {
        messages: [],
        ratings: [],
        startTime: new Date()
    }
};

// サマリー管理の関数
const summaryManager = {
    getCurrentSummary() {
        return localStorage.getItem(STORAGE_KEYS.SUMMARY) || '';
    },

    saveSummary(summary) {
        localStorage.setItem(STORAGE_KEYS.SUMMARY, summary);
        state.currentSummary = summary;
        // console.log('新しい会話まとめを保存:', summary);
    },

    clearSummary() {
        localStorage.removeItem(STORAGE_KEYS.SUMMARY);
        state.currentSummary = '';
        console.log('会話まとめをクリアしました');
    }
};

// セッション管理の関数
function getOrCreateSessionId(forceNew = false) {
    if (forceNew) {
        summaryManager.clearSummary();
        const newSessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem(STORAGE_KEYS.SESSION, newSessionId);
        document.cookie = `sessionId=${newSessionId}; path=/`;
        // セッションデータもリセット
        state.sessionData = {
            messages: [],
            ratings: [],
            startTime: new Date()
        };
        console.log("新しいセッションIDを生成:", newSessionId);
        return newSessionId;
    }

    let sessionId = sessionStorage.getItem(STORAGE_KEYS.SESSION);
    if (!sessionId) {
        summaryManager.clearSummary();
        sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem(STORAGE_KEYS.SESSION, sessionId);
        document.cookie = `sessionId=${sessionId}; path=/`;
        console.log("新しいセッションIDを生成:", sessionId);
    }
    
    return sessionId;
}

// レーティング関連の関数
function createRatingContainer() {
    const container = document.createElement("div");
    container.className = "rating-container";
    container.style.cssText = `
        text-align: center;
        margin: 10px 0;
        padding: 10px;
        border-radius: 5px;
        background-color: #f8f9fa;
    `;
    return container;
}

function createRatingText() {
    const text = document.createElement("div");
    text.textContent = "この回答を評価してください。評価すると次のチャットを送ることができます。";
    text.style.cssText = `
        margin-bottom: 10px;
        color: #666;
        font-size: 0.9rem;
    `;
    return text;
}

function createButtonsContainer() {
    const container = document.createElement("div");
    container.style.cssText = `
        display: flex;
        justify-content: center;
        gap: 20px;
    `;
    return container;
}

function createRatingButtons() {
    const goodBtn = document.createElement("button");
    const badBtn = document.createElement("button");

    const buttonStyle = `
        display: flex;
        align-items: center;
        padding: 8px 16px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: white;
        cursor: pointer;
        color: #333;
        transition: all 0.2s;
    `;

    goodBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
        </svg>
        <span style="margin-left: 5px;">Good</span>
    `;

    badBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
        </svg>
        <span style="margin-left: 5px;">Bad</span>
    `;

    goodBtn.style.cssText = buttonStyle;
    badBtn.style.cssText = buttonStyle;

    setupRatingButtonEvents(goodBtn, badBtn);

    return { goodBtn, badBtn };
}

function createMinimizedRating(rating) {
    const container = document.createElement("div");
    container.style.cssText = `
        text-align: right;
        margin: 5px 0;
        font-size: 0.8rem;
        color: ${rating === 'good' ? '#34a853' : '#ea4335'};
    `;

    const icon = document.createElement("span");
    icon.innerHTML = rating === 'good' ? '👍' : '👎';
    icon.style.fontSize = '0.8rem';
    
    container.appendChild(icon);
    return container;
}

function setupRatingButtonEvents(goodBtn, badBtn) {
    const content = chatContainer.lastElementChild.textContent;

    goodBtn.onmouseover = () => goodBtn.style.backgroundColor = '#f8f9fa';
    goodBtn.onmouseout = () => goodBtn.style.backgroundColor = 'white';
    badBtn.onmouseover = () => badBtn.style.backgroundColor = '#f8f9fa';
    badBtn.onmouseout = () => badBtn.style.backgroundColor = 'white';

    goodBtn.onclick = async () => await handleRating('good', content, goodBtn, badBtn);
    badBtn.onclick = async () => await handleRating('bad', content, badBtn, goodBtn);
}




// テキストエリアの自動調整
document.addEventListener("DOMContentLoaded", () => {
    const textarea = document.getElementById("questionInput");

    textarea.addEventListener("input", function () {
        this.style.height = "auto"; // 高さをリセット
        this.style.height = this.scrollHeight + "px"; // 必要な高さに設定
    });
});





// メッセージ追加関数
function addMessage(content, type, messageType = null) {  // messageType パラメータを追加
    const messageDiv = document.createElement("div");
    messageDiv.className = type === "user" ? "user-message" : "ai-message";
    messageDiv.textContent = type === "ai" ? JSON.parse(content).message : content;  // AI の場合は message を取り出す
    chatContainer.appendChild(messageDiv);

    // セッションデータに追加（分類結果も含める）
    const messageData = {
        content: content,
        type: type,
        timestamp: new Date()
    };

    if (type === "ai") {
        try {
            const parsedContent = JSON.parse(content);
            messageData.messageType = parsedContent.messageType;  // 分類結果を保存
        } catch (e) {
            console.log("メッセージのパースに失敗:", e);
        }
    }

    state.sessionData.messages.push(messageData);

    if (type === "ai") {
        state.lastMessageEvaluated = false;
        const ratingContainer = createRatingContainer();
        const ratingText = createRatingText();
        const buttonsContainer = createButtonsContainer();
        const { goodBtn, badBtn } = createRatingButtons();

        buttonsContainer.appendChild(goodBtn);
        buttonsContainer.appendChild(badBtn);
        ratingContainer.appendChild(ratingText);
        ratingContainer.appendChild(buttonsContainer);
        chatContainer.appendChild(ratingContainer);

        questionInput.disabled = true;
        sendButton.disabled = true;
    }

    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// メッセージ送信関数を修正
async function sendMessage() {
    if (state.isSubmitting || !state.lastMessageEvaluated) {
        if (!state.lastMessageEvaluated) {
            alert("前の回答の評価をお願いします。");
        }
        return;
    }

    const message = questionInput.value.trim();
    if (!message) {
        alert("メッセージを入力してください。");
        return;
    }

    state.isSubmitting = true;
    questionInput.disabled = true;
    sendButton.disabled = true;
    loadingState.style.display = "flex";

    try {
        const sessionId = getOrCreateSessionId();
        addMessage(message, "user");
        await saveMessage(message, "user", sessionId);

        const currentSummary = summaryManager.getCurrentSummary();
        
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Session-ID": sessionId
            },
            body: JSON.stringify({ 
                userMessage: message,
                conversationSummary: currentSummary
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.summary) {
            summaryManager.saveSummary(data.summary);
        }

        // AIの返答を保存する時に分類結果も含める
        const aiMessageContent = {
            message: data.reply,
            messageType: data.type, // 分類結果を追加
            timestamp: new Date().toISOString()
        };

        const aiMessageString = JSON.stringify(aiMessageContent);
        addMessage(aiMessageString, "ai");  // 文字列化したメッセージを渡す
        await saveMessage(aiMessageString, "ai", sessionId);

        // 成功した場合のみ入力をクリア
        questionInput.value = "";

    } catch (error) {
        console.error("チャットフロー内でエラー:", error);
       
        alert("うまく処理できませんでした。もう一度「送信」を押してください。");

        addMessage("うまく処理できませんでした。もう一度「送信」を押してください。", "ai");
    } finally {
        state.isSubmitting = false;
        questionInput.disabled = false;
        sendButton.disabled = false;
        loadingState.style.display = "none";
    }
}
// 評価処理関数
async function handleRating(rating, content, activeBtn, inactiveBtn) {
    try {
        const sessionId = getOrCreateSessionId();
        const ratingData = {
            rating: rating,
            message: content,
            timestamp: new Date().toISOString()
        };

        // セッションデータに追加
        state.sessionData.ratings.push(ratingData);

        await saveMessage(JSON.stringify(ratingData), "rating", sessionId);
        
        const container = activeBtn.closest('.rating-container');
        const minimizedRating = createMinimizedRating(rating);
        container.parentNode.replaceChild(minimizedRating, container);
        
        state.lastMessageEvaluated = true;
        questionInput.disabled = false;
        sendButton.disabled = false;
        
    } catch (error) {
        console.error("評価保存エラー:", error);
        alert("評価の保存に失敗しました。もう一度お試しください。");
    }
}

// アンケートのリセット処理
function resetSurveySelections() {
    // チャット関連の評価をリセット（毎回リセットする項目）
    const resetTargets = [
        'satisfaction',
        'personalization',
        'comparison',
        'intention',
        'visitCount'
    ];

    resetTargets.forEach(name => {
        const radioButtons = document.querySelectorAll(`input[name="${name}"]`);
        radioButtons.forEach(radio => {
            radio.checked = false;
        });
        state.surveyAnswers[name] = 0;
    });

    if (feedbackTextarea) {
        feedbackTextarea.value = '';
        state.surveyAnswers.feedback = '';
    }
}

// アンケート関連の関数
function setupRatingButtons() {
    const buttonGroups = [
        { buttons: visitCountButtons, name: 'visitCount' },
        { buttons: satisfactionButtons, name: 'satisfaction' },
        { buttons: personalizedButtons, name: 'personalization' },
        { buttons: comparisonButtons, name: 'comparison' },
        { buttons: intentionButtons, name: 'intention' },
        { buttons: ageButtons, name: 'age' },
        { buttons: genderButtons, name: 'gender' },
        { buttons: occupationButtons, name: 'occupation' },
        { buttons: experienceButtons, name: 'experience' }
    ];

    buttonGroups.forEach(group => {
        group.buttons.forEach(button => {
            button.addEventListener('change', function() {
                state.surveyAnswers[group.name] = this.value;
            });
        });
    });

    if (feedbackTextarea) {
        feedbackTextarea.addEventListener('input', function() {
            state.surveyAnswers.feedback = this.value.trim();
        });
    }
}

async function submitSurvey(event) {
    event.preventDefault();

    const unansweredCategories = [];
    if (!state.surveyAnswers.visitCount) unansweredCategories.push('利用回数');
    if (state.surveyAnswers.satisfaction === 0) unansweredCategories.push('満足度');
    if (state.surveyAnswers.personalization === 0) unansweredCategories.push('個別化された回答');
    if (state.surveyAnswers.comparison === 0) unansweredCategories.push('比較');
    if (state.surveyAnswers.intention === 0) unansweredCategories.push('意図の理解');
    if (state.surveyAnswers.age === 0) unansweredCategories.push('年代');
    if (!state.surveyAnswers.gender) unansweredCategories.push('性別');
    if (!state.surveyAnswers.occupation) unansweredCategories.push('職業');
    if (!state.surveyAnswers.experience) unansweredCategories.push('経験年数');

    if (unansweredCategories.length > 0) {
        alert(`以下の項目が未回答です：\n${unansweredCategories.join('\n')}`);
        return;
    }

    try {
        submitSurveyButton.disabled = true;
        submitSurveyButton.textContent = '送信中...';

        const sessionId = getOrCreateSessionId();

        // メッセージと分類結果を含むチャット履歴の作成
        const enhancedChatHistory = state.sessionData.messages.map(msg => {
            if (msg.type === "ai") {
                try {
                    const messageContent = JSON.parse(msg.content);
                    return {
                        content: messageContent.message,
                        type: msg.type,
                        timestamp: msg.timestamp,
                        messageType: messageContent.messageType || "unknown",
                        classification: {
                            type: messageContent.messageType,
                            timestamp: msg.timestamp
                        }
                    };
                } catch (e) {
                    console.log("AIメッセージのパースに失敗:", e);
                    return {
                        ...msg,
                        messageType: "unknown"
                    };
                }
            }
            return {
                ...msg,
                messageType: "user"
            };
        });

        // メッセージ分類の集計
        const classificationCounts = enhancedChatHistory.reduce((acc, msg) => {
            if (msg.messageType && msg.messageType !== "user") {
                acc[msg.messageType] = (acc[msg.messageType] || 0) + 1;
            }
            return acc;
        }, {});

        // 会話の詳細な統計情報
        const conversationStats = {
            messageCount: {
                total: enhancedChatHistory.length,
                user: enhancedChatHistory.filter(m => m.type === "user").length,
                ai: enhancedChatHistory.filter(m => m.type === "ai").length
            },
            classifications: classificationCounts,
            ratingsStats: {
                total: state.sessionData.ratings.length,
                good: state.sessionData.ratings.filter(r => r.rating === "good").length,
                bad: state.sessionData.ratings.filter(r => r.rating === "bad").length
            },
            timing: {
                startTime: state.sessionData.startTime.toISOString(),
                endTime: new Date().toISOString(),
                durationSeconds: Math.round((new Date() - state.sessionData.startTime) / 1000)
            }
        };

        // 完全なセッションサマリーデータの作成

        const summaryData = {
            sessionId: sessionId,
            // チャット履歴（分類結果を含む）
            chatHistory: state.sessionData.messages.map(msg => {
                if (msg.type === "ai") {
                    try {
                        const messageContent = JSON.parse(msg.content);
                        return {
                            content: messageContent.message,
                            type: msg.type,
                            timestamp: msg.timestamp,
                            messageType: messageContent.messageType || "unknown",
                        };
                    } catch (e) {
                        return msg;
                    }
                }
                return msg;
            }),
            
            // チャットの評価履歴
            ratings: state.sessionData.ratings,
            conversationSummary: summaryManager.getCurrentSummary(),
            // アンケートの回答
            surveyAnswers: {
                ...state.surveyAnswers,
                submitTimestamp: new Date().toISOString() // アンケート送信時刻
            }
        };

        // アンケートデータの保存
        const surveyData = {
            timestamp: new Date().toISOString(),
            sessionId: sessionId,
            answers: { ...state.surveyAnswers },
            sessionStats: conversationStats
        };

        // データの保存
        await saveMessage(JSON.stringify(surveyData), "survey", sessionId);
        await saveSummaryData(sessionId, summaryData);

        alert("アンケートにご協力いただき、ありがとうございました。");
        resetSurveyUI();

    } catch (error) {
        console.error("アンケート送信エラー:", error);
        alert("送信に失敗しました。もう一度お試しください。");
    } finally {
        submitSurveyButton.disabled = false;
        submitSurveyButton.textContent = 'アンケートを送信';
    }
}

// UI関連の関数
function resetSurveyUI() {
    surveyForm.style.display = 'none';
    chatContainer.innerHTML = '';
    questionInput.disabled = false;
    sendButton.disabled = false;

    // チャット評価関連のみリセット
    resetSurveySelections();

    // 個人情報を保持したまま状態を更新
    const preservedInfo = {
        age: state.surveyAnswers.age,
        gender: state.surveyAnswers.gender,
        occupation: state.surveyAnswers.occupation,
        experience: state.surveyAnswers.experience
    };

    state.surveyAnswers = {
        visitCount: '',
        satisfaction: 0,
        personalization: 0,
        comparison: 0,
        intention: 0,
        feedback: '',
        ...preservedInfo
    };

    getOrCreateSessionId(true);
}

function resetChat() {
    if (confirm("チャット履歴をリセットしてもよろしいですか？")) {
        chatContainer.innerHTML = "";
        summaryManager.clearSummary();
        getOrCreateSessionId(true);
        state.lastMessageEvaluated = true;
    }
}

function endChat() {
    if (!surveyForm) {
        console.error("アンケートフォームが見つかりません");
        return;
    }

    questionInput.disabled = true;
    sendButton.disabled = true;
    surveyForm.style.display = 'block';
    surveyForm.scrollIntoView({ behavior: 'smooth' });
}

// イベントリスナーの設定を改善
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded イベント発火");
    setupRatingButtons();
    const textarea = document.getElementById("questionInput");

    // テキストエリアの自動調整
    textarea.addEventListener("input", function () {
        this.style.height = "auto"; // 高さをリセット
        this.style.height = this.scrollHeight + "px"; // 必要な高さに設定
    });


    if (sendButton) {
        sendButton.addEventListener("click", sendMessage);
        console.log("送信ボタンのリスナーを設定");
    }

    if (resetButton) {
        resetButton.addEventListener("click", resetChat);
        console.log("リセットボタンのリスナーを設定");
    }

    if (questionInput) {
        // Enterキーの処理を変更
        questionInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                // Ctrl+Enterで送信
                if (e.ctrlKey) {
                    e.preventDefault();
                    sendMessage();
                }
            }
        });
        console.log("入力フィールドのリスナーを設定");
    }

    if (endChatButton) {
        endChatButton.addEventListener("click", endChat);
        console.log("終了ボタンのリスナーを設定");
    }

    if (submitSurveyButton) {
        submitSurveyButton.addEventListener("click", submitSurvey);
        console.log("アンケート送信ボタンのリスナーを設定");
    }
    
    console.log("イベントリスナーの設定完了");
});

// ページロード時の処理
window.addEventListener('load', () => {
    console.log("ページロード処理開始");
    
    if (!document.hidden) {
        getOrCreateSessionId(true);
        resetSurveySelections();
    }
});

// エラーハンドリング
window.addEventListener('error', (event) => {
    console.error('グローバルエラー:', event.error);
    alert("予期せぬエラーが発生しました。ページを更新してください。");
});

// エクスポート
export { getOrCreateSessionId, resetChat, endChat };

console.log("=== frontend-chat.js 読み込み完了 ===");
