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
    const { max_block, completed, name, line_name, result_type } = req.body;

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

    if (typeof line_name === 'string') {
      updates.line_name = line_name;
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

    const prompt = `あなたはキャリア診断の専門アナリストです。以下のMUSUBU適職診断の結果をもとに2つのテキストを生成してください。

【受診者】${name}

【診断タイプ】
メインタイプ: ${TYPE_LABELS[main_type] || main_type}
サブタイプ: ${TYPE_LABELS[sub_type] || sub_type}

【タイプ別スコア（5点満点）】
${scoresText}

【全設問への回答（1=まったくそう思わない、5=とてもそう思う）】
${qaText}

以下をJSON形式のみで出力してください（マークダウン・コードブロック不要）。

---

1. "analysis"
${name}さん本人に向けた個別分析コメント（200〜250字）。
・口調は「あなたは〜」と本人に語りかける形
・タイプの説明文と同じ、前向きで背中を押すような温かいトーン
・スコアや回答傾向をもとに、この人ならではの具体的な強みや仕事スタイルを描写する
・「診断結果として〜」のような無機質な表現は使わない

2. "weapon"
${name}さんの「あなたの武器」（1〜2文・簡潔に）。
・この人が自然に発揮できる最大の強みを具体的に表現する
・スコアや回答傾向を根拠にする

3. "environment"
${name}さんの「イキイキする環境」（1〜2文・簡潔に）。
・どんな職場・状況でパフォーマンスが最大化するかを具体的に表現する

4. "motivation"
${name}さんの「モチベーションが上がるスイッチ」（1〜2文・簡潔に）。
・何がやる気の源泉になるか、どんな状況で燃えるかを具体的に表現する

5. "advisor_memo"
キャリアアドバイザー向けの面談メモ。以下の8項目を必ず含め、各項目を「■項目名」で始めること。

■タイプ
■強み
■弱み
■刺さる求人傾向
■面談で深掘るべき質問
■注意すべき心理傾向
■決定率を上げるトーク例
■面談時の注意点（※転職後のミスマッチについてではない。「このCAがこの求職者を面談・支援する際に気をつけるべき対応上の注意点」を記述すること。例：本音を話さないリスク、途中離脱しやすいパターン、特定のトークで反発が起きやすい傾向など）

各項目2〜4文で具体的に記述すること。スコアや回答傾向を根拠に使うこと。

---

{"analysis": "...", "weapon": "...", "environment": "...", "motivation": "...", "advisor_memo": "..."}`;

    const client = new Anthropic();
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);

    res.json({
      analysis:     parsed.analysis     || null,
      weapon:       parsed.weapon       || null,
      environment:  parsed.environment  || null,
      motivation:   parsed.motivation   || null,
      advisor_memo: parsed.advisor_memo || null,
    });
  } catch (err) {
    console.error('POST /api/analyze error:', err);
    res.json({ analysis: null, weapon: null, environment: null, motivation: null, advisor_memo: null });
  }
});

// ========================================
// POST /api/track
// イベント計測（Firestore にカウントアップ）
// ========================================
const ALLOWED_EVENTS = new Set([
  'page_view', 'diagnosis_start',
  'block_reach_1', 'block_reach_2', 'block_reach_3', 'block_reach_4', 'block_reach_5',
  'questions_complete', 'userinfo_view', 'result_view', 'cta_click',
]);

