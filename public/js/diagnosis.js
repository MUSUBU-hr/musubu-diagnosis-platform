/**
 * MUSUBU 適職診断 - diagnosis.js
 * 診断ロジック・進捗管理
 */

'use strict';

// ========================================
// 設問データ（全50問・ダミー）
// ※実際の設問に差し替える際はここだけ変更
// ========================================
const QUESTIONS = [
  // --- Block 1: Q1〜Q10（対人関係・コミュニケーション） ---
  { id: 1,  text: 'あなたは人と話すことが好きですか？' },
  { id: 2,  text: '初対面の人とも自然に会話が弾む方ですか？' },
  { id: 3,  text: 'チームで一緒に仕事をすることが好きですか？' },
  { id: 4,  text: '人の悩みを聞くのが得意ですか？' },
  { id: 5,  text: '人前でのスピーチや発表が得意ですか？' },
  { id: 6,  text: '人の気持ちをすぐに察することができますか？' },
  { id: 7,  text: '自分の意見をはっきり伝えることが得意ですか？' },
  { id: 8,  text: '会議や打ち合わせが好きですか？' },
  { id: 9,  text: '顧客や取引先と直接やり取りすることが好きですか？' },
  { id: 10, text: '知らない人の多い環境でも楽しめますか？' },

  // --- Block 2: Q11〜Q20（仕事スタイル） ---
  { id: 11, text: '計画を立てて物事を進めることが得意ですか？' },
  { id: 12, text: '締め切りを守ることは当然と思いますか？' },
  { id: 13, text: '複数の仕事を同時に進めることが得意ですか？' },
  { id: 14, text: '細かいミスを見つけるのが得意ですか？' },
  { id: 15, text: '決められたルールに従って仕事をすることが苦になりませんか？' },
  { id: 16, text: 'データや数字を扱うのが好きですか？' },
  { id: 17, text: '書類や資料の整理が得意ですか？' },
  { id: 18, text: '一人で黙々と作業することが好きですか？' },
  { id: 19, text: '新しいやり方を試してみることが好きですか？' },
  { id: 20, text: '完璧を追求することが多いですか？' },

  // --- Block 3: Q21〜Q30（問題解決・思考スタイル） ---
  { id: 21, text: '問題が起きたときに冷静に対処できますか？' },
  { id: 22, text: '原因を分析してから行動することが多いですか？' },
  { id: 23, text: 'アイデアを出すのが得意ですか？' },
  { id: 24, text: '難しい問題を解くことにやりがいを感じますか？' },
  { id: 25, text: '物事の全体像を把握してから動く方ですか？' },
  { id: 26, text: '直感で判断することが多いですか？' },
  { id: 27, text: '複雑な情報を整理して分かりやすく伝えることが得意ですか？' },
  { id: 28, text: '失敗を学びの機会として前向きに捉えられますか？' },
  { id: 29, text: '仮説を立てて検証するプロセスが好きですか？' },
  { id: 30, text: '予期せぬ出来事にも柔軟に対応できますか？' },

  // --- Block 4: Q31〜Q40（仕事への価値観） ---
  { id: 31, text: '社会の役に立っていると感じられる仕事がしたいですか？' },
  { id: 32, text: '高い収入を得ることに強い関心がありますか？' },
  { id: 33, text: '自分のペースで働けることを重視しますか？' },
  { id: 34, text: '責任ある立場で働きたいですか？' },
  { id: 35, text: '自分のスキルを常に高めていきたいですか？' },
  { id: 36, text: '安定した環境で長く働きたいですか？' },
  { id: 37, text: 'クリエイティブな仕事に魅力を感じますか？' },
  { id: 38, text: '人の成長をサポートすることにやりがいを感じますか？' },
  { id: 39, text: '競争のある環境でこそ力が発揮できますか？' },
  { id: 40, text: '自分のアイデアを形にできる仕事が好きですか？' },

  // --- Block 5: Q41〜Q50（行動・環境の好み） ---
  { id: 41, text: '変化の多い環境が好きですか？' },
  { id: 42, text: '屋外での活動が好きですか？' },
  { id: 43, text: '一つのことを深く極めていきたいですか？' },
  { id: 44, text: '多様な分野に興味を持っていますか？' },
  { id: 45, text: '自分で判断して動くことが多いですか？' },
  { id: 46, text: '目に見える成果物を作ることが好きですか？' },
  { id: 47, text: '新しい場所に行くことが好きですか？' },
  { id: 48, text: '仕事でも遊び心を大切にしたいですか？' },
  { id: 49, text: '長期的な目標に向かって努力することが得意ですか？' },
  { id: 50, text: '今の自分を変えたいという気持ちが強いですか？' },
];

