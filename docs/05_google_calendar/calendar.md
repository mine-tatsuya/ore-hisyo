# Google Calendar API 連携 要件定義

## 概要

Google Calendar API を使い、ユーザーの既存カレンダーイベントを読み取り（read）、
AIが生成したスケジュールをイベントとして書き込む（write）。
承認フロー・EventID 管理・トークンリフレッシュのエラーハンドリングを定義する。

## 対象フェーズ

- **Phase 1 (MVP)**: 既存イベント取得・AIスケジュールの手動承認後の書き込み
- **Phase 2**: 自動承認モードでの自動書き込み（Cron Job）

---

## 機能詳細

### 1. Google Calendar クライアント設定（`lib/googleCalendar.ts`）

```typescript
import { google } from "googleapis";

export function getCalendarClient(accessToken: string) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth });
}
```

---

### 2. 既存イベント取得（Read）

#### GET `/api/calendar/events`

**クエリパラメータ**
| パラメータ | 型 | 説明 |
|-----------|---|------|
| `date` | string | 対象日（`YYYY-MM-DD`） |

**処理内容**
```typescript
// app/api/calendar/events/route.ts
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];

  const calendar = getCalendarClient(session.accessToken!);

  const startOfDay = new Date(`${date}T00:00:00+09:00`).toISOString();
  const endOfDay   = new Date(`${date}T23:59:59+09:00`).toISOString();

  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin: startOfDay,
    timeMax: endOfDay,
    singleEvents: true,
    orderBy: "startTime",
  });

  return Response.json({ events: response.data.items ?? [] });
}
```

**レスポンス例（Google Events の主要フィールド）**
```json
{
  "events": [
    {
      "id": "google_event_id_xxx",
      "summary": "チームミーティング",
      "start": { "dateTime": "2026-02-25T10:00:00+09:00" },
      "end":   { "dateTime": "2026-02-25T11:00:00+09:00" },
      "description": ""
    }
  ]
}
```

---

### 3. 空き時間スロット算出（`lib/calendar/getFreeSlots.ts`）

```typescript
export async function getFreeSlotsFromCalendar(
  accessToken: string,
  date: string,
  cutoffTime?: Date  // リスケジュール時に現在時刻以降のみ取得
): Promise<FreeSlot[]> {
  const calendar = getCalendarClient(accessToken);
  // ... イベント取得後、空き時間を算出
  // - 起床〜就寝時間の範囲内で算出
  // - 昼休憩・既存イベントを除外
  // - 最小スロット幅: 15分以上のみ有効とする
}

export interface FreeSlot {
  start: Date;
  end: Date;
  durationMinutes: number;
}
```

---

### 4. AIスケジュールのイベント書き込み（Write）

#### POST `/api/calendar/events`

AIが生成したスケジュールアイテムをGoogleカレンダーにイベントとして登録する。

**リクエストボディ**
```typescript
interface WriteEventsRequest {
  scheduleItems: ScheduleItem[];
  targetDate: string;  // "YYYY-MM-DD"
}
```

**処理内容**
```typescript
// app/api/calendar/events/route.ts (POST)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { scheduleItems, targetDate }: WriteEventsRequest = await req.json();
  const calendar = getCalendarClient(session.accessToken!);
  const userId = session.user.id;

  const results: { taskId: string | null; eventId: string }[] = [];

  for (const item of scheduleItems) {
    if (item.type !== "TASK") continue;  // BREAK・BUFFER はカレンダーに書かない（オプション）

    const event = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: `[俺秘書] ${item.title}`,
        description: item.notes ?? "",
        start: {
          dateTime: `${targetDate}T${item.start}:00+09:00`,
          timeZone: "Asia/Tokyo",
        },
        end: {
          dateTime: `${targetDate}T${item.end}:00+09:00`,
          timeZone: "Asia/Tokyo",
        },
        colorId: "1",  // Lavender（AIスケジュール識別用）
        extendedProperties: {
          private: {
            source: "orehisyo",
            taskId: item.taskId ?? "",
          },
        },
      },
    });

    if (item.taskId && event.data.id) {
      // Tasks テーブルの calendarEventId を更新
      await prisma.task.update({
        where: { id: item.taskId },
        data: { calendarEventId: event.data.id },
      });
      results.push({ taskId: item.taskId, eventId: event.data.id });
    }
  }

  return Response.json({ results }, { status: 201 });
}
```

