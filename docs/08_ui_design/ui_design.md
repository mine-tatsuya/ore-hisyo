# UI設計 要件定義

> 参考デザインシステム: FuruCre design-system.md をベースに俺秘書向けにアダプト

## 概要

俺秘書のUIはシンプルで情報密度の高い「AI秘書ツール」として設計する。
モノトーン基調にブルーアクセントを使い、AIが生成したスケジュールを直感的に確認・操作できる画面構成とする。
Next.js App Router + Tailwind CSS + shadcn/ui で実装する。

## 対象フェーズ

- **Phase 1 (MVP)**: 全画面の基本レイアウト・コンポーネント定義
- **Phase 2**: ダッシュボードの自動更新表示（Cron 結果の反映）

---

## デザイントークン

### カラーパレット

#### Primary（アクセント）

| トークン | 値 | 用途 |
|---------|---|------|
| `primary` | `#0052FF` | CTAボタン、AIバッジ、アクティブ状態、リンク |
| `primary-light` | `#0052FF/10` | Primary背景（ホバー・選択状態） |
| `primary-glow` | `0 0 8px #0052FF` | AIスケジュールカードのハイライト |

#### Neutral（グレースケール）

Tailwind CSS の `slate` スケールを使用。

| トークン | Tailwind | 用途 |
|---------|---------|------|
| `neutral-900` | `slate-900` | 見出し、本文テキスト |
| `neutral-700` | `slate-700` | サブ見出し |
| `neutral-600` | `slate-600` | セカンダリテキスト |
| `neutral-500` | `slate-500` | 補助テキスト |
| `neutral-400` | `slate-400` | ラベル、プレースホルダー |
| `neutral-300` | `slate-300` | 非アクティブアイコン、区切り線 |
| `neutral-200` | `slate-200` | ボーダー（標準） |
| `neutral-100` | `slate-100` | バッジ背景、薄い背景 |
| `neutral-50`  | `slate-50`  | インプット背景、カードホバー背景 |

#### Semantic（意味的カラー）

| トークン | Tailwind | 用途 |
|---------|---------|------|
| `success` | `emerald-500` | 完了タスク、成功バッジ |
| `success-bg` | `emerald-50` | 完了バッジ背景 |
| `success-border` | `emerald-100` | 完了バッジボーダー |
| `error` | `rose-600` | エラー、削除アクション |
| `error-bg` | `rose-50` | エラーメッセージ背景 |
| `warning` | `yellow-800` | 締切が近いタスクの警告テキスト |
| `warning-bg` | `yellow-50` | 警告タスクカード背景 |
| `warning-border` | `yellow-200` | 警告タスクカードボーダー |
| `info` | `blue-700` | AIが生成したスケジュールのラベル |
| `info-bg` | `blue-50` | AIスケジュールブロックの背景 |

#### 背景

| トークン | 値 | 用途 |
|---------|---|------|
| `bg-app` | `#F8F9FB` | アプリ全体の背景 |
| `bg-surface` | `white` | カード、サイドバー、ヘッダー |
| `bg-elevated` | `white` + shadow | モーダル、ドロップダウン |

---

### タイポグラフィ

#### フォントファミリー

```css
/* globals.css */
font-family: system-ui, -apple-system, 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif;
```

`font-sans antialiased` をルートに適用（日本語対応のためシステムフォントを優先）。

#### サイズスケール

| 用途 | サイズ | Weight | Tailwind クラス |
|------|-------|--------|----------------|
| ページタイトル | 20px | Bold | `text-xl font-bold tracking-tight text-slate-900` |
| セクション見出し | 14px | Bold | `text-sm font-bold tracking-tight text-slate-900` |
| カードタイトル | 13px | Semibold | `text-[13px] font-semibold text-slate-800` |
| 本文・説明 | 12px | Normal | `text-xs text-slate-600` |
| ラベル（標準） | 11px | Bold | `text-[11px] font-bold tracking-wider text-slate-400` |
| ラベル（小） | 10px | Bold | `text-[10px] font-bold tracking-wider text-slate-400` |
| バッジ・マイクロ | 9px | Bold | `text-[9px] font-bold tracking-wider` |

#### ラベルパターン