// ========================================
// 定数
// ========================================
const BLOCK_SIZE   = 10;
const TOTAL_BLOCKS = 5;
const STORAGE_KEY  = 'musubu_diagnosis';

// ========================================
// タイプ別 設問マッピング
// pos: 順方向（高スコア＝タイプ強い）
// neg: 逆転（高スコア＝タイプ弱い → 6-answer で処理）
// ========================================
const TYPE_MAP = {
  leader:     { pos: [2, 5, 7, 8, 25, 32, 34, 39, 45], neg: [18] },
  supporter:  { pos: [1, 3, 4, 6, 31, 38],              neg: [18] },
  analyst:    { pos: [11, 14, 16, 17, 21, 22, 27, 29],  neg: [] },
  creator:    { pos: [19, 23, 26, 37, 40, 44, 46, 48],  neg: [] },
  specialist: { pos: [12, 15, 18, 20, 24, 33, 35, 36, 43, 49], neg: [41] },
  challenger: { pos: [9, 10, 13, 28, 30, 41, 42, 47, 50],      neg: [36, 43] },
};

// ========================================
// タイプ別 結果テキスト
// ========================================
const RESULT_TYPES = {
  leader: {
    label: 'リーダータイプ',
    icon: '👑',
    tagline: '人を動かし、未来を切り拓く',
    gradient: 'linear-gradient(135deg, #FF6B35 0%, #F7C948 100%)',
    color: '#FF6B35',
    desc: '人を巻き込み、チームを引っ張っていくことに喜びを感じるタイプです。責任感が強く、周囲に影響を与えながら目標を達成することを得意とします。競争環境の中でも臆せず、積極的に前に出る行動力があります。',
    traits: ['決断力がある', '人を動かすのが得意', '責任感が強い'],
    mapX: 78, mapY: 82,
  },
  supporter: {
    label: 'サポータータイプ',
    icon: '🤝',
    tagline: '人の力を引き出す、縁の下の力持ち',
    gradient: 'linear-gradient(135deg, #06C755 0%, #4ECDC4 100%)',
    color: '#06C755',
    desc: '人の気持ちに寄り添い、チームや組織を内側から支えることに長けたタイプです。共感力が高く、周囲の人が安心して力を発揮できる環境をつくることを得意とします。縁の下の力持ちとして、チーム全体の成果を底上げします。',
    traits: ['共感力が高い', '人の話をよく聞く', 'チームを陰で支える'],
    mapX: 72, mapY: 210,
  },
  analyst: {
    label: 'アナリストタイプ',
    icon: '🔍',
    tagline: 'データと論理で、最適解を導く',
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
    color: '#3B82F6',
    desc: 'データや論理を基に物事を深く考察し、正確な判断を下すことを得意とするタイプです。感情より事実を重視し、細部まで丁寧に分析するプロセスに充実感を覚えます。複雑な問題ほど本領を発揮します。',
    traits: ['論理的思考が得意', '細部への注意力が高い', 'データに基づいて判断できる'],
    mapX: 198, mapY: 205,
  },
  creator: {
    label: 'クリエイタータイプ',
    icon: '🎨',
    tagline: '発想力と表現力で、新しい世界をつくる',
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
    color: '#8B5CF6',
    desc: '新しいアイデアを生み出し、それを独自の形で表現することに情熱を持つタイプです。既存の枠にとらわれず、遊び心と発想力を武器に新しい価値を創造します。自分のビジョンを形にするプロセス自体を楽しめます。',
    traits: ['発想力が豊か', '型破りな発想ができる', '表現することが好き'],
    mapX: 205, mapY: 82,
  },
  specialist: {
    label: 'スペシャリストタイプ',
    icon: '🎯',
    tagline: 'ひとつの道を深く極める、本物のプロ',
    gradient: 'linear-gradient(135deg, #0F172A 0%, #1E40AF 100%)',
    color: '#1E40AF',
    desc: '一つの分野を深く極めることに強いこだわりと誇りを持つタイプです。コツコツと積み上げる努力を惜しまず、高い専門性をもって質の高いアウトプットを追求します。長期的な視点で自分のスキルを磨き続けます。',
    traits: ['専門性へのこだわりが強い', '継続力・忍耐力がある', '品質にこだわる完璧主義'],
    mapX: 238, mapY: 178,
  },
  challenger: {
    label: 'チャレンジャータイプ',
    icon: '🚀',
    tagline: '変化を味方に、どこまでも前へ',
    gradient: 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)',
    color: '#06B6D4',
    desc: '変化や刺激を好み、新しい環境・経験に積極的に飛び込んでいくタイプです。現状維持よりも挑戦を選び、失敗を恐れずにどんどん前に進む行動力があります。多様な分野への好奇心を原動力に、幅広く活躍できます。',
    traits: ['変化への適応力が高い', '好奇心旺盛', '行動が速い'],
    mapX: 142, mapY: 58,
  },
};

