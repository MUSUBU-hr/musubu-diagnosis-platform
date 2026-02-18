'use strict';

const express = require('express');
const { Firestore } = require('@google-cloud/firestore');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const TYPE_LABELS = {
  leader:     'リーダータイプ',
  supporter:  'サポータータイプ',
  analyst:    'アナリストタイプ',
  creator:    'クリエイタータイプ',
  specialist: 'スペシャリストタイプ',
  challenger: 'チャレンジャータイプ',
};

const app = express();
const PORT = process.env.PORT || 8080;

// Firestore クライアント（Cloud Run上ではADCで自動認証）
const firestore = new Firestore();
const COLLECTION = 'diagnosis_progress';

app.use(express.json());

// 静的ファイルのサーブ
app.use(express.static(path.join(__dirname, 'public')));

// ========================================
// POST /api/sessions
// 新規セッション作成
// ========================================
app.post('/api/sessions', async (req, res) => {
  try {
    const sessionId = uuidv4();
    const now = Firestore.Timestamp.now();

    await firestore.collection(COLLECTION).doc(sessionId).set({
      max_block: 1,
      completed: false,
      created_at: now,
      updated_at: now,
    });

    res.status(201).json({ session_id: sessionId });
  } catch (err) {
    console.error('POST /api/sessions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================================
// GET /api/sessions/:id
// セッション取得（再開用）
// ========================================
app.get('/api/sessions/:id', async (req, res) => {
  try {
    const docRef = firestore.collection(COLLECTION).doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const data = doc.data();
    res.json({
      session_id: doc.id,
      max_block: data.max_block,
      completed: data.completed,
    });
  } catch (err) {
    console.error('GET /api/sessions/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================================
// PATCH /api/sessions/:id
// 進捗更新（max_block は後退しない）
// ========================================
app.patch('/api/sessions/:id', async (req, res) => {
  try {
    const { max_block, completed, name, result_type } = req.body;

    const docRef = firestore.collection(COLLECTION).doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const current = doc.data();
    const updates = { updated_at: Firestore.Timestamp.now() };

    // max_block は後退させない
    if (typeof max_block === 'number') {
      updates.max_block = Math.max(current.max_block, max_block);
    }

    if (typeof completed === 'boolean') {
      updates.completed = completed;
    }

    if (typeof name === 'string' && name.trim()) {
      updates.name = name.trim();
    }

    if (typeof result_type === 'string' && result_type) {
      updates.result_type = result_type;
    }

    await docRef.update(updates);
    res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/sessions/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================================
// POST /api/analyze
// LLMによる個別分析・アドバイザー用メモ生成
// ========================================
app.post('/api/analyze', async (req, res) => {
  // APIキーがない場合はスキップ
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.json({ analysis: null, advisor_memo: null });
  }

  try {
    const { name, main_type, sub_type, scores, qa } = req.body;

    const scoresText = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .map(([key, val]) => `${TYPE_LABELS[key] || key}: ${Number(val).toFixed(1)}/5`)
      .join('\n');

    const qaText = (qa || [])
      .map(item => `Q${item.id}「${item.text}」→ ${item.value}/5`)
      .join('\n');

    const prompt = `あなたはキャリア診断の専門アナリストです。以下のMUSUBU適職診断の結果を分析してください。

【受診者】${name}

【診断タイプ】
メインタイプ: ${TYPE_LABELS[main_type] || main_type}
サブタイプ: ${TYPE_LABELS[sub_type] || sub_type}

【タイプ別スコア（5点満点）】
${scoresText}

【全設問への回答（1=まったくそう思わない、5=とてもそう思う）】
${qaText}

以下の2つをJSON形式のみで出力してください（マークダウン・コードブロック不要）。

1. "analysis": ${name}さんの回答パターンから読み取れる個性・強み・仕事スタイルの分析（200〜250字）。タイプ名だけでなく具体的なスコアや回答傾向に触れながら、この人らしさを引き出してください。

2. "advisor_memo": キャリアアドバイザーが面談時に活用できるメモ（250〜300字）。注目すべき特徴、向いている環境・職種の方向性、面談時に掘り下げるべき切り口を含めてください。

{"analysis": "...", "advisor_memo": "..."}`;

    const client = new Anthropic();
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);

    res.json({
      analysis:     parsed.analysis     || null,
      advisor_memo: parsed.advisor_memo || null,
    });
  } catch (err) {
    console.error('POST /api/analyze error:', err);
    res.json({ analysis: null, advisor_memo: null });
  }
});

// SPA フォールバック（不要だがSPA対応として念のため）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
