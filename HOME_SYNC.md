# 🏠 HOME SYNC: Satoyama Tree App

> [!IMPORTANT]
> **自宅PCで開く時の合言葉：**
> 「`HOME_SYNC.md` を読んで現状を把握して」

## 📍 現在地 (2026-02-17 更新)
- **Phase 2 完遂**: QR生成・スキャン・PWA・写真同期・CSV出力がすべて稼働。
- **Bluetooth印刷 完成**: Brother RJ-4250WB + Smooth Print URL scheme で現場印刷が動作。
- **オフライン編集対応 完成**: IndexedDB (Dexie.js) によるキャッシュ層を実装。電波のない現場でも閲覧・編集可能。
- **QRスキャナー刷新済み**: html5-qrcode → getUserMedia + BarcodeDetector/jsQR。iOS PWAで安定動作。
- **ラベルAPI動的生成**: .lbxテンプレートをAPI側でQRサイズ・位置・セル粒度を動的書き換え。
- **出荷管理強化済み**: 出荷詳細ページ（樹種別集計）、詳細ページからの個別出荷フロー完備。
- **Vercel デプロイ済み**: [satoyama-tree-app.vercel.app](https://satoyama-tree-app.vercel.app)

## 📂 重要ファイル
- `CLAUDE.md`: プロジェクト固有ルール + **Smooth Printの7つの罠**（必読）
- `APP_LOGIC.md`: プロジェクトの憲法と要件定義
- `src/lib/db.ts`: IndexedDBスキーマ（Dexie.js）— オフラインキャッシュの心臓部
- `src/lib/tree-repository.ts`: データアクセス層（Supabase ↔ IndexedDB）
- `src/hooks/useTree.ts`, `useTrees.ts`, `useOnlineStatus.ts`: オフライン対応カスタムフック
- `src/components/TreeEditForm.tsx`: 樹木編集フォーム（オフライン保存対応）
- `src/lib/smoothprint.ts`: Bluetooth印刷 URL scheme ビルダー（キャッシュバスター付き）
- `src/app/api/label/[id]/route.ts`: QRコード埋め込み .lbx 動的生成API（replacePositionByObjectName）
- `src/app/scan/page.tsx`: QRスキャナー（BarcodeDetector + jsQRフォールバック）
- `src/app/shipments/[id]/page.tsx`: 出荷詳細ページ（樹種別グループ集計）
- `public/print-templates/`: P-touch Editor テンプレート + 用紙設定

## 🔜 次回やるべきこと
1. **🔴 通し番号(tree_number)の廃止**: 管理番号があるため不要。DB変更+UI全箇所から除去
2. **ラベルのテキスト行間調整**: 品名(SPECIES)が消える問題の原因調査。テキストオブジェクト位置の安全な変更方法を探る
3. **新規登録のオフライン対応**: 管理番号の採番にDB問合せが必要なため未対応（要検討）
4. **タフスマホ(Blackview FORT1)でのPWA動作検証**: Android Chrome + Smooth Print Androidアプリでの印刷テスト

## 💬 申し送り
2026-02-17: 現場実地テスト後のセキスイデモに向けて緊急修正を実施。QRコードサイズ縮小（62pt→40pt）、セル粒度拡大（2.4pt→3.5pt）、QR右端配置（x=226pt）で曲面読み取り改善。QRスキャナーをBarcodeDetector+jsQRに完全刷新（html5-qrcodeは不安定すぎた）。Smooth Printのキャッシュ問題はURLパスにタイムスタンプ埋め込みで解決。一覧デフォルトを在庫のみ表示、出荷済み削除ボタン非表示、出荷詳細ページ新規追加、詳細ページの「出荷済み」ボタンを出荷ダイアログ経由に変更。通し番号の廃止は次回に持ち越し。
