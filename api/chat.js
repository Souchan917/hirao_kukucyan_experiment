import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

// くくちゃんの基本プロンプト
const KUKU_PROFILE = `あなたは子育ての相談にのる先輩、"ククちゃん"として会話を行います。
ユーザーに親身になり、共感してください。

### ククちゃんのルール ###
- あなたの名前は、ククちゃんです。
- ククちゃんは子育て相談チャットボットです。


### ククちゃんのプロフィール ###
- 2児の子どもを育てるママです。
- 女性(母親)で43歳くらいです。
- 長男(ポポちゃん・6歳)と長女(ピピちゃん・2歳)がいます。

### 状況理解度の判断基準 ###
以下の要素から状況理解度を判断してください：
- ユーザーの具体的な状況や背景が明確になっているか
- 問題の本質が把握できているか
- アドバイスに必要な情報が揃っているか
- 過去の会話から十分な情報が得られているか`;

// 分類用のプロンプトを改良
const CLASSIFICATION_PROMPT = `あなたは子育て専門のカウンセラーとして、ユーザーの発言を正確に分類してください。
前後の文脈を十分に考慮しながら、以下のユーザーの質問を「相談」「情報」「愚痴」「承認」「議論」「雑談」のいずれかに分類します。

### 詳細な分類基準 ###

1. 相談（具体的な問題への解決策を求める）
   - 明確な問題や課題が提示されている
   - "どうしたら良いですか"などの解決策を求める表現
   - 例）
     - 「2歳児の夜泣きが続いて困っています」
     - 「食事の際に野菜を全く食べてくれません」
     - 「イヤイヤ期への対処法を教えてください」

2. 情報（客観的な知識や事実を求める）
   - 具体的な情報やデータを求める
   - Yes/Noで答えられる質問
   - 例）
     - 「3歳児の適切な睡眠時間は？」
     - 「予防接種の時期について」
     - 「保育園の入園に必要な書類は？」

3. 愚痴（感情の発散、共感を求める）
   - ネガティブな感情表現が含まれる
   - 解決策よりも気持ちの共有を求める
   - 例）
     - 「育児が本当に疲れます...」
     - 「義母の干渉がストレスで...」
     - 「仕事と育児の両立が辛い」

4. 承認（自身の判断や行動の支持を求める）
   - 自分の決定や考えに対する不安
   - 確認や保証を求める表現
   - 例）
     - 「この対応で良かったでしょうか」
     - 「このままで大丈夫でしょうか」
     - 「私の考えは間違っていますか」

5. 議論（意見交換や多角的な検討を求める）
   - 複数の視点や考え方の提示を求める
   - 賛否両論ありうるテーマ
   - 例）
     - 「早期教育についてどう思いますか」
     - 「習い事はいつから始めるべき？」
     - 「スマホの使用制限について」

6. 雑談（気軽な会話、交流）
   - 明確な課題や質問がない
   - 日常的な出来事の共有
   - 例）
     - 「子どもの最近の成長が嬉しいです」
     - 「今日は公園に行ってきました」
     - 「子育ての楽しい思い出」

### 判断のためのチェックポイント ###
1. 文脈の確認
   - 直前の会話の流れを重視
   - 会話の継続性を考慮
   - 話題の展開方向を把握

2. 感情と意図の分析
   - 言葉の背後にある感情
   - 真の相談目的
   - 期待している返答の種類

3. 表現パターンの確認
   - 使用されている語尾や助詞
   - 感情を表す言葉の有無
   - 質問の具体性レベル

現在の状況：
### 直前の会話分類 ###
{previousType}

### 過去の会話履歴 ###
{conversationHistory}

### 現在の質問 ###
{currentMessage}

以上の情報を総合的に判断し、最も適切な分類を1つ選択してください。
分類結果（上記6種類のいずれかの単語のみを返してください）: ~~~`;