app.post('/api/track', async (req, res) => {
  const { event } = req.body;
  if (!ALLOWED_EVENTS.has(event)) {
    return res.status(400).json({ error: 'Unknown event' });
  }
  try {
    const ref = firestore.collection('analytics').doc('counters');
    await ref.set(
      { [event]: Firestore.FieldValue.increment(1), updated_at: Firestore.Timestamp.now() },
      { merge: true }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/track error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================================
// GET /admin
// 管理ダッシュボード（Basic 認証）
// ========================================
function buildAdminHtml(data) {
  const get = (key) => Number(data[key] || 0);
  const pct = (n, d) => d > 0 ? (n / d * 100).toFixed(1) + '%' : '—';
  const fmt = (n) => Number(n).toLocaleString('ja-JP');
  const updatedAt = data.updated_at
    ? data.updated_at.toDate().toLocaleString('ja-JP')
    : '—';

  // ---- KPI カード ----
  const kpiData = [
    { label: '表示回数',       value: fmt(get('page_view')) },
    { label: '診断開始率',     value: pct(get('diagnosis_start'),    get('page_view')) },
    { label: '50問完走率',     value: pct(get('questions_complete'), get('diagnosis_start')) },
    { label: 'CTAクリック率',  value: pct(get('cta_click'),          get('result_view')) },
  ];
  const kpiHtml = kpiData.map(k =>
    '<div class="kpi"><div class="kpi-label">' + k.label +
    '</div><div class="kpi-value">' + k.value + '</div></div>'
  ).join('');

  // ---- ファネル SVG ----
  const steps = [
    { label: 'ページ表示',           key: 'page_view' },
    { label: '診断開始',             key: 'diagnosis_start' },
    { label: 'Q1〜Q10  到達',        key: 'block_reach_1' },
    { label: 'Q11〜Q20 到達',        key: 'block_reach_2' },
    { label: 'Q21〜Q30 到達',        key: 'block_reach_3' },
    { label: 'Q31〜Q40 到達',        key: 'block_reach_4' },
    { label: 'Q41〜Q50 到達',        key: 'block_reach_5' },
    { label: '50問完走',             key: 'questions_complete' },
    { label: '氏名入力画面 到達',    key: 'userinfo_view' },
    { label: '結果表示',             key: 'result_view' },
    { label: '面談CTA クリック',     key: 'cta_click' },
  ];
  const vals = steps.map(s => get(s.key));
  const maxVal = Math.max(...vals, 1);
  const LW = 165, BW = 340, RH = 42, PAD = 10;
  const fSW = LW + BW + 150;
  const fSH = steps.length * RH + PAD * 2;

  const funnelRows = steps.map((step, i) => {
    const val  = vals[i];
    const prev = i > 0 ? vals[i - 1] : null;
    const ratio = prev !== null && prev > 0 ? val / prev : null;
    const isLow  = ratio !== null && ratio < 0.7;
    const barW   = Math.round((val / maxVal) * BW);
    const color  = isLow ? '#EF4444' : '#7EBFBB';
    const y      = PAD + i * RH;
    const ratioTxt = ratio !== null
      ? '前比 ' + (ratio * 100).toFixed(1) + '%'
      : '';
    return [
      '<text x="' + (LW - 6) + '" y="' + (y + 17) + '" text-anchor="end" font-size="12" fill="#374151">' + step.label + '</text>',
      barW > 0 ? '<rect x="' + LW + '" y="' + y + '" width="' + barW + '" height="26" rx="4" fill="' + color + '" opacity="0.8"/>' : '',
      '<text x="' + (LW + barW + 8) + '" y="' + (y + 13) + '" font-size="12" fill="#111" font-weight="600">' + fmt(val) + '</text>',
      ratioTxt ? '<text x="' + (LW + barW + 8) + '" y="' + (y + 27) + '" font-size="10" fill="' + (isLow ? '#EF4444' : '#9CA3AF') + '">' + ratioTxt + '</text>' : '',
    ].join('');
  }).join('');

  const funnelSvg = '<svg viewBox="0 0 ' + fSW + ' ' + fSH + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:' + fSW + 'px;display:block">' + funnelRows + '</svg>';

  // ---- Q1〜Q50 ステップ折れ線グラフ SVG ----
  const bv = [
    get('block_reach_1'), get('block_reach_2'), get('block_reach_3'),
    get('block_reach_4'), get('block_reach_5'),
  ];
  const finalV  = get('questions_complete');
  const chartMax = Math.max(get('diagnosis_start'), ...bv, finalV, 1);

  const PL = 55, PR = 20, PT = 28, PB = 40;
  const CW = 680, CH = 260;
  const PW = CW - PL - PR;
  const PH = CH - PT - PB;

  const qx = (q) => (PL + ((q - 1) / 49) * PW).toFixed(1);
  const vy = (v) => (PT + (1 - v / chartMax) * PH).toFixed(1);

  // ステップ折れ線（ブロック内フラット → ブロック間で垂直ドロップ）
  const blocks = [[1,10],[11,20],[21,30],[31,40],[41,50]];
  const polyPts = [];
  blocks.forEach(([s, e], i) => {
    polyPts.push(qx(s) + ',' + vy(bv[i]));
    polyPts.push(qx(e) + ',' + vy(bv[i]));
    if (i < blocks.length - 1) {
      polyPts.push(qx(e) + ',' + vy(bv[i + 1])); // 垂直ドロップ
    }
  });
  polyPts.push(qx(50) + ',' + vy(finalV)); // 最終ドロップ（完走）

  // Y 軸グリッド & ラベル
  const yTicksHtml = [0, 0.25, 0.5, 0.75, 1.0].map(r => {
    const v = Math.round(chartMax * r);
    const y = vy(v);
    return '<line x1="' + PL + '" y1="' + y + '" x2="' + (PL + PW) + '" y2="' + y + '" stroke="#F3F4F6" stroke-width="1"/>' +
           '<text x="' + (PL - 6) + '" y="' + (Number(y) + 4) + '" text-anchor="end" font-size="10" fill="#9CA3AF">' + fmt(v) + '</text>';
  }).join('');

  // X 軸ラベル
  const xLabelsHtml = [1,10,20,30,40,50].map(q =>
    '<text x="' + qx(q) + '" y="' + (PT + PH + 18) + '" text-anchor="middle" font-size="11" fill="#6B7280">Q' + q + '</text>'
  ).join('');

  // Block ラベル（上部）
  const blockLabelHtml = blocks.map(([s, e], i) => {
    const mx = ((Number(qx(s)) + Number(qx(e))) / 2).toFixed(1);
    return '<text x="' + mx + '" y="' + (PT - 8) + '" text-anchor="middle" font-size="10" fill="#9CA3AF">Block ' + (i + 1) + '</text>';
  }).join('');

  // ブロック間の垂直ドロップ線（点線）
  const dropLinesHtml = blocks.slice(0, -1).map(([, e], i) => {
    const x  = qx(e);
    const y1 = vy(bv[i]);
    const y2 = vy(bv[i + 1]);
    const isLarge = bv[i] > 0 && bv[i + 1] / bv[i] < 0.7;
    return '<line x1="' + x + '" y1="' + y1 + '" x2="' + x + '" y2="' + y2 + '" stroke="' + (isLarge ? '#EF4444' : '#CBD5E1') + '" stroke-width="1.5" stroke-dasharray="3,3"/>';
  }).join('');

  // 最終ドロップ線（Q50完走）
  const finalDropHtml = '<line x1="' + qx(50) + '" y1="' + vy(bv[4]) + '" x2="' + qx(50) + '" y2="' + vy(finalV) + '" stroke="#CBD5E1" stroke-width="1.5" stroke-dasharray="3,3"/>';

  // データポイント（ドット）
  const dotPts = [];
  blocks.forEach(([s, e], i) => {
    dotPts.push({ x: qx(s), y: vy(bv[i]) });
    dotPts.push({ x: qx(e), y: vy(bv[i]) });
  });
  dotPts.push({ x: qx(50), y: vy(finalV) });
  const dotsHtml = dotPts.map(d =>
    '<circle cx="' + d.x + '" cy="' + d.y + '" r="4" fill="#7EBFBB" stroke="#fff" stroke-width="1.5"/>'
  ).join('');

  const lineSvg =
    '<svg viewBox="0 0 ' + CW + ' ' + CH + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:' + CW + 'px;display:block">' +
    yTicksHtml +
    '<line x1="' + PL + '" y1="' + PT + '" x2="' + PL + '" y2="' + (PT + PH) + '" stroke="#E5E7EB" stroke-width="1"/>' +
    '<line x1="' + PL + '" y1="' + (PT + PH) + '" x2="' + (PL + PW) + '" y2="' + (PT + PH) + '" stroke="#E5E7EB" stroke-width="1"/>' +
    blockLabelHtml + dropLinesHtml + finalDropHtml +
    '<polyline points="' + polyPts.join(' ') + '" fill="none" stroke="#7EBFBB" stroke-width="2.5" stroke-linejoin="round"/>' +
    dotsHtml + xLabelsHtml +
    '</svg>';

  return '<!DOCTYPE html>' +
    '<html lang="ja"><head>' +
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>MUSUBU 管理ダッシュボード</title>' +
    '<style>' +
    '*{box-sizing:border-box;margin:0;padding:0}' +
    'body{font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif;background:#F3F4F6;color:#111;padding:24px 20px 60px}' +
    'h1{font-size:18px;font-weight:700;margin-bottom:4px}' +
    '.meta{font-size:12px;color:#9CA3AF;margin-bottom:20px}' +
    '.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}' +
    '@media(max-width:600px){.kpi-grid{grid-template-columns:repeat(2,1fr)}}' +
    '.kpi{background:#fff;border-radius:10px;padding:14px 16px;box-shadow:0 1px 3px rgba(0,0,0,.08)}' +
    '.kpi-label{font-size:11px;color:#9CA3AF;margin-bottom:4px}' +
    '.kpi-value{font-size:24px;font-weight:700;color:#111}' +
    'section{background:#fff;border-radius:10px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.08);overflow-x:auto}' +
    'h2{font-size:14px;font-weight:700;color:#374151;margin-bottom:16px}' +
    '.note{font-size:11px;color:#9CA3AF;margin-bottom:12px}' +
    '.legend{display:flex;gap:16px;margin-bottom:8px;font-size:11px;color:#6B7280;align-items:center}' +
    '.legend-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}' +
    '</style></head><body>' +
    '<h1>MUSUBU 診断 管理ダッシュボード</h1>' +
    '<p class="meta">最終更新: ' + updatedAt + ' &nbsp;|&nbsp; <a href="/admin" style="color:#7EBFBB">更新</a></p>' +
    '<div class="kpi-grid">' + kpiHtml + '</div>' +
    '<section><h2>📊 離脱ファネル</h2>' +
    '<div class="legend">' +
    '<span class="legend-dot" style="background:#7EBFBB"></span>通常' +
    '<span class="legend-dot" style="background:#EF4444"></span>前比 70% 未満（要注意）' +
    '</div>' +
    funnelSvg + '</section>' +
    '<section><h2>📉 設問別到達数（Q1〜Q50）</h2>' +
    '<p class="note">10問ブロック単位のステップ表示です。点線の垂直線がブロック間の離脱ポイント（赤＝70%未満の大きな離脱）を示します。</p>' +
    '<div class="legend">' +
    '<span class="legend-dot" style="background:#7EBFBB"></span>到達数' +
    '<span class="legend-dot" style="background:#EF4444"></span>大きな離脱' +
    '</div>' +
    lineSvg + '</section>' +
    '</body></html>';
}

app.get('/admin', async (req, res) => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(503).send('Admin is not configured. Set ADMIN_PASSWORD environment variable.');
  }

  // Basic 認証チェック
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="MUSUBU Admin"');
    return res.status(401).send('Unauthorized');
  }
  const decoded  = Buffer.from(authHeader.slice(6), 'base64').toString();
  const colonIdx = decoded.indexOf(':');
  const user     = decoded.slice(0, colonIdx);
  const pass     = decoded.slice(colonIdx + 1);
  if (user !== 'admin' || pass !== adminPassword) {
    res.set('WWW-Authenticate', 'Basic realm="MUSUBU Admin"');
    return res.status(401).send('Unauthorized');
  }

  try {
    const doc  = await firestore.collection('analytics').doc('counters').get();
    const data = doc.exists ? doc.data() : {};
    res.send(buildAdminHtml(data));
  } catch (err) {
    console.error('GET /admin error:', err);
    res.status(500).send('Internal server error');
  }
});

// SPA フォールバック（不要だがSPA対応として念のため）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  const key = process.env.ANTHROPIC_API_KEY || '';
  console.log(`ANTHROPIC_API_KEY: ${key ? '✅ セット済み' : '❌ 未セット'}`);
  if (key) {
    console.log(`キー確認: 先頭=${key.slice(0, 12)} 末尾=${key.slice(-4)} 文字数=${key.length}`);
  }
});
