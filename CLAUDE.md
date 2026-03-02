# 俺秘書 プロジェクトガイドライン

## 技術スタック
- Framework: Next.js (App Router)
- Language: TypeScript
- DB: Neon (Postgres) / Prisma (ORM)
- UI: Tailwind CSS / shadcn/ui
- AI: Gemini API (Google AI Studio)

## 命名規則・設計ルール
- コンポーネントは `components/` フォルダに機能ごとに配置。
- APIルートは `app/api/` 以下に配置。
- ユーザー認証は NextAuth.js (Google Provider) を使用。

## 開発の優先順位
1. Google OAuth のログイン実装
2. Neon DB と Prisma の接続設定
3. Google Calendar API からの予定取得ロジック
4. Gemini API を使ったスケジュール生成プロンプトの作成

## メモ
- 定期実行は Vercel Cron Jobs を想定している。
- Google APIのトークン管理は安全性を最優先にする。

私は大学生で、システム開発の初学者です。
このシステムを作るにあたって、アプリケーションの様々な仕組みを理解したいと考えています。
nextのフレームワークや、typesriptの書き方、nodeとは何か、vercelは何か、DBの接続はどのようなものかなどです。
あなたは、このシステムを構築すると同時に、私に教えながら作ることを目的としてください。
システムを構築するために道筋をたて、どうしてそのようにするのか、なぜ今なのかを解説しながら、丁寧に作っていきたいです。
計画案を私に見せてから実装するようにしてください。