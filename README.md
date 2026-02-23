# MUSUBU キャリアタイプ診断プラットフォーム

## 概要

全50問の診断をもとにキャリアタイプを判定し、AI による個別分析とキャリアアドバイザー向けメモを生成する診断 LP。

---

## 主な機能

| 機能 | 内容 |
|------|------|
| 診断 | 全 50 問・5 ブロック構成（各ブロック 10 問） |
| タイプ判定 | 6 タイプ（リーダー・サポーター・アナリスト・クリエイター・スペシャリスト・チャレンジャー）をスコアで判定 |
| AI 個別分析 | Claude（Haiku）による分析コメント・武器・環境・モチベーション・CA用メモを生成 |
| 結果メール通知 | 診断完了時に結果・AI分析・CA用メモを Gmail に自動送信 |
| 離脱計測 | 各ステップ・設問ごとの到達数を Firestore に日次集計 |
| 管理画面 | `/admin` でファネル・設問別回答数グラフをリアルタイム確認 |
| 進捗保存 | localStorage + Firestore で途中再開に対応 |

---

## 技術スタック

| 項目 | 内容 |
|------|------|
| ホスティング | Google Cloud Run |
| サーバー | Node.js / Express |
| データベース | Google Cloud Firestore |
| AI | Anthropic Claude API（claude-haiku-4-5） |
| メール | Nodemailer + Gmail SMTP |
| CI/CD | GitHub Actions（main ブッシュで自動デプロイ） |

---

## 診断フロー

```
スタート画面
  ↓「診断をはじめる」
Block 1（Q1〜Q10）→ Block 2 → Block 3 → Block 4 → Block 5
  ↓「診断結果を見る」
氏名入力画面
  ↓「結果を見る」
結果画面（タイプ表示 + AI 個別分析 + CA 用メモ）
  ↓（バックグラウンド）
メール送信（musubu.saiyo@gmail.com）
```

---

## 設問構成

- 全 50 問固定順（ランダムなし）
- 各ブロックにリーダー・サポーター・アナリスト・クリエイター・スペシャリスト・チャレンジャー系の設問を均等配置

---

## 環境変数（GCP Secret Manager で管理）

| シークレット名 | 内容 |
|---------------|------|
| `ANTHROPIC_API_KEY` | Claude API キー |
| `ADMIN_PASSWORD` | 管理画面 Basic 認証パスワード |
| `GMAIL_APP_PASSWORD` | Gmail アプリパスワード（16 文字） |

Cloud Run サービスアカウント（`413678228468-compute@developer.gserviceaccount.com`）に各シークレットの **Secret Manager のシークレット アクセサー** ロールが必要。

---

## 管理画面

```
https://<your-domain>/admin
```

- Basic 認証（user: `admin` / pass: `ADMIN_PASSWORD`）
- 計測期間: 今日 / 過去7日 / 過去30日 / 全期間 / カスタム日付指定
- KPI カード: 表示回数・診断開始率・50問完走率・CTAクリック率
- 離脱ファネル: 横棒グラフ（前比 70% 未満を赤でハイライト）
- 設問別回答数: Q1〜Q50 折れ線グラフ・急落上位3問に赤バッジ表示

詳細は [`docs/admin-spec.md`](docs/admin-spec.md) を参照。

---

## Firestore コレクション

| コレクション | 用途 |
|-------------|------|
| `diagnosis_progress` | セッションごとの進捗・ユーザー情報・診断結果 |
| `analytics` | 日次イベント集計（ドキュメントID: `YYYY-MM-DD`） |

---

## ローカル開発

```bash
npm install
node server.js
# → http://localhost:8080
```

Firestore へのアクセスには Application Default Credentials が必要。

```bash
gcloud auth application-default login
```
