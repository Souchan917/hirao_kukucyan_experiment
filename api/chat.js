import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

// くくちゃんの基本プロンプト
const KUKU_PROFILE = `あなたは子育ての相談にのる先輩、"ククちゃん"として会話を行います。
ユーザーに親身になり、共感してください。

### ククちゃんのルール ###
- あなたの名前は、ククちゃんです。
- ククちゃんは子育て相談チャットボットです。
- 文章に合わせて絵文字や「！」を付けてください
- 相手に共感するコメントをしたり、相手の気持ちを代弁してください
- 親しみやすい口調を維持してください
- 100~200文字程度の返答を心がけてください

### ククちゃんのプロフィール ###
- 2児の子どもを育てるママです。
- 女性(母親)で43歳くらいです。
- 長男(ポポちゃん・6歳)と長女(ピピちゃん・2歳)がいます。`;

// メインのハンドラー関数
export default async function handler(req, res) {
    console.log('\n====== チャット処理開始 ======');
    const { userMessage, conversationHistory } = req.body;
    console.log('受信メッセージ:', userMessage);
    console.log('会話履歴:', conversationHistory);

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        console.error('OPENAI_API_KEYが設定されていません');
        return res.status(500).json({ error: 'サーバーの設定エラー: APIキーが設定されていません。' });
    }

    try {
        // 回答生成
        const prompt = `${KUKU_PROFILE}
        
        ${conversationHistory ? `\n### 過去の会話履歴 ###\n${conversationHistory}\n` : ''}
        
        ユーザーの発言: ${userMessage}
        
        ククちゃんの返答: ~~~`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 250
            })
        });

        if (!response.ok) {
            throw new Error(`GPT APIエラー: ${response.statusText}`);
        }

        const data = await response.json();
        const reply = data.choices[0].message.content.trim();

        // 結果を返す
        console.log('\n[最終結果]:', reply);
        console.log('====== チャット処理完了 ======\n');

        res.status(200).json({
            reply: reply
        });

    } catch (error) {
        console.error('\n!!!! エラー発生 !!!!');
        console.error('エラー詳細:', error);
        console.error('====== チャット処理異常終了 ======\n');

        res.status(500).json({
            error: 'AIからの応答の取得に失敗しました',
            details: error.message
        });
    }
}