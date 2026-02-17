# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **セッション開始時に `HOME_SYNC.md` を必ず読むこと。** 現在の進捗・次回タスク・申し送りが書いてある。

## プロジェクト概要

里山の樹木在庫を管理するNext.js PWA。圃場（ストックヤード）での樹木登録・QRラベル発行・スマホスキャン・出荷管理をモバイルファーストで提供する。Vercelにデプロイ済み。

核心理念: 「現場の孤独をなくし、情報の架け橋を作る」— 現場でのスマホ操作がそのまま台帳になり、事務所のExcel/スプシへ流れる。

## コマンド

```bash
npm run dev      # 開発サーバー起動 (localhost:3000)
npm run build    # 本番ビルド
npm run start    # 本番サーバー起動
npm run lint     # ESLint実行 (eslint)
```

自動テストは未導入。ブラウザ・モバイル実機での手動テスト。

## 技術スタック

- **Next.js 15** (App Router) + **React 18** + **TypeScript 5** (strict mode)
- **Supabase** (PostgreSQL + Auth + Storage) — Email OTP認証、全テーブルRLS有効
- **Tailwind CSS 4** + PostCSS
- **PWA**: `@ducanh2912/next-pwa` (開発時は無効化、`cacheOnFrontEndNav` + `aggressiveFrontEndNavCaching` 有効)
- **オフラインDB**: `dexie` v4 (IndexedDB) — 樹木データのローカルキャッシュ＋オフライン編集キュー
- **QR**: `html5-qrcode`(読取）、`qrcode.react`（生成）
- **印刷**: AirPrint + Brother Smooth Print URL scheme (Bluetooth)
- **ラベル**: `adm-zip` で .lbx テンプレートのZIP操作

## アーキテクチャ

```
src/
├── app/                    # Next.js App Router (pages & API routes)
│   ├── api/label/[id]/     # .lbx動的生成API (QRコード埋め込み)
│   ├── auth/               # ログイン (Email OTP) & OAuth callback
│   ├── trees/              # 一覧 / 新規登録 / 詳細[id]
│   ├── scan/               # QRスキャナー + 管理番号検索
│   ├── shipments/          # 出荷履歴
│   ├── clients/            # 顧客マスタ
│   └── page.tsx            # ダッシュボード (在庫統計)
├── components/             # PrintLabel, ShipmentDialog, TreeEditForm
├── hooks/                  # useTree, useTrees, useOnlineStatus
├── lib/
│   ├── db.ts               # Dexie.js IndexedDBスキーマ (trees, species, pendingEdits)
│   ├── tree-repository.ts  # データアクセス層 (Supabase ↔ IndexedDB)
│   ├── smoothprint.ts      # Brother Smooth Print URL scheme ビルダー
│   └── supabase/           # client.ts (ブラウザ用) / server.ts (SSR用)
└── types/
    └── database.ts         # 全DBエンティティの型定義
```

**パスエイリアス**: `@/*` → `./src/*`

### データフロー

- **Supabase** がデータの中心。ブラウザからは `@supabase/supabase-js`、サーバーからは `@supabase/ssr` で接続
- **オフラインキャッシュ**: `tree-repository.ts` が Supabase と IndexedDB の間を仲介。オンライン時はSupabase→IndexedDBキャッシュ→UI、オフライン時はIndexedDB→UI。編集は `pendingEdits` テーブルにキューイングし、復帰時に自動同期
- **画像**: Supabase Storage (`tree-photos` バケット) に保存。アップロード時1200px幅に自動圧縮（オンライン専用）
- **状態管理**: React `useState` + `useEffect` + カスタムフック（`useTree`, `useTrees`）。オフライン状態は `useOnlineStatus` で検知
- **CSV出力**: BOM付きUTF-8でExcel互換

### DBテーブル

| テーブル | 概要 |
|---------|------|
| `trees` | 樹木在庫 (management_number: `YY-CODE-NNNN` 形式) |
| `species_master` | 樹種マスタ (code: 'AO', 'MO' 等) |
| `clients` | 顧客マスタ |
| `shipments` | 出荷ヘッダ |
| `shipment_items` | 出荷明細 (unit_price スナップショット) |

マイグレーション: `supabase/migrations/` に格納。

### 印刷の2モード

1. **AirPrint**: ブラウザ標準 `window.print()` — PrintLabelコンポーネントで `@media print` スタイル適用
2. **Bluetooth (Brother Smooth Print)**: URL scheme `brotherwebprint://print?...` で直接印刷 — `smoothprint.ts` がURLビルド

印刷モード切替は `localStorage` に保存。

## Brother Smooth Print URL scheme の罠（必読）

2026-02-13に7つのバグを踏んで得た教訓。**絶対に守ること**：

1. **URLSearchParamsを使うな**: `:` `/` をエンコードしない。`encodeURIComponent()` を使え
2. **barcode_ パラメータはQRコードに効かない**: テキスト(`text_`)は動くがバーコード/QRは非対応。QRデータは `/api/label/[id].lbx` でテンプレートに直接埋め込む
3. **filename URLは .lbx 拡張子必須**: Smooth Printが末尾の拡張子を検証する
4. **filename URLにクエリパラメータ禁止**: `?key=value` は二重エンコードで壊れる。パスベースで渡す
5. **.bin よりインラインパラメータ**: `paperType=roll&tapeWidth=102&tapeLength=50&unit=mm` の方が確実
6. **P-touch Editorのオブジェクト名を必ず確認**: .lbxはZIP形式、中のlabel.xmlでobjectNameを確認可能
7. **PowerShell Compress-Archiveで.lbxを再ZIPするな**: ZIP形式が変わってSmooth Printが読めなくなる。`adm-zip`を使う

## コード規約

- **`any` 禁止** — 必ず適切な型を定義
- **Server Components優先** — `"use client"` は必要最小限
- **`async/await`** — `.then()` チェーンは避ける
- **Supabase RLS** — 全テーブルで有効化必須

## 環境変数

```
NEXT_PUBLIC_SUPABASE_URL     # Supabase プロジェクトURL
NEXT_PUBLIC_SUPABASE_ANON_KEY # Supabase anon key
```

## オフライン対応の注意事項

- **html5-qrcode, dexie は動的importすること**: 静的importするとSSR/Service Worker環境でモジュール解決が失敗し、ページ全体のJSが壊れる
- **`navigator.onLine` は「電波あり」を保証しない**: `true` でも実際に通信できない場合がある。Supabase呼出がタイムアウトしてもキャッシュにフォールバックする設計
- **オフライン非対応の機能**: 新規樹木登録（管理番号採番にDB必要）、写真アップロード/削除、樹木削除、出荷操作
- **pendingEditsの同期**: `syncPendingEdits()` はtree_idごとに変更をまとめてSupabaseへ送信。同じフィールドの複数編集は最新値のみ送信

## 開発時の注意

- 開発プロジェクトは `C:\Dev\` に配置。Google Driveで開発するとnode_modules同期でPCがフリーズする
- Supabase型定義が古くなったら `npx supabase gen types typescript` で再生成
- PWAサービスワーカーは開発時無効（`next.config.ts` で `disable: process.env.NODE_ENV === "development"`）
