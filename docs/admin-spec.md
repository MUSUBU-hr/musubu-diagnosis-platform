# MUSUBU 診断 管理・計測・メール 仕様書

---

## 1. 概要

診断フローの各ステップにおける離脱ポイントを可視化し、診断結果をCAにメール通知するシステム。

| 機能 | 概要 |
|------|------|
| 離脱ポイント計測 | フロントエンドでイベントを発火し Firestore（日次ドキュメント）に集計 |
| 管理画面 | `/admin` で KPI・ファネル・設問別回答数グラフを確認 |
| 結果メール送付 | 診断完了時に結果・CA用メモを指定の Gmail に自動送信 |

---

## 2. 離脱ポイント計測

### 2-1. 計測イベント一覧

| イベント名           | 発火タイミング                             | 対応指標                   |
|----------------------|--------------------------------------------|----------------------------|
| `page_view`          | スタート画面が表示されたとき               | 表示回数                   |
| `diagnosis_start`    | 「診断をはじめる」ボタンクリック           | 診断開始数                 |
| `block_reach_1`      | Block 1 画面表示                           | Block 1 到達数             |
| `block_reach_2`      | Block 2 画面表示                           | Block 2 到達数             |
| `block_reach_3`      | Block 3 画面表示                           | Block 3 到達数             |
| `block_reach_4`      | Block 4 画面表示                           | Block 4 到達数             |
| `block_reach_5`      | Block 5 画面表示                           | Block 5 到達数             |
| `questions_complete` | Block 5「診断結果を見る」クリック          | 50 問完走数                |
| `userinfo_view`      | 氏名入力画面表示                           | 個人情報入力画面 到達数    |
| `result_view`        | 結果画面表示                               | 結果表示数                 |
| `cta_click`          | 「無料面談を予約する」クリック             | 面談 CTA クリック数        |
| `question_answered`  | 各設問に最初に回答したとき（Q1〜Q50）      | 設問別回答数（q1〜q50）    |

> **備考**
> - 同一セッションでも画面リロードのたびにカウントされる（重複排除なし）。
> - `question_answered` は同一設問への2回目以降の操作ではカウントしない（初回回答のみ）。

### 2-2. API: POST `/api/track`

フロントエンドからイベントを送信するエンドポイント。

**リクエスト**
```json
{ "event": "page_view", "session_id": "..." }
// question_answered の場合
{ "event": "question_answered", "question": 23, "session_id": "..." }
```

| フィールド   | 型     | 必須 | 説明 |
|--------------|--------|------|------|
| `event`      | string | ○    | イベント名（上表参照） |
| `question`   | number | △    | `question_answered` 時のみ。Q番号（1〜50） |
| `session_id` | string | △    | localStorage の session_id |

**レスポンス**
```json
{ "ok": true }          // 成功
{ "error": "Unknown event" }  // HTTP 400（不正イベント名）
```

**処理内容**
1. `event` が許可リストに含まれるか検証する。
2. JST 当日の日次ドキュメント（`analytics/YYYY-MM-DD`）の該当フィールドを `FieldValue.increment(1)` で加算する。
3. `question_answered` の場合は `q{N}` フィールドを加算する。

### 2-3. Firestore データ設計

**コレクション: `analytics`**
**ドキュメントID: `YYYY-MM-DD`（JST 日付）**

```
analytics/
  2026-02-23 {
    page_view:           number
    diagnosis_start:     number
    block_reach_1:       number
    block_reach_2:       number
    block_reach_3:       number
    block_reach_4:       number
    block_reach_5:       number
    questions_complete:  number
    userinfo_view:       number
    result_view:         number
    cta_click:           number
    q1:  number   // 設問 Q1 の初回回答数
    q2:  number
    ...
    q50: number
    updated_at: Timestamp
  }
```

- 単一の `counters` ドキュメントではなく日次ドキュメントに分割することで、期間指定集計に対応。
- ドキュメントが存在しない場合は `{ merge: true }` で初回書き込み時に自動作成。

---

## 3. 管理画面