---

### 5. 承認フロー：手動承認 vs 自動反映

ユーザーの `Settings.calendarMode` に応じて動作が異なる。

#### 手動承認（`calendarMode: MANUAL`）
```
AI生成 → スケジュール提案画面を表示 → ユーザーが確認 → 「カレンダーに反映」ボタン → 書き込み
```
- Phase 1 のデフォルト
- ユーザーは個別アイテムを削除・時間変更してから反映できる（UX は Phase 1.5 以降で対応）

#### 自動反映（`calendarMode: AUTO`）
```
Cron Job トリガー → AI生成 → 自動でカレンダー書き込み → 完了通知（将来的にLINEなど）
```
- Phase 2 で実装
- 既存の「俺秘書」イベントがある場合は事前に削除してから再生成

---

### 6. GoogleカレンダーのEvent IDとTasksテーブルの紐付け

| 操作 | 処理 |
|------|------|
| イベント作成時 | `Task.calendarEventId = event.data.id` |
| タスク完了時 | `calendarEventId` はそのまま保持（記録のため） |
| タスクキャンセル時 | カレンダーイベントを削除後、`calendarEventId = null` |
| リスケジュール時 | 既存イベントを削除 → 新イベントを作成 → `calendarEventId` を更新 |

#### カレンダーイベント削除（`lib/calendar/deleteEvent.ts`）
```typescript
export async function deleteCalendarEvent(accessToken: string, eventId: string) {
  const calendar = getCalendarClient(accessToken);
  await calendar.events.delete({
    calendarId: "primary",
    eventId,
  });
}
```

---

### 7. トークンリフレッシュのエラーハンドリング

Google Calendar API 呼び出し時にトークン期限切れが発生した場合の対処。

```typescript
// lib/calendar/withTokenRefresh.ts
export async function withCalendarErrorHandling<T>(
  fn: () => Promise<T>,
  session: Session
): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (error: any) {
    if (error.status === 401) {
      // セッションの error フィールドに RefreshAccessTokenError がセットされている場合
      if (session.error === "RefreshAccessTokenError") {
        // フロントエンドへ再ログイン要求を通知
        return { error: "REAUTH_REQUIRED" };
      }
    }
    throw error;
  }
}
```

**フロントエンド側のハンドリング**
```typescript
if (response.error === "REAUTH_REQUIRED") {
  // signIn() を呼び出して再認証
  signIn("google");
}
```

---

## APIインターフェース まとめ

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/calendar/events` | GET | 指定日のカレンダーイベント一覧取得 |
| `/api/calendar/events` | POST | スケジュールアイテムをイベントとして登録 |
| `/api/calendar/events/[eventId]` | DELETE | カレンダーイベント削除 |
| `/api/calendar/free-slots` | GET | 指定日の空き時間スロット取得 |

---

## 未決事項・考慮点

- [ ] タイムゾーン管理：ユーザーが日本以外の場合の対応（Phase 1 は JST 固定で対応）
- [ ] `primary` カレンダー以外のカレンダーをサポートするか（ユーザーが複数カレンダーを使う場合）
- [ ] リスケジュール時の既存イベント削除の判定方法：`extendedProperties.private.source === "orehisyo"` で俺秘書イベントを識別
- [ ] カレンダー書き込みの同時実行制御（Cron と手動が同時に走った場合の重複イベント防止）
- [ ] Google Calendar API のレートリミット：100 requests/second/user（Phase 1 では問題なし）
- [ ] 休憩・バッファ時間（`type: BREAK/BUFFER`）をカレンダーに書き込むかをユーザー設定で切り替える機能