// ========================================
// UUID生成
// ========================================
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ========================================
// localStorage
// ========================================
function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveProgress(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    // localStorage が使えない場合はサイレントに無視
  }
}

function clearProgress() {
  localStorage.removeItem(STORAGE_KEY);
}

// ========================================
// API呼び出し（失敗時はサイレントに継続）
// ========================================
async function apiCreateSession() {
  try {
    const res = await fetch('/api/sessions', { method: 'POST' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.session_id || null;
  } catch (e) {
    return null;
  }
}

async function apiUpdateSession(sessionId, updates) {
  if (!sessionId) return;
  try {
    await fetch('/api/sessions/' + sessionId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  } catch (e) {
    // サイレントに無視
  }
}

async function apiGetSession(sessionId) {
  if (!sessionId) return null;
  try {
    const res = await fetch('/api/sessions/' + sessionId);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

// ========================================
// 画面切り替え
// ========================================
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(function (el) {
    el.classList.remove('active');
  });
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add('active');
  }
  window.scrollTo(0, 0);
}

// ========================================
// 設問レンダリング
// 全50問をシャッフルして5分割したものを保持
// ========================================
var _shuffledQuestions = null;

function buildShuffledQuestions() {
  var arr = QUESTIONS.slice();
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  _shuffledQuestions = arr;
}

function renderBlock(blockNum) {
  var startIdx = (blockNum - 1) * BLOCK_SIZE;
  var blockQuestions = _shuffledQuestions.slice(startIdx, startIdx + BLOCK_SIZE);

  const container = document.getElementById('questions-block' + blockNum);
  if (!container) return;

  var blockOffset = (blockNum - 1) * BLOCK_SIZE;
  container.innerHTML = blockQuestions.map(function (q, idx) {
    var displayNum = blockOffset + idx + 1;
    var scaleOptions = [1, 2, 3, 4, 5].map(function (val) {
      return [
        '<label class="scale-label">',
          '<input type="radio" name="q' + q.id + '" value="' + val + '">',
          '<span class="scale-btn">' + val + '</span>',
        '</label>',
      ].join('');
    }).join('');

    return [
      '<div class="question-card" data-qid="' + q.id + '">',
        '<p class="question-number">Q' + displayNum + '</p>',
        '<p class="question-text">' + escapeHtml(q.text) + '</p>',
        '<div class="scale-group">',
          '<div class="scale-ends">',
            '<span>まったくそう思わない</span>',
            '<span>とてもそう思う</span>',
          '</div>',
          '<div class="scale-options">' + scaleOptions + '</div>',
        '</div>',
      '</div>',
    ].join('');
  }).join('');

  // 回答時にカードをハイライト
  container.querySelectorAll('input[type="radio"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      const card = radio.closest('.question-card');
      if (card) card.classList.add('answered');
    });
  });
}

function renderAllBlocks() {
  buildShuffledQuestions();
  for (var i = 1; i <= TOTAL_BLOCKS; i++) {
    renderBlock(i);
  }
}

// ========================================
// XSSガード
// ========================================
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ========================================
// バリデーション
// ========================================
function validateBlock(blockNum) {
  const startIdx = (blockNum - 1) * BLOCK_SIZE;
  const blockQuestions = _shuffledQuestions.slice(startIdx, startIdx + BLOCK_SIZE);
  const unanswered = [];

  blockQuestions.forEach(function (q) {
    const selected = document.querySelector('input[name="q' + q.id + '"]:checked');
    if (!selected) {
      unanswered.push(q.id);
      // 未回答カードを目立たせる
      const card = document.querySelector('.question-card[data-qid="' + q.id + '"]');
      if (card) {
        card.style.borderColor = 'var(--color-error)';
        card.style.animation = 'none';
        // 軽く振動させる
        setTimeout(function () { card.style.animation = ''; }, 10);
      }
    }
  });

  return unanswered.length === 0;
}

