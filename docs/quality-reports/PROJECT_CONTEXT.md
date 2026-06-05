# Project Context for Weekly Quality Check — satoyama-tree-app

## Design Constraints (Accepted Tradeoffs)

このアプリは**オフライン前提の現場運用アプリ**であり、以下は意図的な設計判断として受容されている。週次チェックでは検出しないこと：

- **ブラウザ側 PIN 認証**: サーバー認証を必須にするとオフライン時に動作不能になるため
- **IndexedDB への顧客情報・認証情報のキャッシュ**: オフライン動作に必須
- **クライアント側での機密データ比較**: オフライン環境での必要悪

これらを「セキュリティ上の脆弱性」として扱わず、設計の前提として固定する。

---

## Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5 (strict mode)
- **Data layer**: Supabase + Postgres + RLS (anon key のみ使用、service_role は未使用)
- **Frontend**: React 18 + Tailwind CSS 4
- **Auth**: Supabase Auth (Email OTP) — ただし `/c/[clientId]` はパブリックルート（設計上の制約、上記参照）
- **Offline DB**: Dexie v4 (IndexedDB) — trees / species / pendingEdits をローカルキャッシュ
- **External integrations**: adm-zip (ZIP/.lbx 操作)、@react-pdf/renderer、Brother Smooth Print URL scheme

## Scale / Sensitivity

- 小規模社内ツール。スタッフ7名、端末数台（Android + iPhone + 事務所 PC）
- 顧客情報・出荷記録・樹木在庫を扱う。外部公開ポータルあり（クライアント向け）
- 電波の届かない山間部での現場使用が前提。オフライン耐性が最優先

---

## Custom Security Checks

### [CHECK-1] サーバー側 API ルートの認証チェック漏れ

**What to look for:** `src/app/api/` 配下のルートハンドラが、レスポンスを返す前に `supabase.auth.getUser()` でセッション検証をしているか。認証なしで DB データや生成ファイルを返していないか。

**Files to inspect:** `src/app/api/**/*.ts`

**Actionable when:** ルートハンドラが `createClient()` を使っているが `auth.getUser()` のエラーチェックが存在しない場合。または `anon` キーで直接 DB クエリして結果をそのまま返している場合。

---

### [CHECK-2] adm-zip / lbx 生成における path traversal

**What to look for:** `/api/label/[id]/route.ts` は URL パラメータ `id` を受け取り .lbx テンプレートを書き換えて返す。`id` が正規表現バリデーションなしにファイルパス・ZIP エントリ名・SQL に使われていないか。

**Files to inspect:** `src/app/api/label/[id]/route.ts`

**Actionable when:** `params.id` が `/[^a-zA-Z0-9\-_]/` 等のバリデーションなしにパス生成・adm-zip エントリ名・Supabase クエリのフィルタ値に使われている場合。

---

### [CHECK-3] `NEXT_PUBLIC_` プレフィックスの過剰使用

**What to look for:** `NEXT_PUBLIC_` がついた環境変数はブラウザバンドルに展開される。現状は `SUPABASE_URL` と `ANON_KEY` のみが正当。それ以外の機密値（Webhook シークレット、サービスロールキー等）が誤って `NEXT_PUBLIC_` で参照されていないか。

**Files to inspect:** `src/**/*.{ts,tsx}`, `next.config.ts`, `.env*`

**Actionable when:** `NEXT_PUBLIC_` プレフィックスを持つ env var が URL / anon key 以外の値を参照している場合。

---

### [CHECK-4] スタッフ PIN 定数の権限スコープ拡大

**What to look for:** `src/lib/constants.ts` の `STAFF` 配列は4桁 PIN で識別するだけ。現状は問題ないが、`isAdmin` / `role` / `permission` などの権限フィールドが追加されていないか、またはこのファイルがサーバーサイドコード（API ルート・Server Component）から import されていないか。

**Files to inspect:** `src/lib/constants.ts`。`grep -r "constants" src/app/api src/app/**/page.tsx` でサーバー側からの参照も確認。

**Actionable when:** STAFF エントリに権限フィールドが追加されている場合、またはサーバーサイドで PIN 照合に使われている場合。

---

### [CHECK-A] ログアウト時の IndexedDB クリア処理

**What to look for:** 端末の引き継ぎ・紛失時、IndexedDB に残った樹木データ・顧客情報・pendingEdits が漏洩するリスクは現実的。ログアウトフロー（`auth/` 配下、またはログアウトボタン）で `db.delete()` や `indexedDB.deleteDatabase()` が呼ばれているか。