### 3-1. URL・認証

```
https://<your-domain>/admin?period=all
```

- **認証**: HTTP Basic 認証
  - ユーザー名: `admin`（固定）
  - パスワード: 環境変数 `ADMIN_PASSWORD`（GCP Secret Manager で管理）
  - 未設定の場合は `503 Service Unavailable`

### 3-2. 計測期間の切り替え

クエリパラメーター `?period=` で集計期間を切り替える。

| パラメーター | 集計対象 |
|-------------|---------|
| `today` | JST 当日のドキュメント |
| `7d` | 直近 7 日分のドキュメントを合算 |
| `30d` | 直近 30 日分のドキュメントを合算 |
| `all`（デフォルト） | `analytics/` コレクション内の全日次ドキュメントを合算 |
| `custom` | `?from=YYYY-MM-DD&to=YYYY-MM-DD` で指定した範囲を合算 |

画面上部にプリセットボタン（今日 / 過去7日 / 過去30日 / 全期間）と日付入力フォーム（開始日〜終了日 ＋ 適用ボタン）を表示する。

### 3-3. 画面構成

```
┌─────────────────────────────────────────────────────┐
│  MUSUBU 診断 管理ダッシュボード                       │
│  集計時刻: 2026-02-23 14:32:00 (JST)                 │
│  [今日] [過去7日] [過去30日] [全期間]  [日付]〜[日付][適用] │
├─────────────────────────────────────────────────────┤
│  KPI サマリー（4 枚カード横並び）                     │
│  [表示回数] [診断開始率] [50問完走率] [CTAクリック率]  │
├─────────────────────────────────────────────────────┤
│  📊 離脱ファネル（横棒グラフ SVG）                    │
│  前比 70% 未満の行は赤でハイライト                    │
├─────────────────────────────────────────────────────┤
│  📉 設問別回答数 Q1〜Q50（折れ線グラフ SVG）           │
│  X軸: Q1,Q5,Q10,...,Q50（5問刻み）                   │
│  急落上位3問に赤バッジで Q番号を自動表示              │
│  ホバーで「Q○○: ○件」ツールチップ表示               │
└─────────────────────────────────────────────────────┘
```

### 3-4. KPI サマリーカード

| カード | 計算式 |
|--------|--------|
| 表示回数 | `page_view` の累計値 |
| 診断開始率 | `diagnosis_start / page_view × 100` % |
| 50 問完走率 | `questions_complete / diagnosis_start × 100` % |
| CTA クリック率 | `cta_click / result_view × 100` % |

### 3-5. 離脱ファネル（SVG 横棒グラフ）

| ステップ | イベントキー |
|---------|-------------|
| ページ表示 | `page_view` |
| 診断開始 | `diagnosis_start` |
| Block 1 表示 | `block_reach_1` |
| Block 2 表示 | `block_reach_2` |
| Block 3 表示 | `block_reach_3` |
| Block 4 表示 | `block_reach_4` |
| Block 5 表示 | `block_reach_5` |
| 50 問完走 | `questions_complete` |
| 氏名入力画面 到達 | `userinfo_view` |
| 結果表示 | `result_view` |
| 面談 CTA クリック | `cta_click` |

- 前ステップ比が 70% 未満の行はバーを赤色でハイライト。
- 各バーの右に件数・前比（%）を表示。

### 3-6. 設問別回答数グラフ（SVG 折れ線グラフ）

- Q1〜Q50 の初回回答数を折れ線で表示。
- X 軸ラベルは Q1, Q5, Q10, Q15, ... Q50（5問刻み）。
- Block 境界（Q10/Q11, Q20/Q21 ...）に点線ガイドを表示。
- **急落ポイント自動検出**: 前問との差が大きい上位 3 問に赤バッジ（「Q○○」）を表示。
- 各データポイントにカーソルを当てると「Q○○: ○件」のツールチップを表示（SVG `<title>` 要素）。

---

## 4. 結果メール送付

### 4-1. 概要

診断完了後、LLM による個別分析が完了した時点で自動的にメールを送信する。