function showValidationError(blockNum, message) {
  const footer = document.querySelector('#screen-block' + blockNum + ' .block-footer');
  if (!footer) return;

  // 既存エラーメッセージを削除
  const existing = footer.querySelector('.validation-msg');
  if (existing) existing.remove();

  const msg = document.createElement('p');
  msg.className = 'validation-msg';
  msg.textContent = message;
  footer.insertBefore(msg, footer.firstChild);
}

function clearValidationError(blockNum) {
  const footer = document.querySelector('#screen-block' + blockNum + ' .block-footer');
  if (!footer) return;
  const existing = footer.querySelector('.validation-msg');
  if (existing) existing.remove();

  // カードのエラーボーダーをリセット
  const container = document.getElementById('questions-block' + blockNum);
  if (container) {
    container.querySelectorAll('.question-card').forEach(function (card) {
      card.style.borderColor = '';
    });
  }
}

// ========================================
// ブロック遷移
// ========================================
function goToBlock(blockNum) {
  var progress = loadProgress();
  if (progress) {
    progress.max_block = Math.max(progress.max_block, blockNum);
    saveProgress(progress);
    // API更新（失敗しても続行）
    apiUpdateSession(progress.session_id, { max_block: progress.max_block });
  }
  showScreen('screen-block' + blockNum);
}