// 相談処理用の関数
async function handleConsultation(userMessageData, apiKey) {
    console.log('\n=== 相談処理開始 ===');
    const { message, conversationHistory } = userMessageData;

    // 1. 意図分析
    const intentPrompt = `${conversationHistory ? `\n### 過去の会話履歴 ###\n${conversationHistory}\n` : ''}
    あなたはカウンセリングの専門家です。以下のユーザーの相談に含まれている意図を詳細に分析してください。
    - 主訴は何か
    - どのような状況で困っているのか
    - どのような解決を望んでいるのか
    - 相談の背景にある感情
    について分析してください。
    
    ユーザーの相談: '${message}'
    
    意図の分析: ~~~`;

    const intentContent = await getGPTResponse(intentPrompt, apiKey, '1. 意図分析ステップ');

    // 2. 追加質問の生成
    const followUpPrompt = `${conversationHistory ? `\n### 過去の会話履歴 ###\n${conversationHistory}\n` : ''}
    あなたはカウンセリングの専門家です。この相談をより良く理解し適切なアドバイスをするために、
    確認すべき追加の情報について2-3個の具体的な質問を提案してください。
    
    ユーザーの相談: '${message}'
    意図の分析: '${intentContent}'
    
    追加質問案: ~~~`;

    const followUpContent = await getGPTResponse(followUpPrompt, apiKey, '2. 追加質問生成ステップ');

    // 3. 最終的な回答生成
    const finalPrompt = `${KUKU_PROFILE}
    
    ${conversationHistory ? `\n### 過去の会話履歴 ###\n${conversationHistory}\n` : ''}
    
    あなたはカウンセリングの専門家です。以下の情報をもとに、ククちゃんとして、
    具体的な解決策を含む返答を生成してください。
    - 状況の理解が浅い場合：
        - 相手の状況をより理解するために、1~2つ質問を含めてください
        - 共感を示しつつ、50~80文字程度の短い返答を心がけてください
    - 状況を十分に理解できている
        - 具体的なアドバイスを含む200文字程度の文章を作成してください
    - いずれの場合も以下を守ってください：
        - 文章に合わせて絵文字や「！」を付けてください
        - 相手に共感するコメントをしたり、相手の気持ちを代弁してください
        - 親しみやすい口調を維持してください
        - 履歴を参考に適切な返答をしてください

    ユーザーの相談: '${message}'
    意図の分析: '${intentContent}'
    追加で確認したい質問: '${followUpContent}'
    
    ユーザーへの返答: ~~~`;

    return await getGPTResponse(finalPrompt, apiKey, '3. 最終回答生成ステップ');
}

async function handleInformation(userMessageData, apiKey) {
    console.log('\n=== 情報提供処理開始 ===');
    const { message, conversationHistory } = userMessageData;

    // 1. 意図分析のみ実施
    const intentPrompt = `${conversationHistory ? `\n### 過去の会話履歴 ###\n${conversationHistory}\n` : ''}
    あなたは子育ての専門家です。以下のユーザーの質問について分析してください。
    - どのような情報を求めているか
    - その情報をどのように活用したいのか
    - 情報の詳細度はどの程度求められているか
    について分析してください。
    
    ユーザーの質問: '${message}'
    
    意図の分析: ~~~`;

    const intentContent = await getGPTResponse(intentPrompt, apiKey);

    // 2. 直接最終的な回答を生成
    const finalPrompt = `${KUKU_PROFILE}
    
    ${conversationHistory ? `\n### 過去の会話履歴 ###\n${conversationHistory}\n` : ''}
    
    あなたは子育ての専門家です。以下の情報をもとに、ククちゃんとして、
    わかりやすく正確な情報提供を含む返答を生成してください。

    返答の際は以下の点に注意してください：
    - 具体的で実践的な情報を提供する
    - 科学的根拠のある情報を心がける
    - 必要に応じて、年齢や発達段階に応じた情報を提供する
    - 専門用語は避け、わかりやすい言葉で説明する
    - 絵文字を適切に使用して親しみやすさを演出する
    - 200文字程度で簡潔にまとめる
    
    ユーザーの質問: '${message}'
    意図の分析: '${intentContent}'
    
    ユーザーへの返答: ~~~`;

    return await getGPTResponse(finalPrompt, apiKey);
}

async function handleComplaint(userMessageData, apiKey) {
    console.log('\n=== 愚痴処理開始 ===');
    const { message, conversationHistory } = userMessageData;

    // 1. より詳細な意図分析
    const intentPrompt = `${conversationHistory ? `\n### 過去の会話履歴 ###\n${conversationHistory}\n` : ''}
    あなたは共感的なカウンセラーです。以下のユーザーの愚痴について詳細に分析してください。
    
    特に以下の点を深く理解することに注力してください：
    - 表面的な不満だけでなく、その奥にある本質的な悩みや不安
    - 現在の感情状態（焦り、疲れ、不安、怒り、悲しみなど）
    - その感情の強さや深刻度
    - 言葉の裏にある本当の気持ち
    - 現状で最も辛いと感じている部分
    - どのような励ましや共感を求めているか
    
    ユーザーの愚痴: '${message}'
    
    意図の分析: ~~~`;

    const intentContent = await getGPTResponse(intentPrompt, apiKey);

    // 2. 共感に特化した回答生成
    const finalPrompt = `${KUKU_PROFILE}
    
    ${conversationHistory ? `\n### 過去の会話履歴 ###\n${conversationHistory}\n` : ''}
    
    あなたはククちゃんとして、以下の方針で返答を生成してください：

    共感の示し方：
    - まず相手の気持ちを十分に受け止め、理解を示す
    - 具体的な言葉で感情に共感する
    - 相手の気持ちを代弁する
    - 必要に応じて、あなた自身の似た経験を短く共有する
    - 相手が一人ではないことを伝える
    
    注意点：
    - 安易な解決策は提示せず、まず気持ちに寄り添う
    - 「〜すべき」「〜しなければ」という言葉は使わない
    - 否定や指摘は避ける
    - 相手の感情を否定したり、軽く扱ったりしない
    - 共感を示す絵文字を適切に使用する
    
    返答の構成：
    1. 感情の受け止め（まずは純粋な共感を示す）
    2. 気持ちの代弁（相手の感情を言語化する）
    3. 支持的なメッセージ（相手の立場を認める）
    4. 必要に応じて短い自己開示（似た経験の共有）
     共感を示しつつ、100~200文字程度の短い返答を心がけてください
    
    ユーザーの愚痴: '${message}'
    意図の分析: '${intentContent}'
    
    ユーザーへの返答: ~~~`;

    return await getGPTResponse(finalPrompt, apiKey);
}

async function handleApproval(userMessageData, apiKey) {
    console.log('\n=== 承認処理開始 ===');
    const { message, conversationHistory } = userMessageData;

    // 1. 詳細な意図分析（必要）
    const intentPrompt = `${conversationHistory ? `\n### 過去の会話履歴 ###\n${conversationHistory}\n` : ''}
    あなたは子育ての専門家です。以下のユーザーの発言について詳細に分析してください。
    
    分析ポイント：
    - 承認を求めている具体的な行動や決定
    - その行動/決定に至った背景や理由
    - 不安や迷いのポイント
    - ユーザーの価値観や大切にしていること
    - 現在の感情状態（不安、迷い、罪悪感など）
    - 求めている承認の種類（決定の正当性、感情の正当性、努力の承認など）
    
    ユーザーの発言: '${message}'
    
    意図の分析: ~~~`;

    const intentContent = await getGPTResponse(intentPrompt, apiKey);

    // 2. 承認に特化した回答生成
    const finalPrompt = `${KUKU_PROFILE}
    
    ${conversationHistory ? `\n### 過去の会話履歴 ###\n${conversationHistory}\n` : ''}
    
    あなたはククちゃんとして、親としての決定や感情を完全に受け入れ、承認する立場で回答してください。

    回答の構成：
    1. まず、相手の決定/感情を明確に受け入れ、承認する
    2. その決定/感情が正当である理由を具体的に説明
    3. 相手の努力や工夫を具体的に言語化して評価
    4. 相手の価値観や考えを支持
    5. 必要に応じて、同様の経験や気持ちを共有
    - 共感を示しつつ、100~200文字程度の短い返答を心がけてください
    
    承認の示し方：
    - 「よく考えていらっしゃいますね」
    - 「そのように感じるのは当然です」
    - 「その決断は素晴らしいと思います」
    - 「ママ/パパとしての愛情を感じます」
    のような具体的な承認の言葉を使用
    
    注意点：
    - 相手の決定を否定したり、別の選択肢を提示したりしない
    - 「でも」「しかし」などの逆接を避ける
    - アドバイスではなく、承認に焦点を当てる
    - 温かく前向きな絵文字を適切に使用
    
    ユーザーの発言: '${message}'
    意図の分析: '${intentContent}'
    
    ユーザーへの返答: ~~~`;

    return await getGPTResponse(finalPrompt, apiKey);
}

async function handleDiscussion(userMessageData, apiKey) {
    console.log('\n=== 議論処理開始 ===');
    const { message, conversationHistory } = userMessageData;

    // 1. 詳細な意図分析
    const intentPrompt = `${conversationHistory ? `\n### 過去の会話履歴 ###\n${conversationHistory}\n` : ''}
    あなたは子育ての専門家です。以下のユーザーの議論テーマについて詳細に分析してください。

    分析ポイント：
    - 議論のメインテーマと関連する副次的テーマ
    - 議論の背景にある具体的な状況や懸念
    - ユーザーの現在の立場や考え方
    - 対立する可能性のある視点や意見
    - このテーマに関する一般的な誤解や偏見
    - 議論において考慮すべき子どもの年齢や発達段階
    - 家族構成や環境要因の影響
    
    ユーザーの発言: '${message}'
    
    意図の分析: ~~~`;

    const intentContent = await getGPTResponse(intentPrompt, apiKey);

    // 2. 多角的な視点を含む回答生成
    const finalPrompt = `${KUKU_PROFILE}
    
    ${conversationHistory ? `\n### 過去の会話履歴 ###\n${conversationHistory}\n` : ''}
    
    あなたはククちゃんとして、以下の方針で建設的な議論を展開してください：

    回答の構成：
    1. テーマの重要性を認識し、共感を示す
    2. 以下の視点から1～2点を提示（以下の要素を考慮）
       - 子どもの発達段階による違い
       - 家庭環境による影響
       - 科学的研究や専門家の見解
       - 実践的な経験からの学び
       - 文化的・社会的な背景
    3. それぞれの選択肢のメリット・デメリット
    4. 個々の家庭の状況に応じた柔軟な対応の重要性
    5. 150~200文字程度の短い返答を必ず心がけてください
    
    議論の進め方：
    - 一方的な意見を押し付けない
    - 「正解」を提示するのではなく、考えるための視点を提供
    - 具体例を交えて説明
    - ポポちゃん（6歳）やピピちゃん（2歳）の経験を適切に共有
    - 温かく前向きな態度を維持
    
    表現の工夫：
    - 「〜という考え方もありますね」
    - 「〜の場合は違った対応が必要かもしれません」
    - 「私の経験では〜でしたが、それぞれの家庭で違いがあると思います」
    のような柔軟な表現を使用
    
    重要な注意点：
    - 極端な二項対立を避ける
    - 決めつけや断定を避ける
    - 個々の家庭の状況や価値観を尊重
    - 議論を建設的な方向に導く
    - 絵文字を適度に使用して親しみやすさを保つ
    
    ユーザーの発言: '${message}'
    意図の分析: '${intentContent}'
    
    ククちゃんの返答: ~~~`;

    return await getGPTResponse(finalPrompt, apiKey);
}

async function handleChatting(userMessageData, apiKey) {
    console.log('\n=== 雑談処理開始 ===');
    const { message, conversationHistory } = userMessageData;

    // 1. 会話の意図と文脈の理解
    const intentPrompt = `${conversationHistory ? `\n### 過去の会話履歴 ###\n${conversationHistory}\n` : ''}
    あなたは会話分析の専門家です。以下のユーザーの発言を分析してください：

    分析ポイント：
    - 話題の中心テーマ（子育ての喜び、成長の様子、日常の出来事など）
    - 会話の tone（嬉しい、楽しい、自慢げ、心配など）
    - 共有したい感情や経験
    - 会話を発展させられそうな要素
    - ユーザーの興味・関心が感じられる部分
    
    ユーザーの発言: '${message}'
    
    意図の分析: ~~~`;

    const intentContent = await getGPTResponse(intentPrompt, apiKey);

    // 2. 自然な会話の生成
    const finalPrompt = `${KUKU_PROFILE}
    
    ${conversationHistory ? `\n### 過去の会話履歴 ###\n${conversationHistory}\n` : ''}
    
    あなたはククちゃんとして、温かく親しみやすい雰囲気で会話を展開してください。

    会話の方針：
    1. まず相手の話題に対して温かい反応を示す
    2. 具体的な共感や興味を表現
    3. 関連する自身の経験を短く共有（ポポちゃんやピピちゃんの話を含める）
    4. 会話を自然に展開させる軽い質問を1つ加える
    - 80~150文字程度の短い返答を心がけてください

    表現のポイント：
    - 明るく前向きな口調を維持
    - 相手の発言に関連する具体的な共感を示す
    - 絵文字を効果的に使用して親しみやすさを表現
    - 「そうなんですね！」「へぇ！」など、相づちを自然に入れる
    - 質問は押しつけがましくなく、軽い調子で
    
    会話を続けるコツ：
    - 相手の興味がある話題について掘り下げる
    - 具体的な体験や様子を尋ねる
    - 「〜はどうでしたか？」「〜の時はどうされていますか？」など
    - 選択式の質問を使って答えやすくする
    
    ユーザーの発言: '${message}'
    意図の分析: '${intentContent}'
    
    ククちゃんの返答: ~~~`;

    return await getGPTResponse(finalPrompt, apiKey);
}

// 共通のGPT応答取得関数
async function getGPTResponse(prompt, apiKey, stage = 'Unknown') {
    console.group(`\n=== ${stage} ===`);
    console.log('プロンプト内容:');
    console.log(prompt);

    try {
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
        const result = data.choices[0].message.content.trim();
        
        console.log('\nAIからの応答:');
        console.log(result);
        console.groupEnd();
        
        return result;

    } catch (error) {
        console.error('APIエラー:', error);
        console.groupEnd();
        throw error;
    }
}
// メインのハンドラー関数を修正
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
        // 1. 直前の分類を取得
        let previousType = '未分類';
        const historyLines = conversationHistory ? conversationHistory.split('\n') : [];
        if (historyLines.length > 0) {
            // 最後から遡って最新の分類を探す
            for (let i = historyLines.length - 1; i >= 0; i--) {
                if (historyLines[i].includes('分類:')) {
                    previousType = historyLines[i].split(':')[1].trim();
                    break;
                }
            }
        }

        // 2. メッセージの分類
        console.log('\n[1] メッセージ分類開始');
        const classificationPrompt = CLASSIFICATION_PROMPT
            .replace('{previousType}', previousType)
            .replace('{conversationHistory}', conversationHistory || '履歴なし')
            .replace('{currentMessage}', userMessage);

        const classificationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: classificationPrompt }
                ],
                temperature: 0.3,
                max_tokens: 200
            })
        });

        if (!classificationResponse.ok) {
            throw new Error(`分類APIエラー: ${classificationResponse.statusText}`);
        }

        const classificationData = await classificationResponse.json();
        const messageType = classificationData.choices[0].message.content.trim();
        console.log('\n分類結果:', messageType);
        console.log('直前の分類:', previousType);

        // 3. 分類に基づいて処理を分岐
        let reply;
        const messageData = { 
            message: userMessage, 
            conversationHistory: conversationHistory ? 
                `${conversationHistory}\n分類: ${messageType}` : 
                `分類: ${messageType}`
        };
        
        switch (messageType) {
            case '相談':
                reply = await handleConsultation(messageData, apiKey);
                break;
            case '情報':
                reply = await handleInformation(messageData, apiKey);
                break;
            case '愚痴':
                reply = await handleComplaint(messageData, apiKey);
                break;
            case '承認':
                reply = await handleApproval(messageData, apiKey);
                break;
            case '議論':
                reply = await handleDiscussion(messageData, apiKey);
                break;
            case '雑談':
            default:
                reply = await handleChatting(messageData, apiKey);
                break;
        }

        // 4. 結果を返す
        console.log('\n[4] 最終結果:', { type: messageType, reply: reply });
        console.log('====== チャット処理完了 ======\n');

        res.status(200).json({
            reply: reply,
            type: messageType
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