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
  { id: 5,  text: '人前で話すことに抵抗はありませんか？' },
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
// ========================================
function renderBlock(blockNum) {
  const startIdx = (blockNum - 1) * BLOCK_SIZE;
  const blockQuestions = QUESTIONS.slice(startIdx, startIdx + BLOCK_SIZE);
  const container = document.getElementById('questions-block' + blockNum);
  if (!container) return;

  container.innerHTML = blockQuestions.map(function (q) {
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
        '<p class="question-number">Q' + q.id + '</p>',
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
  const blockQuestions = QUESTIONS.slice(startIdx, startIdx + BLOCK_SIZE);
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
// 氏名送信
// ========================================
async function submitUserInfo() {
  var nameInput = document.getElementById('input-name');
  var errorEl  = document.getElementById('userinfo-error');
  var name = nameInput ? nameInput.value.trim() : '';

  if (!name) {
    nameInput.classList.add('error');
    errorEl.textContent = '氏名を入力してください。';
    errorEl.style.display = 'block';
    return;
  }

  nameInput.classList.remove('error');
  errorEl.style.display = 'none';

  var progress = loadProgress();
  if (progress) {
    progress.completed = true;
    progress.name = name;
    saveProgress(progress);
    // API更新（completed=true, name保存）
    apiUpdateSession(progress.session_id, { completed: true, name: name });
  }

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

  // 氏名入力フィールドのエラー解除
  var inputName = document.getElementById('input-name');
  if (inputName) {
    inputName.addEventListener('input', function () {
      inputName.classList.remove('error');
      var errorEl = document.getElementById('userinfo-error');
      if (errorEl) errorEl.style.display = 'none';
    });
  }

  // 初期化
  init();
});