function submitBlock(blockNum) {
  clearValidationError(blockNum);

  if (!validateBlock(blockNum)) {
    showValidationError(blockNum, 'すべての質問にお答えください。');
    // 最初の未回答カードへスクロール
    const firstError = document.querySelector('#screen-block' + blockNum + ' .question-card[style*="border-color"]');
    if (firstError) {
      firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }

  if (blockNum < TOTAL_BLOCKS) {
    goToBlock(blockNum + 1);
  } else {
    // Block5 完了 → 氏名入力画面
    var progress = loadProgress();
    if (progress) {
      progress.max_block = TOTAL_BLOCKS;
      progress.questions_done = true;
      saveProgress(progress);
      apiUpdateSession(progress.session_id, { max_block: TOTAL_BLOCKS });
    }
    showScreen('screen-userinfo');
  }
}

// ========================================
// スコアリング
// ========================================
function getAnswers() {
  var answers = {};
  for (var q = 1; q <= 50; q++) {
    var selected = document.querySelector('input[name="q' + q + '"]:checked');
    answers[q] = selected ? parseInt(selected.value, 10) : 0;
  }
  return answers;
}

function calculateScores(answers) {
  var scores = {};
  Object.keys(TYPE_MAP).forEach(function (type) {
    var mapping = TYPE_MAP[type];
    var allQids = mapping.pos.concat(mapping.neg);
    var total = allQids.reduce(function (sum, qid) {
      var val = answers[qid] || 0;
      if (val > 0 && mapping.neg.indexOf(qid) !== -1) val = 6 - val;
      return sum + val;
    }, 0);
    scores[type] = Math.round((total / allQids.length) * 10) / 10;
  });
  return scores;
}

function calculateType(scores) {
  var sorted = Object.keys(scores).sort(function (a, b) { return scores[b] - scores[a]; });
  return sorted[0] || 'challenger';
}

function calculateSubType(scores, mainType) {
  var sorted = Object.keys(scores).sort(function (a, b) { return scores[b] - scores[a]; });
  return sorted[1] || 'supporter';
}

// ========================================
// 結果レンダリング
// ========================================
function buildMapSVG(activeKey) {
  var W = 280, H = 260;
  var cx = 140, cy = 130;

  var lines = [
    // 背景
    '<rect width="' + W + '" height="' + H + '" rx="12" fill="#F8FAFC"/>',
    // 象限の薄い色
    '<rect x="36" y="26" width="104" height="104" rx="6" fill="#FFF7ED" opacity="0.7"/>',
    '<rect x="140" y="26" width="104" height="104" rx="6" fill="#F5F3FF" opacity="0.7"/>',
    '<rect x="36" y="130" width="104" height="104" rx="6" fill="#F0FDF4" opacity="0.7"/>',
    '<rect x="140" y="130" width="104" height="104" rx="6" fill="#EFF6FF" opacity="0.7"/>',
    // 軸
    '<line x1="140" y1="16" x2="140" y2="244" stroke="#CBD5E1" stroke-width="1.5"/>',
    '<line x1="26" y1="130" x2="254" y2="130" stroke="#CBD5E1" stroke-width="1.5"/>',
    // 軸ラベル
    '<text x="140" y="13" text-anchor="middle" font-size="12" fill="#94A3B8" font-weight="600">変化志向</text>',
    '<text x="140" y="257" text-anchor="middle" font-size="12" fill="#94A3B8" font-weight="600">安定志向</text>',
    '<text x="19" y="133" text-anchor="middle" font-size="11" fill="#94A3B8" font-weight="600">対人志向</text>',
    '<text x="261" y="133" text-anchor="middle" font-size="11" fill="#94A3B8" font-weight="600">対課題志向</text>',
  ];

  // 非アクティブタイプのドット
  Object.keys(RESULT_TYPES).forEach(function (key) {
    if (key === activeKey) return;
    var t = RESULT_TYPES[key];
    lines.push(
      '<circle cx="' + t.mapX + '" cy="' + t.mapY + '" r="14" fill="' + t.color + '" opacity="0.15"/>',
      '<circle cx="' + t.mapX + '" cy="' + t.mapY + '" r="8" fill="' + t.color + '" opacity="0.35"/>',
      '<text x="' + t.mapX + '" y="' + (t.mapY + 24) + '" text-anchor="middle" font-size="11" fill="' + t.color + '" font-weight="600">' + t.label.replace('タイプ', '') + '</text>'
    );
  });

  // アクティブタイプのドット（パルス付き）
  var a = RESULT_TYPES[activeKey];
  lines.push(
    '<circle cx="' + a.mapX + '" cy="' + a.mapY + '" r="24" fill="' + a.color + '" opacity="0.15"><animate attributeName="r" values="20;28;20" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.2;0.05;0.2" dur="2s" repeatCount="indefinite"/></circle>',
    '<circle cx="' + a.mapX + '" cy="' + a.mapY + '" r="16" fill="' + a.color + '"/>',
    '<text x="' + a.mapX + '" y="' + (a.mapY + 5) + '" text-anchor="middle" font-size="12" fill="#fff" font-weight="900">★</text>',
    '<text x="' + a.mapX + '" y="' + (a.mapY + 30) + '" text-anchor="middle" font-size="12" fill="' + a.color + '" font-weight="700">あなた</text>'
  );

  return '<svg class="axis-map-svg" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">'
    + lines.join('') + '</svg>';
}

function buildScoreBars(scores, topKey, subKey) {
  var order = ['leader', 'challenger', 'creator', 'supporter', 'analyst', 'specialist'];
  return order.map(function (key) {
    var t = RESULT_TYPES[key];
    var pct = Math.round((scores[key] / 5) * 100);
    var isTop = key === topKey;
    var isSub = key === subKey;
    var cls = 'score-item' + (isTop ? ' is-top' : isSub ? ' is-sub' : '');
    var badge = isTop ? '<span class="score-rank-badge is-main">メイン</span>'
               : isSub ? '<span class="score-rank-badge is-sub-badge">サブ</span>'
               : '';
    return '<div class="' + cls + '">'
      + '<div class="score-label">'
      + (badge ? '<div class="score-label-stack">' + badge + '<div class="score-label-name"><span>' + t.icon + '</span>' + t.label.replace('タイプ', '') + '</div></div>' : '<span>' + t.icon + '</span>' + t.label.replace('タイプ', ''))
      + '</div>'
      + '<div class="score-track"><div class="score-fill" data-target="' + pct + '%" style="background:' + t.color + ';"></div></div>'
      + '<div class="score-value">' + scores[key].toFixed(1) + '</div>'
      + '</div>';
  }).join('');
}

function renderResult(typeKey, subTypeKey, scores) {
  var type = RESULT_TYPES[typeKey];
  if (!type) return;

  // サブタイプ
  var subtypeEl = document.getElementById('result-subtype');
  if (subtypeEl && subTypeKey && RESULT_TYPES[subTypeKey]) {
    var sub = RESULT_TYPES[subTypeKey];
    subtypeEl.innerHTML = '<div class="result-subtype-inner">'
      + '<span class="result-subtype-prefix">サブタイプ</span>'
      + '<span class="result-subtype-name">' + sub.label + '</span>'
      + '</div>';
  }

  // Hero
  var heroEl = document.getElementById('result-hero');
  if (heroEl) heroEl.style.background = type.gradient;

  var emojiEl = document.getElementById('result-emoji');
  if (emojiEl) {
    // アニメーション再トリガー
    emojiEl.style.animation = 'none';
    emojiEl.textContent = type.icon;
    requestAnimationFrame(function () { emojiEl.style.animation = ''; });
  }

  var nameEl = document.getElementById('result-type-name');
  if (nameEl) nameEl.textContent = type.label;

  var taglineEl = document.getElementById('result-tagline');
  if (taglineEl) taglineEl.textContent = type.tagline;

  // 傾向マップ
  var mapEl = document.getElementById('result-map');
  if (mapEl) mapEl.innerHTML = buildMapSVG(typeKey);

  // スコアバー（スコアがある場合のみ）
  var scoresEl = document.getElementById('result-scores');
  if (scoresEl) {
    if (scores) {
      scoresEl.innerHTML = buildScoreBars(scores, typeKey, subTypeKey);
      // バーをアニメーション
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          scoresEl.querySelectorAll('.score-fill').forEach(function (el) {
            el.style.width = el.dataset.target;
          });
        });
      });
    } else {
      scoresEl.closest('.result-card').style.display = 'none';
    }
  }

  // タイプ見出し
  var titleEl = document.getElementById('result-type-title');
  if (titleEl) titleEl.textContent = type.icon + ' ' + type.label + 'とは';

  // 説明文
  var descEl = document.getElementById('result-type-desc');
  if (descEl) descEl.textContent = type.desc;

  // 特徴チップ
  var traitsEl = document.getElementById('result-type-traits');
  if (traitsEl) {
    traitsEl.innerHTML = type.traits.map(function (trait) {
      return '<div class="trait-chip">'
        + '<span class="trait-chip-icon">' + type.icon + '</span>'
        + '<span>' + escapeHtml(trait) + '</span>'
        + '</div>';
    }).join('');
  }
}

