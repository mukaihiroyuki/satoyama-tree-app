# CLAUDE.md - 里山プロジェクト固有ルール

> **プロジェクト**: 里山樹木管理システム（Satoyama Tree Management System）
> **技術スタック**: Next.js 15, TypeScript, Supabase, Google Apps Script
> **全プロジェクト共通の開発哲学**: [CLAUDE.md（マスター版）](file:///g:/マイドライブ/my_Obsidian/HiroyukiObsidian_vault/20_Areas/21_AI_Tools/CLAUDE.md)

> [!IMPORTANT]
> **セッション開始時に `HOME_SYNC.md` を必ず読むこと。** 現在の進捗・次回タスク・申し送りが書いてある。

---

## 🌲 プロジェクト概要

里山の樹木を管理するWebアプリケーション。顧客情報、樹木データ、作業履歴を一元管理し、現場作業員が効率的に作業できるようにする。

---

## 📋 コード規約

### TypeScript
- **厳格な型定義**: `any` の使用は禁止。必ず適切な型を定義する
- **非同期処理**: `async/await` を使用。`.then()` チェーンは避ける
- **エラーハンドリング**: 全ての非同期処理に `try-catch` を実装

### React/Next.js
- **Server Components優先**: クライアントコンポーネントは必要最小限に
- **Hooks**: カスタムフックは `use` プレフィックスを付ける
- **命名規則**: コンポーネントはPascalCase、関数はcamelCase

### Supabase
- **RLS（Row Level Security）**: 全てのテーブルでRLSを有効化
- **型安全性**: Supabaseの型定義を必ず使用
- **リアルタイム**: 必要な場合のみRealtime機能を使用（パフォーマンス考慮）

---

## 🏗️ アーキテクチャ

### ディレクトリ構造
```
satoyama-tree-app/
├── app/              # Next.js App Router
├── components/       # Reactコンポーネント
├── lib/              # ユーティリティ、Supabaseクライアント
├── types/            # TypeScript型定義
└── public/           # 静的ファイル
```

### データフロー
1. **Google Sheets（マスターデータ）** → GAS → CSV出力
2. **Supabase（データベース）** ← CSV取り込み
3. **Next.jsアプリ** ← Supabase経由でデータ取得

---

## ⚠️ 過去の失敗・注意事項

### 1. Google Driveとの同期問題
- **問題**: Google Driveで開発すると、大量のファイル（`node_modules`など）が同期され、PCがフリーズする
- **解決策**: 開発プロジェクトは必ず`C:\Dev\`に配置。Google Driveは同期しない

### 2. Supabaseの型定義
- **問題**: Supabaseの型定義が古くなり、エラーが発生
- **解決策**: `npx supabase gen types typescript` で定期的に型定義を更新

### 3. プリンター機能（AirPrint）
- **問題**: 事務員のPCでプリンターが起動しない
- **原因**: ブラウザの権限設定、ネットワーク接続の問題
- **解決策**: ブラウザの設定確認、ネットワーク診断

### 4. Brother Smooth Print URL scheme（Bluetooth印刷）の罠
以下は2026-02-13に7つのバグを踏んで学んだ教訓。**絶対に守ること**：

- **URLSearchParamsを使うな**: `:` `/` をエンコードしない。`encodeURIComponent()` を使え
- **barcode_ パラメータはQRコードに効かない**: テキスト(text_)は動くがバーコード/QRは非対応。QRデータは `/api/label/[id].lbx` でテンプレートに直接埋め込む方式を使う
- **filename URLは .lbx 拡張子必須**: Smooth Print がURL末尾の拡張子を検証する
- **filename URLにクエリパラメータ禁止**: `?key=value` は二重エンコードで壊れる。パスベースで渡す
- **.bin ファイルよりインラインパラメータ**: `paperType=roll&tapeWidth=102&tapeLength=50&unit=mm` の方が確実
- **P-touch Editorのオブジェクト名を必ず確認**: .lbxはZIP形式、中のlabel.xmlでobjectNameを確認可能
- **PowerShell Compress-Archiveで.lbxを再ZIPするな**: ZIP形式が変わってSmooth Printが読めなくなる。adm-zipを使う

---

## 🔧 開発ワークフロー

### 1. 新機能開発
1. **PLANNING**: `implementation_plan.md` で設計
2. **EXECUTION**: Plan Modeで一撃実装
3. **VERIFICATION**: ブラウザテスト、`walkthrough.md` 作成

### 2. バグ修正
1. 原因調査（ログ解析、Supabaseデータ確認）
2. 修正実装
3. 検証（同じ条件で再現テスト）

### 3. リファクタリング
1. `code-simplifier` サブエージェントを活用
2. 既存機能の動作確認
3. テストで品質保証

---

## 📦 依存関係

### 主要ライブラリ
- **Next.js**: 15.x（最新安定版）
- **React**: 18.x
- **Supabase**: 最新版
- **TypeScript**: 5.x

### 注意事項
- **古いライブラリは使わない**: 必ず最新の安定版を使用
- **セキュリティアップデート**: 定期的に `npm audit` を実行

---

## 🧪 テスト戦略

### 自動テスト
- **単体テスト**: Jest + React Testing Library
- **E2Eテスト**: Playwright（`verify-app` サブエージェント活用）

### 手動テスト
- **ブラウザテスト**: Chrome, Edge, Safari
- **モバイルテスト**: iOS Safari, Android Chrome
- **プリンターテスト**: 実機で印刷確認

---

## 🚀 デプロイ

### 環境
- **開発**: `localhost:3000`
- **本番**: Vercel

### デプロイ前チェックリスト
- [ ] `npm run build` が成功する
- [ ] Supabase接続確認
- [ ] 環境変数設定確認
- [ ] プリンター機能テスト

---

## 📝 更新履歴

- 2026-01-29: 初版作成
