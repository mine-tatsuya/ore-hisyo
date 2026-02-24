# DBスキーマ設計 要件定義

## 概要

Neon (Postgres) をデータベースとして使用し、Prisma ORM でスキーマ管理・マイグレーションを行う。
NextAuth.js の Prisma Adapter が必要とするテーブル（User, Account, Session, VerificationToken）に加え、
アプリ固有のテーブル（Settings, Tasks, Logs）を定義する。

## 対象フェーズ

- **Phase 1 (MVP)**: 全テーブルの基本構造
- **Phase 2**: Logs テーブルの活用（AI精度向上のフィードバック）

---

## 機能詳細

### 1. Neon + Prisma 接続設定

#### 接続文字列（環境変数）
```env
DATABASE_URL="postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

#### `prisma/schema.prisma` 基本設定
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

#### `lib/prisma.ts`（シングルトンパターン）
```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### 2. テーブル定義

#### NextAuth.js 標準テーブル群
```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  accounts  Account[]
  sessions  Session[]
  settings  Settings?
  tasks     Task[]
  logs      Log[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text  // リフレッシュトークン（長文対応）
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

#### Settings テーブル
```prisma
model Settings {
  id        String   @id @default(cuid())
  userId    String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // 生活リズム設定
  wakeUpTime    String  @default("07:00")   // HH:MM 形式
  bedTime       String  @default("23:00")
  lunchStart    String  @default("12:00")
  lunchEnd      String  @default("13:00")
  focusTimeStart String? // 任意：集中タイム開始
  focusTimeEnd   String? // 任意：集中タイム終了

  // AI指示設定
  aiPersonality  AiPersonality @default(BALANCED)
  aiCustomPrompt String?       @db.Text  // カスタム追加指示

  // カレンダー反映モード
  calendarMode   CalendarMode  @default(MANUAL)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

enum AiPersonality {
  STRICT    // 厳しめに管理
  BALANCED  // バランス良く（デフォルト）
  RELAXED   // 余裕を持った計画
}

enum CalendarMode {
  AUTO    // 自動反映
  MANUAL  // 手動承認
}
```

#### Tasks テーブル
```prisma
model Task {
  id          String     @id @default(cuid())
  userId      String
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  // タスク基本情報
  title       String
  description String?    @db.Text
  deadline    DateTime?  // 締切日時
  estimatedMinutes Int   // 予想所要時間（分）
  priority    Priority   @default(MEDIUM)

  // ステータス・進捗
  status      TaskStatus @default(PENDING)
  progressPct Int        @default(0)  // 0〜100

  // Google Calendar連携
  calendarEventId String?  // GoogleカレンダーのEvent ID

  // スケジュール情報（AIが割り当てた時間）
  scheduledStart DateTime?
  scheduledEnd   DateTime?

  user User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  logs Log[]

  @@index([userId])
  @@index([userId, status])
  @@index([userId, deadline])
}

enum Priority {
  HIGH
  MEDIUM
  LOW
}

enum TaskStatus {
  PENDING     // 未着手
  IN_PROGRESS // 進行中
  DONE        // 完了
  CANCELLED   // キャンセル
}
```

#### Logs テーブル
```prisma
model Log {
  id        String   @id @default(cuid())
  userId    String
  taskId    String
  createdAt DateTime @default(now())

  // 計画値（AIが割り当てた時間）
  plannedStart    DateTime
  plannedEnd      DateTime
  plannedMinutes  Int

  // 実績値（ユーザーが報告）
  actualMinutes   Int?    // 実際にかかった時間（分）
  actualProgressPct Int?  // 実際の進捗率

  // 差異計算（アプリが自動算出）
  accuracyRatio   Float?  // actualMinutes / plannedMinutes

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([taskId])
}
```

### 3. リレーション定義

```
User
 ├── Account (1:N) — OAuthアカウント情報
 ├── Session (1:N) — セッション管理
 ├── Settings (1:1) — ユーザー設定
 ├── Task (1:N) — タスク一覧
 └── Log (1:N) — 達成ログ

Task
 └── Log (1:N) — タスクの達成ログ
```

### 4. インデックス設計

| テーブル | インデックス対象カラム | 理由 |
|---------|---------------------|------|
| Account | `userId` | User からの JOIN 最適化 |
| Session | `userId` | セッション検索 |
| Task | `userId` | ユーザー別タスク取得 |
| Task | `(userId, status)` | 未完了タスク絞り込み（Cron Job利用）|
| Task | `(userId, deadline)` | 締切順ソート |
| Log | `userId` | ユーザー別ログ取得 |
| Log | `taskId` | タスク別ログ取得 |

### 5. マイグレーション方針

#### 初期セットアップ
```bash
npx prisma generate        # クライアント生成
npx prisma migrate dev --name init  # 開発用マイグレーション
```

#### 本番デプロイ
```bash
npx prisma migrate deploy  # Vercel の build コマンドに組み込む
```

#### `package.json` の build コマンド推奨設定
```json
{
  "scripts": {
    "build": "prisma generate && prisma migrate deploy && next build"
  }
}
```

#### マイグレーションファイル管理
- `prisma/migrations/` をGit管理下に置く
- 本番DBへの直接 `migrate dev` は禁止（`migrate deploy` のみ使用）

---

## 未決事項・考慮点

- [ ] `Log.accuracyRatio` の計算タイミング：タスク完了時にトリガーするか、バッチ処理か
- [ ] 論理削除（`deletedAt`）の導入検討（タスク削除後のログ保持のため）
- [ ] `Task.scheduledStart/End` はAIが生成するたびに上書きするか、履歴として残すか（Logs に記録する方向で検討）
- [ ] Neon の接続プールサイズ（Vercel Serverless との相性で `pgbouncer` モード推奨）
  ```env
  DATABASE_URL="postgresql://...?sslmode=require&pgbouncer=true&connect_timeout=15"
  ```
- [ ] Settings レコードの初期生成タイミング：初回ログイン時に自動作成する（`signIn` コールバック内）