```
セクションタイトル:  text-[11px] font-bold text-slate-400 tracking-wider uppercase
フォームラベル:      text-[10px] font-bold text-slate-400 tracking-widest
ステータスバッジ:    text-[9px] font-bold tracking-wider
タイムラベル:        text-[10px] font-bold text-slate-500 tabular-nums
```

---

### スペーシング

Tailwind のデフォルトスペーシングスケール（4px単位）を使用。

| 用途 | 値 | Tailwind |
|------|---|---------|
| カード内パディング | 20px | `p-5` |
| セクション間マージン | 24px | `mb-6` |
| ページパディング | 24px / 32px | `p-6 lg:p-8` |
| サイドバーパディング | 16px | `p-4` |
| グリッドギャップ（標準）| 16px | `gap-4` |
| アイテム間（狭い） | 4px | `gap-1` |
| アイテム間（標準） | 8px | `gap-2` |
| アイテム間（広い） | 12px | `gap-3` |

### 角丸

| 用途 | 値 | Tailwind |
|------|---|---------|
| ボタン・インプット | 8px | `rounded-lg` |
| カード | 12px | `rounded-xl` |
| モーダル | 16px | `rounded-2xl` |
| バッジ・タグ | 4px | `rounded` |
| アバター | 50% | `rounded-full` |
| タイムラインブロック | 6px | `rounded-md` |

### シャドウ

| 用途 | Tailwind |
|------|---------|
| カード（デフォルト） | `shadow-[0_1px_3px_rgba(0,0,0,0.06)]` |
| カード（ホバー） | `shadow-md` |
| モーダル | `shadow-xl` |
| AIスケジュールカード | `shadow-md shadow-blue-500/10` |

### トランジション

| 用途 | Tailwind |
|------|---------|
| 標準ホバー | `transition-all duration-150` |
| カードホバー | `transition-shadow duration-200` |
| モーダル開閉 | `animate-in fade-in-0 zoom-in-95 duration-200` |
| ページ遷移 | `animate-in fade-in duration-300` |

---

## レイアウト

### 全体構造

```
┌──────────────────────────────────────────────────┐
│ TopNav（sticky, h-14, z-50）                       │
│  [🤖 俺秘書]          [今日: 2/25]  [ユーザーアイコン] │
├─────────────┬────────────────────────────────────┤
│             │                                    │
│  Sidebar    │   Main Content Area                │
│  (w-60)     │   (flex-1, overflow-y-auto)        │
│             │                                    │
│  ─ ダッシュボード        最大幅: max-w-4xl          │
│  ─ タスク一覧                                     │
│  ─ スケジュール                                   │
│  ─ 設定                                          │
│             │                                    │
└─────────────┴────────────────────────────────────┘
```

### レスポンシブ方針

- **最小対応幅**: 768px（タブレット以上を想定。個人用ツールのため）
- **最大コンテンツ幅**: `max-w-4xl`（896px）— タスク・スケジュールの可読性を最優先
- **サイドバー**: 固定幅 `w-60`（240px）、モバイルでは非表示（ハンバーガーメニュー）
- **モバイル（〜767px）**: サイドバーをドロワーに変換。基本機能はモバイルでも動作させる

---

## 画面設計

### 1. ダッシュボード（`/dashboard`）

```
┌─────────────────────────────────────────────┐
│  おはようございます、田中さん                    │
│  本日のスケジュール（2/25 水）                  │
├─────────────┬───────────────────────────────┤
│ 今日のタスク  │  スケジュール                   │
│ 高優先度: 2  │  ┌──────────────────────────┐ │
│ 進行中: 1    │  │ 09:00 [俺秘書] 企画書作成  │ │
│             │  │ 11:00 [俺秘書] メール対応  │ │
│ [タスクを追加]│  │ 14:00 チームMTG（既存）    │ │
│             │  │ 15:30 [俺秘書] 資料作成    │ │
│             │  └──────────────────────────┘ │
│             │  [スケジュール生成]  [カレンダー反映]│
└─────────────┴───────────────────────────────┘
```

