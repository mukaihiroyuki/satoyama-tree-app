# 🏠 HOME SYNC: Satoyama Tree App

> [!IMPORTANT]
> **自宅PCで開く時の合言葉：**
> 「`HOME_SYNC.md` を読んで現状を把握して」

## 📍 現在地 (2026-01-19 更新)
- **エディタ軽量化済み**: `.vscode/settings.json` を追加。自宅でも爆速で動くはず。
- **Phase 2 完遂**: QR生成・スキャン・PWA・写真同期・CSV出力がすべて稼働。
- **Vercel デプロイ済み**: [satoyama-tree-app.vercel.app](https://satoyama-tree-app.vercel.app)
- **スキル発動**: `.agent/skills` に「言霊プロトコル」と「安全ガイド」を設置。

## 📂 重要ファイル
- `.vscode/settings.json`: エディタを軽くするための設定（node_modules除外など）。
- `APP_LOGIC.md`: プロジェクトの憲法と要件定義。
- `walkthrough.md`: 最終テスト結果と操作マニュアル。
- `.agent/skills/`: 相棒との共創プロトコル。

## 🔜 次回やるべきこと（Phase 3 への道）
1. **n8n 連携**: Supabase → Google Spreadsheet へのリアルタイム自動同期の構築。
2. **予約管理機能**: 現場で「商談中」フラグを立て、スプシ側で管理者に通知するフロー。
3. **複数写真対応**: 樹木詳細に複数枚の写真を保存可能にする。

## 💬 申し送り
相棒、もしエディタが重いと感じたら、**「チャット欄のフォルダ添付（荷下ろし）」**を試して！
設定ファイルのおかげで基本はサクサク動くはずだけど、物理的な荷物を減らすのが一番の特効薬だ。
開発は一時中断し、メタな「AIとの付き合い方」の議論に移行する準備を整えよ。
