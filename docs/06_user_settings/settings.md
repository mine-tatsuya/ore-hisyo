# ユーザー設定 要件定義

## 概要

ユーザーの生活リズム・AI指示スタイル・カレンダー反映モードを管理する。
これらの設定はAIスケジュール生成のプロンプトに直接影響する重要なデータ。

## 対象フェーズ

- **Phase 1 (MVP)**: 全設定の登録・編集
- **Phase 2**: 設定をもとにした Cron Job 自動実行

---

## 機能詳細

### 1. 設定カテゴリ一覧

| カテゴリ | 説明 |
|---------|------|
| 生活リズム | 起床・就寝・昼休憩・集中タイムの時刻設定 |
| AI指示 | AIの計画スタイル（プリセット + カスタム追加指示） |
| カレンダー連携 | カレンダーへの反映モード（自動 / 手動） |

### 2. Settings テーブル 全カラム詳細

| カラム名 | 型 | デフォルト値 | 説明 |
|---------|---|------------|------|
| `id` | String (cuid) | 自動生成 | プライマリキー |
| `userId` | String | - | User との外部キー（一意） |
| `wakeUpTime` | String | `"07:00"` | 起床時間（HH:MM形式） |
| `bedTime` | String | `"23:00"` | 就寝時間（HH:MM形式） |
| `lunchStart` | String | `"12:00"` | 昼休憩開始（HH:MM形式） |
| `lunchEnd` | String | `"13:00"` | 昼休憩終了（HH:MM形式） |
| `focusTimeStart` | String? | `null` | 集中タイム開始（任意） |
| `focusTimeEnd` | String? | `null` | 集中タイム終了（任意） |
| `aiPersonality` | Enum | `BALANCED` | AIスタイル（STRICT/BALANCED/RELAXED）|
| `aiCustomPrompt` | String? | `null` | カスタム追加指示（最大500文字）|
| `calendarMode` | Enum | `MANUAL` | 反映モード（AUTO/MANUAL）|
| `createdAt` | DateTime | 自動生成 | 作成日時 |
| `updatedAt` | DateTime | 自動更新 | 更新日時 |

### 3. 生活リズム設定の詳細

#### 入力バリデーション
```typescript
// schemas/settings.ts（zod）
import { z } from "zod";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;  // HH:MM 形式

export const settingsSchema = z.object({
  wakeUpTime: z.string().regex(timeRegex, "HH:MM形式で入力してください"),
  bedTime:    z.string().regex(timeRegex, "HH:MM形式で入力してください"),
  lunchStart: z.string().regex(timeRegex, "HH:MM形式で入力してください"),
  lunchEnd:   z.string().regex(timeRegex, "HH:MM形式で入力してください"),
  focusTimeStart: z.string().regex(timeRegex).optional().nullable(),
  focusTimeEnd:   z.string().regex(timeRegex).optional().nullable(),
  aiPersonality:  z.enum(["STRICT", "BALANCED", "RELAXED"]),
  aiCustomPrompt: z.string().max(500).optional().nullable(),
  calendarMode:   z.enum(["AUTO", "MANUAL"]),
}).refine(
  data => data.wakeUpTime < data.bedTime,
  { message: "起床時間は就寝時間より前に設定してください", path: ["wakeUpTime"] }
).refine(
  data => data.lunchStart < data.lunchEnd,
  { message: "昼休憩の開始は終了より前に設定してください", path: ["lunchStart"] }
).refine(
  data => {
    if (data.focusTimeStart && data.focusTimeEnd) {
      return data.focusTimeStart < data.focusTimeEnd;
    }
    return true;
  },
  { message: "集中タイムの開始は終了より前に設定してください", path: ["focusTimeStart"] }
);
```

#### 時刻の制約整合性
- `wakeUpTime` < `bedTime`（必須）
- `wakeUpTime` ≤ `lunchStart` < `lunchEnd` ≤ `bedTime`
- `focusTimeStart` < `focusTimeEnd`（設定する場合）
- 昼休憩と集中タイムが重複していてもAI側で考慮

### 4. AI指示設定の詳細

#### プリセット（`aiPersonality`）