**コンポーネント構成**
```
app/dashboard/
└── page.tsx

components/dashboard/
├── DashboardHeader.tsx      # 挨拶 + 日付
├── TaskSummaryCard.tsx      # タスク集計（高優先度・進行中・完了数）
├── TodaySchedulePanel.tsx   # 今日のスケジュール表示
├── ScheduleTimeBlock.tsx    # 1イベントのタイムラインブロック
├── GenerateScheduleButton.tsx # スケジュール生成CTA
└── ApplyToCalendarButton.tsx  # カレンダー反映ボタン
```

### 2. タスク一覧（`/tasks`）

```
┌──────────────────────────────────────────────┐
│  タスク一覧                    [+ タスクを追加] │
│  [全て] [未着手] [進行中] [完了]  ↕ 締切順      │
├──────────────────────────────────────────────┤
│ ● HIGH  企画書を書く           締切: 3/1 18:00 │
│   ▓▓▓▓░░░░░░  40%   [IN_PROGRESS]  [詳細 ›]  │
├──────────────────────────────────────────────┤
│ ● MEDIUM メール返信            締切: なし      │
│   ░░░░░░░░░░   0%   [PENDING]      [詳細 ›]  │
├──────────────────────────────────────────────┤
│ ✓ LOW   議事録まとめ           完了: 2/24      │
│                              [DONE]          │
└──────────────────────────────────────────────┘
```

**コンポーネント構成**
```
app/tasks/
└── page.tsx

components/tasks/
├── TaskList.tsx             # タスク一覧コンテナ
├── TaskCard.tsx             # タスク1件カード
├── TaskStatusBadge.tsx      # ステータスバッジ
├── PriorityDot.tsx          # 優先度ドット（HIGH=rose, MEDIUM=yellow, LOW=slate）
├── TaskProgressBar.tsx      # 進捗バー
├── TaskCreateDialog.tsx     # 新規作成モーダル（shadcn Dialog）
├── TaskEditDialog.tsx       # 編集モーダル
├── TaskDetailSheet.tsx      # 詳細サイドシート（shadcn Sheet）
├── TaskFilterTabs.tsx       # フィルタータブ
└── TaskSortSelect.tsx       # ソートセレクト
```

#### TaskCard の詳細仕様

```
┌────────────────────────────────────────────────┐
│ ● [HIGH]  企画書を書く              締切: 3/1  │ ← border-l-4 border-rose-500
│                                               │
│   ▓▓▓▓▓░░░░░  50%         所要: 120分         │
│                                               │
│   [IN_PROGRESS ▼]   [カレンダー登録済み 📅]  [›] │
└────────────────────────────────────────────────┘
```

- 左ボーダー色で優先度を視覚化：`HIGH=border-rose-500` / `MEDIUM=border-yellow-400` / `LOW=border-slate-300`
- 締切が**今日中**の場合：タイトルに `text-rose-600`、背景に `bg-rose-50`
- `calendarEventId` がある場合：カレンダーアイコン（`Calendar` from lucide）を表示
- ステータスはインラインドロップダウンで直接変更可能

### 3. スケジュール生成・確認画面（`/schedule`）

```
┌──────────────────────────────────────────────────────┐
│  本日のスケジュール生成（2/25 水）         [再生成 ↺] │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ 🤖 AIのコメント:                               │   │
│  │ 今日は高優先度タスクが2件あります。午前中に      │   │
│  │ 集中して取り組む計画を立てました。              │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ── 09:00                                            │
│  │ ▮ 09:00–11:00  企画書を書く         [HIGH] 120分 │  ← bg-blue-50 border-l-2 border-blue-400
│  │ ▮ 11:00–11:30  バッファ時間                      │  ← bg-slate-50 text-slate-400
│  ── 12:00                                            │
│  │ ▯ 12:00–13:00  昼休憩（カレンダー）              │  ← bg-slate-100 text-slate-500
│  ── 13:00                                            │
│  │ ▮ 13:00–14:00  メール対応          [MEDIUM] 60分 │  ← bg-blue-50 border-l-2 border-blue-400
│  │ ▯ 14:00–15:00  チームMTG（既存）                 │  ← bg-slate-100 text-slate-500
│                                                      │
│  ⚠ 締切が近いタスク: 企画書（3/1 18:00）             │
│                                                      │
│           [カレンダーに反映する →]                     │
└──────────────────────────────────────────────────────┘
```

