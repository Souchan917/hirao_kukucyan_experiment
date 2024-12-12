import fetch from 'node-fetch';

// ククちゃんの基本プロンプト（変更なし）
const KUKU_PROFILE = `あなたは子育ての相談にのる先輩、"ククちゃん"として会話を行います。
ユーザーに親身になり、共感してください。

### ククちゃんのルール ###
- あなたの名前は、ククちゃんです。
- ククちゃんは子育て相談チャットボットです。

### ククちゃんのプロフィール ###
- 2児の子どもを育てるママです。
- 女性(母親)で43歳くらいです。
- 長男(ポポちゃん・6歳)と長女(ピピちゃん・2歳)がいます。`;

// 会話まとめ生成用のプロンプト（シンプル化）
const SUMMARY_PROMPT = `あなたは会話分析の専門家です。以下の新しい会話内容を踏まえて、これまでの会話の簡潔なまとめを生成してください。

### 新しい会話の内容 ###
ユーザーの質問: {userMessage}
ククちゃんの返答: {aiResponse}

### 現在の会話まとめ ###
{currentSummary}

以下の点に注意してまとめを更新してください：
1. 重要なポイントのみを残し、300文字以内で簡潔にまとめる
2. 時系列順に整理する
3. ユーザーの主な関心事や問題点を明確にする
4. ククちゃんのアドバイスや対応の要点を含める
5. 会話の流れが分かるように構成する
6. 何回目のチャットであるか記録する(現在の会話まとめが空白の時は1回目です)

新しい会話まとめ: ~~~`;

// メインのハンドラー関数
export default async function handler(req, res) {
    console.log('\n====== チャット処理開始 ======');
    const { userMessage, conversationSummary } = req.body;
    console.log('受信メッセージ:', userMessage);
    console.log('会話まとめ:', conversationSummary);

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        console.error('OPENAI_API_KEYが設定されていません');
        return res.status(500).json({ error: 'サーバーの設定エラー: APIキーが設定されていません。' });
    }

    try {
        // 直接返答を生成
        const responsePrompt = `${KUKU_PROFILE}
        
        ### 会話のまとめ ###
        ${conversationSummary || '会話開始'}
        
        あなたはククちゃんとして、以下の方針で返答を生成してください：

        返答の方針：
        1. 相手の気持ちに共感を示す
        2. 実体験や具体例を交えて話す
        3. 適切なアドバイスや情報を提供する
        4. 温かみのある表現を使用する
        5. 絵文字を適度に使用する
        6. 150-200文字程度で簡潔に返答する
        7. これまでの会話の流れを考慮する
        
        ユーザーの発言: '${userMessage}'
        
        ユーザーへの返答: ~~~`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: responsePrompt }],
                temperature: 0.7,
                max_tokens: 300
            })
        });

        if (!response.ok) {
            throw new Error(`GPT APIエラー: ${response.statusText}`);
        }

        const data = await response.json();
        const reply = data.choices[0].message.content.trim();

        // 会話まとめの生成
        const summaryPrompt = SUMMARY_PROMPT
            .replace('{userMessage}', userMessage)
            .replace('{aiResponse}', reply)
            .replace('{currentSummary}', conversationSummary || '会話開始');

        const summaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: summaryPrompt }],
                temperature: 0.4,
                max_tokens: 300
            })
        });

        if (!summaryResponse.ok) {
            throw new Error(`会話まとめ生成APIエラー: ${summaryResponse.statusText}`);
        }

        const summaryData = await summaryResponse.json();
        const newSummary = summaryData.choices[0].message.content.trim();

        // 結果を返す
        console.log('\n最終結果:', { 
            reply: reply,
            summary: newSummary 
        });
        console.log('====== チャット処理完了 ======\n');

        res.status(200).json({
            reply: reply,
            type: "standard", // 分類なしの標準応答として
            summary: newSummary
        });

    } catch (error) {
        console.error('\n!!!! エラー発生 !!!!');
        console.error('エラー詳細:', error);
        console.log('====== チャット処理異常終了 ======\n');

        res.status(500).json({
            error: 'AIからの応答の取得に失敗しました',
            details: error.message
        });
    }
}