**Files to inspect:** `src/app/auth/**/*.{ts,tsx}`、ログアウト UI を含む全コンポーネント（`grep -r "signOut\|logout" src/`）、`src/lib/db.ts`

**Actionable when:** `supabase.auth.signOut()` が呼ばれているが、その前後で Dexie DB のクリア処理が存在しない場合。

---

### [CHECK-B] pendingEdits 同期キューの冪等性・損失耐性

**What to look for:** 再接続時の `syncPendingEdits()` が二重書き込み・データ損失を起こさないか。特に同一 tree_id に複数の pendingEdit がある場合の処理、Supabase エラー時のリトライ挙動、重複管理番号（23505）ハンドリング。

**Files to inspect:** `src/lib/tree-repository.ts` の `syncPendingEdits` / `syncPendingRegistrations` 周辺、`src/lib/db.ts` の `pendingEdits` テーブル定義

**Actionable when:** (1) Supabase エラー時に pendingEdit レコードが削除されてしまう（データ損失）、(2) 成功した edit が再送される可能性がある（二重書き込み）、(3) エラーが永久ループに陥る可能性がある（23505 以外のエラーコードがリトライ対象になっている等）

---

### [CHECK-C] IndexedDB スキーマバージョン管理

**What to look for:** Supabase 側のテーブルスキーマ変更時、古いキャッシュデータとの非互換が起きないか。Dexie の `version()` チェーンが最新マイグレーションに追随しているか。`supabase/migrations/` に新しいカラム追加があった場合、`db.ts` の型定義と Dexie スキーマに反映されているか。

**Files to inspect:** `src/lib/db.ts`（Dexie バージョン定義）、`supabase/migrations/` 最新ファイル、`src/types/database.ts`

**Actionable when:** 直近の migration で追加されたカラムが `db.ts` の Dexie スキーマや `database.ts` の型定義に存在しない場合。または Dexie の `version` 番号が変更されたのに `.upgrade()` ハンドラが存在しない場合。

---

### [CHECK-D] 弱い認証スコープの拡大監視

**What to look for:** 設計上受容している anon アクセス（ポータルルート）が、新しいページ・エンドポイントに広がっていないか。「現状維持なら OK、増えたらフラグ」型のチェック。

**2026-06-05 時点の受容済みパターン（ベースライン）:**

以下の 2 ページ（ファイル計 2 件）は意図的に Supabase Auth なし・anon クライアントで動作する。これらは週次チェックでフラグしない：

| ページ | ファイル | アクセス制御 |
|--------|---------|-------------|
| クライアントポータル index | `src/app/c/[clientId]/page.tsx` | 任意 PIN（4〜6桁）または無制限 |
| クライアントポータル出荷詳細 | `src/app/c/[clientId]/s/[shipmentId]/page.tsx` | 同上 |

**admin ページの扱い（フラグしない）:**  
`src/app/trees/`, `src/app/shipments/`, `src/app/clients/`, `src/app/estimates/`, `src/app/species/`, `src/app/scan/`, `src/app/logs/`, `src/app/reservation-scan/` 等は全て `@/lib/supabase/client`（ブラウザクライアント）を使うが、Supabase RLS `TO authenticated` ポリシーがデータを保護している。明示的な `auth.getUser()` チェックはないが、これは RLS 依存の設計であり受容済み。

**Files to inspect:** `src/app/` 配下の全 `page.tsx`、`src/app/api/` 配下の全 `route.ts`

**Actionable when:** 以下のいずれかに該当する新規ファイル・コードが追加されている場合：
1. `src/app/c/` 以外のパスで `@/lib/supabase/client` の `createClient()` を使い、かつ anon ロール向けの RLS ポリシー（`TO anon` / `TO public`）が必要なテーブルにアクセスしている
2. `src/app/api/` 配下のルートが `auth.getUser()` なしで機密データを返している（CHECK-1 と重複するが、スコープ拡大の文脈で再確認する）
3. 上記ベースラインの受容済みページリストに新しいファイルが追加されている

---

## Project Conventions (cross-reference)

- `CLAUDE.md` §コード規約: `any` 禁止、Server Components 優先、Supabase RLS 全テーブル有効化必須
- `CLAUDE.md` §Brother Smooth Print URL scheme の罠: `URLSearchParams` 禁止、`.lbx` 拡張子必須 等。API ルートの変更時は7つの罠に準拠しているか確認
- `HOME_SYNC.md`: 直近の申し送り事項（バグ修正・新機能）と照らし合わせて、その週の変更が品質基準を満たしているか確認