**コンポーネント構成**
```
app/schedule/
└── page.tsx

components/schedule/
├── ScheduleTimeline.tsx       # タイムライン全体
├── ScheduleBlock.tsx          # 1スケジュールブロック（TASK/BREAK/BUFFER/EXISTING）
├── AiCommentCard.tsx          # AIのコメント・サマリー表示
├── WarningBanner.tsx          # 締切警告バナー
├── RegenerateButton.tsx       # 再生成ボタン
└── ApplyScheduleButton.tsx    # カレンダー反映ボタン（確認ダイアログ付き）
```

#### ScheduleBlock の色分け仕様

| ブロック種別 | 背景色 | ボーダー | テキスト |
|------------|-------|--------|---------|
| AIタスク（TASK） | `bg-blue-50` | `border-l-2 border-blue-400` | `text-slate-800` |
| バッファ（BUFFER）| `bg-slate-50` | `border-l-2 border-slate-200` | `text-slate-400` |
| 休憩（BREAK） | `bg-slate-50` | なし | `text-slate-400` |
| 既存カレンダー | `bg-slate-100` | `border-l-2 border-slate-300` | `text-slate-500` |

### 4. 設定画面（`/settings`）

```
┌──────────────────────────────────────────────┐
│  設定                                         │
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │ 生活リズム                               │ │
│  │  起床:  [07:00]  就寝: [23:00]           │ │
│  │  昼休憩: [12:00] 〜 [13:00]             │ │
│  │  集中タイム: [09:00] 〜 [11:00] (任意)  │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │ AIのスタイル                             │ │
│  │  ○ 厳しめ  ● バランス型  ○ ゆったり      │ │
│  │  追加指示: [テキストエリア...]             │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │ カレンダー連携                            │ │
│  │  反映モード: ○ 手動承認  ○ 自動           │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│                    [変更を保存]               │
└──────────────────────────────────────────────┘
```

---

## アイコン

