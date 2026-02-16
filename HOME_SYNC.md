# 🏠 HOME SYNC: Satoyama Tree App

> [!IMPORTANT]
> **自宅PCで開く時の合言葉：**
> 「`HOME_SYNC.md` を読んで現状を把握して」

## 📍 現在地 (2026-02-13 更新)
- **Phase 2 完遂**: QR生成・スキャン・PWA・写真同期・CSV出力がすべて稼働。
- **Bluetooth印刷 完成**: Brother RJ-4250WB + Smooth Print URL scheme で現場印刷が動作。
- **Vercel デプロイ済み**: [satoyama-tree-app.vercel.app](https://satoyama-tree-app.vercel.app)

## 📂 重要ファイル
- `CLAUDE.md`: プロジェクト固有ルール + **Smooth Printの7つの罠**（必読）
- `APP_LOGIC.md`: プロジェクトの憲法と要件定義
- `src/lib/smoothprint.ts`: Bluetooth印刷 URL scheme ビルダー
- `src/app/api/label/[id]/route.ts`: QRコード埋め込み .lbx 動的生成API
- `public/print-templates/`: P-touch Editor テンプレート + 用紙設定

## 🔜 次回やるべきこと
1. **🔴 QRスキャンページ修正**: `/scan` のカメラが起動しない、検索も機能しない → 要調査
2. **オフライン印刷テスト**: 事務所でテンプレートキャッシュ後、機内モードでBluetooth印刷テスト
3. **ラベルレイアウト微調整**: P-touch Editorでフォントサイズ・配置を最終調整

## 💬 申し送り
2026-02-13: Bluetooth印刷は7つのバグを潰して完成。詳細は `CLAUDE.md` の「過去の失敗・注意事項」セクション4を参照。次回は `/scan` ページの修復が最優先。