// ========================================
// LLM分析・アドバイザーメモ生成
// ========================================
async function analyzeWithLLM(name, mainType, subType, scores, answers) {
  try {
    var qa = QUESTIONS.map(function (q) {
      return { id: q.id, text: q.text, value: answers[q.id] || 0 };
    });

    var res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, main_type: mainType, sub_type: subType, scores: scores, qa: qa }),
    });

    if (!res.ok) return;
    var data = await res.json();

    // AI分析テキスト
    var analysisEl = document.getElementById('result-analysis');
    if (analysisEl) {
      if (data.analysis) {
        analysisEl.innerHTML = '<p class="analysis-text">' + escapeHtml(data.analysis) + '</p>';
      } else {
        analysisEl.innerHTML = '<p class="analysis-text" style="color:var(--color-text-sub)">分析を取得できませんでした。</p>';
      }
    }

    // 武器・環境・モチベーション（個別カード）
    var na = '<p class="analysis-item-text" style="color:var(--color-text-sub)">-</p>';
    var weaponEl = document.getElementById('result-weapon');
    if (weaponEl) weaponEl.innerHTML = data.weapon ? '<p class="analysis-item-text">' + escapeHtml(data.weapon) + '</p>' : na;
    var envEl = document.getElementById('result-environment');
    if (envEl) envEl.innerHTML = data.environment ? '<p class="analysis-item-text">' + escapeHtml(data.environment) + '</p>' : na;
    var motivEl = document.getElementById('result-motivation');
    if (motivEl) motivEl.innerHTML = data.motivation ? '<p class="analysis-item-text">' + escapeHtml(data.motivation) + '</p>' : na;

    // アドバイザーメモ
    var memoEl = document.getElementById('result-advisor-memo');
    if (memoEl) {
      if (data.advisor_memo) {
        var mainLabel = RESULT_TYPES[mainType] ? RESULT_TYPES[mainType].label : mainType;
        var subLabel  = RESULT_TYPES[subType]  ? RESULT_TYPES[subType].label  : subType;
        var date = new Date().toLocaleDateString('ja-JP');
        var scoreLines = Object.keys(scores)
          .sort(function (a, b) { return scores[b] - scores[a]; })
          .map(function (k) {
            var lbl = RESULT_TYPES[k] ? RESULT_TYPES[k].label : k;
            return lbl + ': ' + Number(scores[k]).toFixed(1);
          }).join('\n');

        var fullMemo = [
          '━━━━━━━━━━━━━━━━━━━━━━━━━━',
          'MUSUBU キャリアタイプ診断レポート',
          '━━━━━━━━━━━━━━━━━━━━━━━━━━',
          '氏名: ' + name,
          '診断日: ' + date,
          '',
          'メインタイプ: ' + mainLabel,
          'サブタイプ:   ' + subLabel,
          '',
          '■ タイプ別スコア',
          scoreLines,
          '',
          '■ キャリアアドバイザーへのメモ',
          data.advisor_memo,
          '━━━━━━━━━━━━━━━━━━━━━━━━━━',
        ].join('\n');

        window._advisorMemoText = fullMemo;

        memoEl.innerHTML = '<div class="advisor-memo-box">' + escapeHtml(data.advisor_memo) + '</div>'
          + '<button class="btn-copy" id="btn-copy-memo">📋 コピー</button>';

        var copyBtn = document.getElementById('btn-copy-memo');
        if (copyBtn) {
          copyBtn.addEventListener('click', function () {
            navigator.clipboard.writeText(window._advisorMemoText || data.advisor_memo).then(function () {
              copyBtn.textContent = '✓ コピーしました';
              copyBtn.classList.add('copied');
              setTimeout(function () {
                copyBtn.textContent = '📋 コピー';
                copyBtn.classList.remove('copied');
              }, 2000);
            });
          });
        }

        // localStorageに保存
        var progress = loadProgress();
        if (progress) {
          progress.analysis    = data.analysis;
          progress.advisor_memo = data.advisor_memo;
          saveProgress(progress);
        }
      } else {
        memoEl.innerHTML = '<p class="analysis-text" style="color:var(--color-text-sub)">メモを取得できませんでした。</p>';
      }
    }
  } catch (e) {
    var el = document.getElementById('result-analysis');
    if (el) el.innerHTML = '<p class="analysis-text" style="color:var(--color-text-sub)">分析を取得できませんでした。</p>';
    var mel = document.getElementById('result-advisor-memo');
    if (mel) mel.innerHTML = '<p class="analysis-text" style="color:var(--color-text-sub)">メモを取得できませんでした。</p>';
    var errMsg = '<p class="analysis-item-text" style="color:var(--color-text-sub)">-</p>';
    var we = document.getElementById('result-weapon');      if (we) we.innerHTML = errMsg;
    var ee = document.getElementById('result-environment'); if (ee) ee.innerHTML = errMsg;
    var me = document.getElementById('result-motivation');  if (me) me.innerHTML = errMsg;
  }
}