[lucide-react](https://lucide.dev/) を使用。`strokeWidth={1.5}` を基本とする。

| 機能 | アイコン |
|------|--------|
| AIスケジュール生成 | `Sparkles` |
| カレンダー反映 | `CalendarCheck` |
| タスク追加 | `Plus` |
| リスケジュール | `RefreshCw` |
| タスク完了 | `CheckCircle2` |
| 設定 | `Settings` |
| ダッシュボード | `LayoutDashboard` |
| タスク一覧 | `ListTodo` |
| スケジュール | `CalendarDays` |
| 優先度HIGH | `AlertCircle` |
| ログアウト | `LogOut` |
| カレンダー登録済み | `Calendar` |
| 締切警告 | `AlertTriangle` |
| バッファ/休憩 | `Coffee` |

---

## 状態表現

### タスクステータスバッジ

| 状態 | テキスト色 | 背景色 | ボーダー | 表示テキスト |
|------|----------|-------|--------|------------|
| PENDING（未着手） | `slate-600` | `slate-50` | `slate-200` | 未着手 |
| IN_PROGRESS（進行中）| `blue-700` | `blue-50` | `blue-200` | 進行中 |
| DONE（完了） | `emerald-700` | `emerald-50` | `emerald-100` | 完了 ✓ |
| CANCELLED | `slate-400` | `slate-50` | `slate-100` | キャンセル |

### タスク優先度ドット

```tsx
// PriorityDot.tsx
const colors = {
  HIGH:   "bg-rose-500",
  MEDIUM: "bg-yellow-400",
  LOW:    "bg-slate-300",
};
// <span className={`w-2 h-2 rounded-full ${colors[priority]}`} />
```

### AIスケジュールバッジ

AIが生成したスケジュールであることを示すラベル：

```tsx
<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px] font-bold tracking-wider">
  <Sparkles className="w-3 h-3" />
  AI生成
</span>
```

### ローディング状態

- スケジュール生成中：`Sparkles` アイコンが `animate-pulse` + 「AI がスケジュールを作成中...」テキスト
- API ロード中：shadcn/ui の `Skeleton` コンポーネント（カード単位でスケルトン表示）

### 空状態（Empty State）

```tsx
// タスクが0件のとき
<div className="flex flex-col items-center justify-center py-16 text-slate-400">
  <ListTodo className="w-10 h-10 mb-3 stroke-1" />
  <p className="text-sm font-medium">タスクがありません</p>
  <p className="text-xs mt-1">「+ タスクを追加」からタスクを登録してください</p>
</div>
```

---

## コンポーネント共通仕様

### ボタン（shadcn/ui `Button` を基本とし、バリアントをカスタマイズ）

| バリアント | 用途 | スタイル |
|----------|------|--------|
| `default` | 主要CTA（スケジュール生成・保存）| `bg-[#0052FF] text-white hover:bg-blue-700` |
| `secondary` | 副次アクション（再生成・編集）| `bg-slate-100 text-slate-700 hover:bg-slate-200` |
| `outline` | 境界線ボタン（詳細・キャンセル）| `border border-slate-200 text-slate-700` |
| `ghost` | アイコンボタン・ナビゲーション | `hover:bg-slate-50 text-slate-600` |
| `destructive` | 削除アクション | `bg-rose-600 text-white hover:bg-rose-700` |

### フォーム（shadcn/ui `Input` / `Select` / `Textarea`）

```tsx
// 共通スタイル
<Input className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400
                  focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 rounded-lg" />
```

### カード

```tsx
<div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)]
               border border-slate-100 p-5
               hover:shadow-md transition-shadow duration-200">
  {/* カード内容 */}
</div>
```

### モーダル（shadcn/ui `Dialog`）

```tsx
<DialogContent className="rounded-2xl shadow-xl max-w-md">
  <DialogHeader>
    <DialogTitle className="text-base font-bold text-slate-900">タスクを追加</DialogTitle>
  </DialogHeader>
  {/* フォーム */}
</DialogContent>
```

---

## ナビゲーション（サイドバー）

```tsx
const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "ダッシュボード" },
  { href: "/tasks",     icon: ListTodo,        label: "タスク一覧" },
  { href: "/schedule",  icon: CalendarDays,    label: "スケジュール" },
  { href: "/settings",  icon: Settings,        label: "設定" },
];
```

**アクティブ状態**
```tsx
// アクティブな NavItem
<div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 font-medium">
  <span className="w-1.5 h-1.5 rounded-full bg-[#0052FF]" />  {/* アクティブドット */}
  <Icon className="w-4 h-4" strokeWidth={1.5} />
  <span className="text-sm">{label}</span>
</div>
```

---

## ファイル構成

```
app/
├── (auth)/
│   └── signin/page.tsx         # ログインページ
├── dashboard/page.tsx
├── tasks/page.tsx
├── schedule/page.tsx
└── settings/page.tsx

components/
├── layout/
│   ├── AppLayout.tsx            # サイドバー + メインコンテンツ のラッパー
│   ├── Sidebar.tsx
│   ├── TopNav.tsx
│   └── MobileSidebar.tsx        # モバイル用ドロワー
├── dashboard/（上記参照）
├── tasks/（上記参照）
├── schedule/（上記参照）
├── settings/
│   ├── SettingsForm.tsx
│   ├── LifeRhythmSection.tsx
│   ├── AiPersonalitySection.tsx
│   └── CalendarModeSection.tsx
└── ui/（shadcn/ui コンポーネント）
    ├── button.tsx
    ├── card.tsx
    ├── dialog.tsx
    ├── sheet.tsx
    ├── input.tsx
    ├── select.tsx
    ├── textarea.tsx
    ├── badge.tsx
    ├── skeleton.tsx
    └── tabs.tsx
```

---

## 未決事項・考慮点

- [ ] ダークモード対応：Phase 1 は非対応（`light` 固定）。Tailwind の `darkMode: "class"` で後から追加可能な設計にしておく
- [ ] タイムラインのドラッグ&ドロップ（スケジュールブロックを動かして手動調整）：Phase 1 では非対応
- [ ] スケジュール確認画面で個別ブロックを削除・時間変更する UI：Phase 1.5 以降で検討
- [ ] レスポンシブ：タブレット（768px〜）まで対応。それ以下はスコープ外
- [ ] トースト通知（shadcn/ui `Sonner`）：タスク作成・削除・カレンダー反映完了時に使用
- [ ] ページ遷移の `loading.tsx`：各ルートに Skeleton UI を配置してCLS（レイアウトシフト）を防ぐ
