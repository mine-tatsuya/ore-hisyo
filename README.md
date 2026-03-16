# 俺秘書

**AI が毎日のスケジュールを自動生成する、個人向け秘書アプリ**

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)
![Gemini](https://img.shields.io/badge/Gemini_API-Google-4285F4?logo=google)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?logo=vercel)

**デモ：https://ore-hisyo.vercel.app**

---

## 概要・開発背景

### なぜ作ったのか

　- 習慣にしたいことが継続できない（運動・睡眠・瞑想など）                                                                                                          
  - 予定・カレンダー管理を自動化し、やる気が落ちているときでも予定をキープしたい                                                                                    
  - 通知やペナルティ・ご褒美の仕組みでモチベーションを維持したい                                                                                                    
  - 自分オリジナルのフルスタックアプリをポートフォリオとして完成させたい 

「タスクの締切・優先度・見積もり時間と、その日の空き時間を AI に渡せば、自動でスケジュールを組んでくれるのではないか」と考えたのがきっかけ。

### 実現したこと

Google Calendar・Gemini API・Vercel Cron を組み合わせ、**毎日 JST 12:00 に翌日のスケジュールを自動生成して Google Calendar に書き込む仕組み**を、設計・実装・デプロイまでAIを用いて個人で開発した。

課題を自分で見つけ、技術を調べて組み合わせ、実際に本番稼働するものを作った。

---

## 機能一覧

- Google アカウントでログイン（OAuth2）
- タスク管理（CRUD・優先度・締切・進捗・合計作業時間）
- 定期タスク管理（毎日 / 毎週 / N 日ごと / 毎月）
- AI スケジュール自動生成（Gemini Function Calling）
- Google Calendar への自動書き込み・差分更新
- 毎日 JST 12:00 に翌日スケジュールを自動生成（Vercel Cron）
- Gemini モデル自動フォールバック（クォータ上限時に次モデルへ切替）

---

## 技術スタック

| カテゴリ | 技術 | 選定理由 |
|---|---|---|
| Frontend | Next.js 16 (App Router) / TypeScript / Tailwind CSS | フルスタックを1つのリポジトリで完結させるため。App Router でサーバー/クライアントの責務を明確に分離 |
| Backend | Next.js API Routes / NextAuth.js v4 | API サーバーを別に立てずにデプロイコストを下げる |
| Database | Neon (PostgreSQL) / Prisma ORM | サーバーレス対応のマネージド Postgres。Prisma で型安全なクエリを実現 |
| AI | Google Gemini API（Function Calling）| LLM が自律的にツールを呼び出して情報収集できる Function Calling が必要だったため |
| 外部 API | Google Calendar API / Google OAuth2 / 気象庁 API | カレンダー連携・認証・当日の天気情報取得 |
| Infra | Vercel（Hosting + Cron Jobs）| Next.js との親和性が高く、Cron Jobs でバックエンド定期実行も完結する |

---

## システム構成

```
[ユーザー]
    │
    ▼
[Next.js on Vercel]
    ├─ NextAuth.js ──── Google OAuth2
    ├─ API Routes
    │    ├─ /api/tasks              ← タスク CRUD
    │    ├─ /api/schedule/generate  ← Gemini 呼び出し
    │    ├─ /api/schedule/apply     ← Google Calendar 書き込み
    │    └─ /api/cron/daily-schedule ← Vercel Cron エンドポイント
    └─ Prisma ORM ──── Neon DB (PostgreSQL)

[Vercel Cron / 毎日 JST 12:00]
    → AUTO ユーザーを DB から取得
    → refresh_token でアクセストークン自動更新
    → Gemini でスケジュール生成
    → Google Calendar に書き込み
```

---

## 技術的なこだわり（AIとともに）

### ① Gemini Function Calling によるスケジュール生成

**課題**：天気情報やカレンダーの空き時間をリアルタイムに取得しながらスケジュールを生成する必要があった。プロンプトに全情報を詰め込む方法では、AI が「何が最新の情報か」を判断できない。

**解決策**：Gemini の Function Calling を使い、AI 自身がツール（天気取得・カレンダー確認）を自律的に呼び出す設計にした。最大5ターンのループで AI が必要な情報を自分で集めてからスケジュールを生成する。

```typescript
// AI が自律的に呼び出すツール定義の例
const tools = [{
  functionDeclarations: [
    {
      name: "get_weather",
      description: "指定日の天気予報を取得する",
      parameters: { ... }
    },
    {
      name: "get_free_slots",
      description: "Google Calendar から空き時間を取得する",
      parameters: { ... }
    }
  ]
}];
```

無料枠のクォータ上限に備え、モデルフォールバックも実装した（`gemini-2.5-flash` → `gemini-3.0-flash-preview` → `gemini-2.5-flash-lite`）。

---

### ② Google Calendar との双方向連携・差分更新

**課題**：再スケジュール時に以前作ったイベントが Calendar に残り続け、重複が発生した。「俺秘書が作ったイベント」と「ユーザーが手動で作ったイベント」を区別する手段が必要だった。

**解決策**：イベント作成時に `extendedProperties.private.source = "ore-hisyo"` を付与し、対象日の俺秘書イベントだけを一括削除してから新しいスケジュールを書き込む差分更新を実装した。

```typescript
// 俺秘書が作ったイベントだけを取得して削除
const existingEvents = await calendar.events.list({
  calendarId: "primary",
  privateExtendedProperty: "source=ore-hisyo",
  timeMin: startOfDay,
  timeMax: endOfDay,
});
for (const event of existingEvents.data.items ?? []) {
  await calendar.events.delete({ calendarId: "primary", eventId: event.id! });
}
```

---

### ③ セッションなし Cron でのトークン管理

**課題**：Vercel Cron はユーザーのブラウザセッションを持たない。そのため通常の NextAuth セッション経由では Google API にアクセスできない。

**解決策**：DB の `Account` テーブルに保存された `refresh_token` を取得し、Google の token エンドポイントで `access_token` を自動更新する仕組みを自前実装した。更新したトークンは DB に書き戻す。不正呼び出しを防ぐため `CRON_SECRET` による認証も実装している。

```typescript
// refresh_token → access_token の自動更新
const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  body: new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    refresh_token: account.refresh_token,
    grant_type: "refresh_token",
  }),
});
const { access_token } = await tokenRes.json();
// DB に保存して次回以降も再利用
await prisma.account.update({ where: { id: account.id }, data: { access_token } });
```

---

### ④ 合計作業時間の自動分割スケジューリング

**課題**：「このタスクに合計40時間かかる」という情報をそのまま AI に渡すと、1日で全部やろうとする。残り日数と進捗を考慮した「今日の適切な作業量」を AI に判断させる必要があった。

**解決策**：タスクごとに `total_hours`（合計見積もり）と `logged_hours`（実績）を DB で管理し、締切までの残り日数から「今日の推奨配分時間」を算出してプロンプトに含める。AI はその数値を参考にしながら1日分のスケジュールを組み立てる。

```
タスク: 卒業論文執筆
  - 残り作業時間: 32h / 合計見積もり: 40h
  - 締切まで: 8日
  - 推奨配分: 4h/日（残り時間 ÷ 残り日数）
```

---

## セットアップ（ローカル開発）

```bash
# 1. リポジトリ clone
git clone https://github.com/mine-tatsuya/ore-hisyo.git
cd ore-hisyo

# 2. 依存関係インストール
npm install

# 3. 環境変数を設定（.env.local を作成）
cp env.example .env.local

# 4. DB スキーマ反映
npm run db:push

# 5. 開発サーバー起動
npm run dev
```

### 必要な環境変数

| 変数名 | 説明 | 取得先 |
|---|---|---|
| `DATABASE_URL` | Neon DB の接続文字列 | [Neon Console](https://console.neon.tech) |
| `NEXTAUTH_URL` | アプリの URL（ローカルは `http://localhost:3000`） | — |
| `NEXTAUTH_SECRET` | セッション暗号化キー（`openssl rand -base64 32` で生成） | — |
| `GOOGLE_CLIENT_ID` | Google OAuth クライアント ID | [Google Cloud Console](https://console.cloud.google.com) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth クライアントシークレット | Google Cloud Console |
| `GEMINI_API_KEY` | Gemini API キー | [Google AI Studio](https://aistudio.google.com) |
| `CRON_SECRET` | Cron エンドポイントの認証トークン（任意の文字列） | — |

---

## ライセンス

MIT