// ========================================
// 氏名送信
// ========================================
async function submitUserInfo() {
  var lastInput  = document.getElementById('input-last-name');
  var firstInput = document.getElementById('input-first-name');
  var errorEl    = document.getElementById('userinfo-error');

  var lastName  = lastInput  ? lastInput.value.trim()  : '';
  var firstName = firstInput ? firstInput.value.trim() : '';

  // バリデーション
  var hasError = false;
  if (!lastName)  { lastInput.classList.add('error');  hasError = true; }
  if (!firstName) { firstInput.classList.add('error'); hasError = true; }
  if (hasError) {
    errorEl.textContent = '姓と名を入力してください。';
    errorEl.style.display = 'block';
    return;
  }

  lastInput.classList.remove('error');
  firstInput.classList.remove('error');
  errorEl.style.display = 'none';

  var name = lastName + ' ' + firstName;

  var answers    = getAnswers();
  var scores     = calculateScores(answers);
  var typeKey    = calculateType(scores);
  var subTypeKey = calculateSubType(scores, typeKey);
  renderResult(typeKey, subTypeKey, scores);

  // 結果画面の氏名を反映
  var nameEl = document.getElementById('result-name');
  if (nameEl) nameEl.textContent = name;
  var nameAnalysisEl = document.getElementById('result-name-analysis');
  if (nameAnalysisEl) nameAnalysisEl.textContent = name;

  var progress = loadProgress();
  if (progress) {
    progress.completed      = true;
    progress.name           = name;
    progress.result_type    = typeKey;
    progress.result_subtype = subTypeKey;
    progress.result_scores  = scores;
    saveProgress(progress);
    apiUpdateSession(progress.session_id, { completed: true, name: name, result_type: typeKey });
  }

  // LLM分析（非同期・結果画面表示後に更新）
  analyzeWithLLM(name, typeKey, subTypeKey, scores, answers);

  showScreen('screen-result');
}