- **送信元**: `musubu.saiyo@gmail.com`
- **送信先**: `musubu.saiyo@gmail.com`（代表メール）
- **送信タイミング**: 結果画面表示後、`/api/analyze` のレスポンスを受信した時点（fire and forget）
- **ライブラリ**: nodemailer（Gmail SMTP / port 465）

### 4-2. API: POST `/api/send-result`

**リクエスト**
```json
{
  "name":         "田中 太郎",
  "main_type":    "leader",
  "sub_type":     "analyst",
  "scores":       { "leader": 4.2, "analyst": 3.8, ... },
  "analysis":     "あなたは...",
  "weapon":       "...",
  "environment":  "...",
  "motivation":   "...",
  "advisor_memo": "■タイプ\n..."
}
```

**処理内容**
1. 環境変数 `GMAIL_APP_PASSWORD` が未設定の場合はスキップ（`{ ok: true, skipped: true }`）。
2. HTML メールを組み立てて Gmail SMTP 経由で送信。
3. 送信失敗はサーバーログに記録するが、レスポンスは `{ ok: true }` を返しユーザー体験に影響させない。

### 4-3. メール構成

```
件名: 【MUSUBU診断】田中太郎さんの診断結果（リーダータイプ）

┌─────────────────────────────────────────┐
│  MUSUBU キャリアタイプ診断 結果レポート   │  ← ティールヘッダー
├─────────────────────────────────────────┤
│  氏名 / 診断日 / メインタイプ / サブタイプ │
├─────────────────────────────────────────┤
│  タイプ別スコア（スコア降順）             │
├─────────────────────────────────────────┤
│ 💡 ●さんの個別分析                       │  ← ティール左ボーダー
│    分析テキスト                           │
│  ⚔️ あなたの武器                         │  ← サブ項目
│  🌱 イキイキする環境                      │
│  🔥 モチベーションが上がるスイッチ        │
├─────────────────────────────────────────┤
│  キャリアアドバイザー用メモ               │
│  （■タイプ〜■面談時の注意点 全8セクション）│
└─────────────────────────────────────────┘
```

### 4-4. 環境変数・シークレット

| シークレット名       | 内容 | 登録先 |
|---------------------|------|--------|
| `ANTHROPIC_API_KEY`  | Claude API キー | GCP Secret Manager |
| `ADMIN_PASSWORD`     | 管理画面 Basic 認証パスワード | GCP Secret Manager |
| `GMAIL_APP_PASSWORD` | Gmail アプリパスワード（16文字） | GCP Secret Manager |

Cloud Run へのシークレット注入は `deploy.yml` の `--set-secrets` で行う。
Cloud Run サービスアカウント（`413678228468-compute@developer.gserviceaccount.com`）に各シークレットの **Secret Manager のシークレット アクセサー** ロールを付与すること。

---

## 5. セキュリティ

| 項目 | 方針 |
|------|------|
| `/admin` 認証 | HTTP Basic 認証（`ADMIN_PASSWORD` 環境変数） |
| 未設定時の動作 | `503 Service Unavailable` を返し画面を表示しない |
| イベント送信 API | 許可リスト（allowlist）でイベント名を検証、不正値は 400 を返す |
| セッション ID | 集計には使用せず、デバッグログ用途のみ |
| Gmail 認証情報 | App Password を Secret Manager で管理。コードへの直接埋め込み禁止 |
| 管理画面の IP 制限 | Cloud Run のネットワーク設定でオフィス IP に制限することを推奨 |

---

## 6. 将来の拡張候補

| 項目 | 内容 |
|------|------|
| 重複排除 | 同一セッションのリロードによる重複カウントの除外 |
| セッション単位の詳細ログ | どのセッションがどこで離脱したかのドリルダウン |
| CSV エクスポート | テーブルデータを CSV でダウンロード |
| Slack 通知 | 日次サマリーを Slack に自動投稿 |
| メール送信先の複数化 | 複数の CA メールアドレスへの同時送信 |