| 値 | 表示名 | AI へのプロンプト指示 |
|----|-------|---------------------|
| `STRICT` | 厳しめ | タスクをぎっしり詰め、休憩を最小限に。締切を最優先で管理 |
| `BALANCED` | バランス型（デフォルト）| 適度な休憩を挟み、無理のないペースで配置 |
| `RELAXED` | ゆったり | 余裕を持った計画で、バッファ時間を多めに確保 |

#### カスタム追加指示（`aiCustomPrompt`）
- プリセットに追記する形でAIへ渡す
- 例：「午前中はメール確認・軽作業を優先してください」
- 例：「重要度HIGHのタスクは必ず午前中に配置してください」
- 最大500文字

### 5. カレンダー反映モード設定

| モード | 説明 | Phase |
|-------|------|-------|
| `MANUAL` | スケジュール確認画面で手動承認後に反映 | Phase 1 |
| `AUTO` | Cron Job が毎朝自動でカレンダーに書き込み | Phase 2 |

- `AUTO` 選択時は「毎朝の自動実行時刻」も設定できると良い（Phase 2 以降で検討）

### 6. 初期設定の自動生成

ユーザーの初回ログイン後、Settings レコードが存在しない場合はデフォルト値で自動作成する。

```typescript
// lib/auth/ensureUserSettings.ts
export async function ensureUserSettings(userId: string) {
  const existing = await prisma.settings.findUnique({ where: { userId } });
  if (!existing) {
    await prisma.settings.create({
      data: { userId },  // デフォルト値は Prisma schema で定義済み
    });
  }
}
```

NextAuth.js の `signIn` コールバック内、または `/dashboard` の初回アクセス時に呼び出す。

---

## API ルート仕様

### GET `/api/settings`
現在のユーザー設定を取得

**レスポンス例**
```json
{
  "settings": {
    "wakeUpTime": "07:00",
    "bedTime": "23:00",
    "lunchStart": "12:00",
    "lunchEnd": "13:00",
    "focusTimeStart": "09:00",
    "focusTimeEnd": "11:00",
    "aiPersonality": "BALANCED",
    "aiCustomPrompt": null,
    "calendarMode": "MANUAL"
  }
}
```

### PUT `/api/settings`
ユーザー設定を全更新（upsert）

**リクエストボディ**: Settings の全フィールド（`settingsSchema` に準拠）

**レスポンス**
- 200: 更新後の設定オブジェクト
- 400: バリデーションエラー（フィールドごとのエラーメッセージ）
- 401: 未認証

**実装**
```typescript
// app/api/settings/route.ts
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ errors: parsed.error.flatten() }, { status: 400 });
  }

  const settings = await prisma.settings.upsert({
    where:  { userId: session.user.id },
    update: parsed.data,
    create: { userId: session.user.id, ...parsed.data },
  });

  return Response.json({ settings });
}
```

---

## UIコンポーネント設計

```
components/
└── settings/
    ├── SettingsForm.tsx         # 設定フォーム全体
    ├── LifeRhythmSection.tsx    # 生活リズム設定セクション
    ├── AiPersonalitySection.tsx # AI指示設定セクション
    ├── CalendarModeSection.tsx  # カレンダー反映モード設定
    └── TimeInput.tsx            # HH:MM 入力コンポーネント
```

- shadcn/ui の `Card`, `Switch`, `Select`, `Textarea` を活用
- 変更後は即座に `PUT /api/settings` を呼び出す（または「保存」ボタンで一括送信）
- 設定変更の確認ダイアログは不要（シンプルに保存）

---

## 未決事項・考慮点

- [ ] 集中タイム中はカレンダーに「集中タイム」ブロックを自動挿入するかどうか
- [ ] タイムゾーン設定（Phase 1 は JST 固定、Phase 2 以降で対応）
- [ ] 設定変更履歴の保持（現状は最新1件のみ、変更履歴は不要と判断）
- [ ] `calendarMode: AUTO` への変更時に確認ダイアログを出すか（誤操作防止のため推奨）
- [ ] 生活リズムが曜日ごとに異なる場合の対応（平日 vs 休日 — Phase 3 以降で検討）