// ========================================
// 診断開始
// ========================================
async function startDiagnosis() {
  // APIでセッションを作成し、session_idを取得（失敗時はローカルUUIDを使用）
  var apiSessionId = await apiCreateSession();

  var progress = {
    session_id: apiSessionId || generateUUID(),
    max_block:  1,
    completed:  false,
  };
  saveProgress(progress);
  renderAllBlocks();
  goToBlock(1);
}

// ========================================
// 再スタート
// ========================================
function restartDiagnosis() {
  clearProgress();
  // 設問フォームをリセット
  document.querySelectorAll('input[type="radio"]').forEach(function (r) {
    r.checked = false;
  });
  document.querySelectorAll('.question-card').forEach(function (card) {
    card.classList.remove('answered');
    card.style.borderColor = '';
  });
  showScreen('screen-start');
}

// ========================================
// 初期化
// ========================================
async function init() {
  var progress = loadProgress();

  if (!progress) {
    // 初回訪問
    showScreen('screen-start');
    return;
  }

  // サーバー側の状態で上書き（APIが使えない場合はlocalStorageのまま）
  var serverState = await apiGetSession(progress.session_id);
  if (serverState) {
    progress.max_block = serverState.max_block;
    progress.completed = serverState.completed;
    saveProgress(progress);
  }

  if (progress.completed) {
    // 完走済み（氏名入力済み）→ 結果画面
    if (progress.result_type) {
      renderResult(progress.result_type, progress.result_subtype || null, progress.result_scores || null);
      // 保存済み分析を復元
      if (progress.analysis) {
        var el = document.getElementById('result-analysis');
        if (el) el.innerHTML = '<p class="analysis-text">' + escapeHtml(progress.analysis) + '</p>';
      }
      if (progress.advisor_memo) {
        var memoEl = document.getElementById('result-advisor-memo');
        if (memoEl) {
          window._advisorMemoText = progress.advisor_memo;
          memoEl.innerHTML = '<div class="advisor-memo-box">' + escapeHtml(progress.advisor_memo) + '</div>'
            + '<button class="btn-copy" id="btn-copy-memo">📋 コピー</button>';
          var copyBtn = document.getElementById('btn-copy-memo');
          if (copyBtn) {
            copyBtn.addEventListener('click', function () {
              navigator.clipboard.writeText(window._advisorMemoText).then(function () {
                copyBtn.textContent = '✓ コピーしました';
                copyBtn.classList.add('copied');
                setTimeout(function () { copyBtn.textContent = '📋 コピー'; copyBtn.classList.remove('copied'); }, 2000);
              });
            });
          }
        }
      }
    }
    showScreen('screen-result');
    return;
  }

  if (progress.questions_done) {
    // 50問完了・氏名未入力 → 氏名入力画面
    showScreen('screen-userinfo');
    return;
  }

  // 途中から再開
  renderAllBlocks();
  goToBlock(progress.max_block);
}

// ========================================
// イベントバインド
// ========================================
document.addEventListener('DOMContentLoaded', function () {
  // 開始ボタン
  var btnStart = document.getElementById('btn-start');
  if (btnStart) {
    btnStart.addEventListener('click', startDiagnosis);
  }

  // 再診断ボタン
  var btnRestart = document.getElementById('btn-restart');
  if (btnRestart) {
    btnRestart.addEventListener('click', restartDiagnosis);
  }

  // 各ブロックの「次へ」ボタン
  for (var i = 1; i <= TOTAL_BLOCKS; i++) {
    (function (blockNum) {
      var btn = document.getElementById('btn-next-block' + blockNum);
      if (btn) {
        btn.addEventListener('click', function () {
          submitBlock(blockNum);
        });
      }
    })(i);
  }

  // 氏名送信ボタン
  var btnUserInfo = document.getElementById('btn-submit-userinfo');
  if (btnUserInfo) {
    btnUserInfo.addEventListener('click', submitUserInfo);
  }

  // 姓・名入力フィールドのエラー解除
  ['input-last-name', 'input-first-name'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', function () {
        el.classList.remove('error');
        var errorEl = document.getElementById('userinfo-error');
        if (errorEl) errorEl.style.display = 'none';
      });
    }
  });

  // 初期化
  init();
});
