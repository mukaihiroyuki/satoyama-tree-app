# 🏠 HOME SYNC: Satoyama Tree App

> [!IMPORTANT]
> **自宅PCで開く時の合言葉：**
> 「`HOME_SYNC.md` を読んで現状を把握して」

## 📍 現在地 (2026-04-21 更新)
- **スタッフPIN認証**: 4桁PINでスタッフ識別（localStorage、電波不要）。7名登録（`src/lib/constants.ts` STAFF配列）。`useStaffPin`フック + `StaffPinGuard`ラッパー。
- **操作ログ**: `activity_logs`テーブル。全操作（create/edit/reserve/cancel_reserve/ship/cancel_ship/delete/estimate）を記録。`logActivity()`/`logActivityBulk()`。専用ページ `/logs`。
- **見積編集**: クライアント・掛け率一括適用・単価個別編集・明細追加削除・ステータス・担当者・日付・備考。出荷済み見積は編集不可。
- **ピッキング**: 出荷時QRスキャン照合。`shipments.picking_status`（pending→in_progress→completed）、`shipment_items.picked_at`。出荷詳細→「ピッキング開始」→スキャン→「出荷確定」。スキップ機能あり。
- **クライアントポータル**: `/c/{clientId}`。QRスキャン受入チェック、進捗バー、CSV出力。`client_receipts`テーブルで受入記録。
- **ポータル認証**: `clients.portal_password`（4〜6桁PIN）。sessionStorage保存。未設定ならパスワードなしでアクセス可。
- **ポータル設定**: クライアント管理画面で portal_enabled/portal_show_price/portal_password を設定。URLコピー機能。
- **Phase 2 完遂**: QR生成・スキャン・PWA・写真同期・CSV出力がすべて稼働。
- **Bluetooth印刷 完成**: Brother RJ-4250WB + Smooth Print URL scheme で現場印刷が動作。
- **オフライン編集対応 完成**: IndexedDB (Dexie.js) によるキャッシュ層を実装。電波のない現場でも閲覧・編集可能。
- **オフラインキャッシュ自動準備**: ダッシュボード表示時にOfflineCacheWarmerが全データをIndexedDBに先読み。「✅ オフライン準備OK」確認後に山へ出発する運用。
- **QRスキャナー刷新済み**: html5-qrcode → getUserMedia + BarcodeDetector/jsQR。iOS PWAで安定動作。
- **ラベルAPI動的生成**: .lbxテンプレートをAPI側でQRサイズ・位置・セル粒度を動的書き換え。
- **出荷管理強化済み**: 出荷詳細ページ（樹種別集計）、詳細ページからの個別出荷フロー完備。
- **tree_number廃止済み**: 管理番号(management_number)に完全統一。UI・型定義・オフラインDB・CSV全箇所から除去。
- **樹種マスター管理ページ新設**: `/species` で事前に樹種を追加・コード編集が可能に。
- **Blackview FORT1 動作検証完了**: Android 15（Wi-Fi専用・SIMなし）+ Chrome PWA + Smooth Print APK + Brother RJ-4250WB Bluetooth印刷、すべて正常動作確認済み。
- **Vercel デプロイ済み**: [satoyama-tree-app.vercel.app](https://satoyama-tree-app.vercel.app)

## 📂 重要ファイル
- `CLAUDE.md`: プロジェクト固有ルール + **Smooth Printの7つの罠**（必読）
- `APP_LOGIC.md`: プロジェクトの憲法と要件定義
- `src/lib/db.ts`: IndexedDBスキーマ（Dexie.js）— オフラインキャッシュの心臓部
- `src/lib/tree-repository.ts`: データアクセス層（Supabase ↔ IndexedDB）
- `src/hooks/useTree.ts`, `useTrees.ts`, `useOnlineStatus.ts`: オフライン対応カスタムフック
- `src/components/TreeEditForm.tsx`: 樹木編集フォーム（オフライン保存対応）
- `src/components/OfflineCacheWarmer.tsx`: ダッシュボード用オフラインキャッシュ自動準備
- `src/lib/smoothprint.ts`: Bluetooth印刷 URL scheme ビルダー（キャッシュバスター付き）
- `src/app/api/label/[id]/route.ts`: QRコード埋め込み .lbx 動的生成API（replacePositionByObjectName）
- `src/app/scan/page.tsx`: QRスキャナー（BarcodeDetector + jsQRフォールバック）
- `src/app/shipments/[id]/page.tsx`: 出荷詳細ページ（樹種別グループ集計）
- `src/app/species/page.tsx`: 樹種マスター管理（一覧・追加・コード編集）
- `src/app/logs/page.tsx`: 操作ログ閲覧ページ
- `src/app/c/[clientId]/page.tsx`: クライアントポータル（QR受入チェック）
- `src/app/shipments/[id]/picking/page.tsx`: ピッキング（出荷時QRスキャン照合）
- `src/lib/constants.ts`: STAFF配列（PIN）、ASSIGNEES
- `src/lib/activity-log.ts`: 操作ログ記録ユーティリティ
- `src/hooks/useStaffPin.ts`: スタッフPIN認証フック
- `src/components/StaffPinGuard.tsx`: PIN入力ガード + スタッフバー
- `public/print-templates/`: P-touch Editor テンプレート + 用紙設定

## 🔜 次回やるべきこと
- **UXヌルヌル化プロジェクト**（棚卸しテーマ）: 削除・追加・登録時のワンテンポ遅れを解消。楽観的UI更新（Optimistic UI）の導入。まずは削除・編集・追加の3機能から。DevTools Performanceタブでボトルネック測定→改善の流れ。土台（IndexedDBローカルファースト）は既にあるので、UI側を通信から切り離す作業が中心。Linear/Superhuman級の体感速度を狙う
- 見積バージョン管理（帳票機能の拡張）
- ポータルのメール認証対応（積水等の大手クライアントから要望が出た場合）
- SaaS化検討（クライアント自社在庫へのQR管理拡張→従量課金モデル）

## ✅ 見送り・運用で対応
- **新規登録のオフライン対応**: 現場での新規登録頻度が低いため開発しない。現場ではメモ帳に記録し、事務所でオンライン登録する運用とする
- **クライアント・出荷履歴のオフライン対応**: 現場で必要になった時に対応する。同じパターン（IndexedDBキャッシュ層追加）で実装可能

## 💬 申し送り
2026-04-21: 事務員PCで「未同期の編集が4件あります」バナーが消えない事故が発生。原因は管理番号の重複(PG 23505)による永久ループ。`syncPendingRegistrations`に重複時のリトライ採番（max再取得→再insert、最大3回）を追加。加えて管理メニュー内に「同期キューをクリア」ボタンを新設（トップ画面の折りたたみ`<details>`内に配置、件数表示＋確認ダイアログ＋破壊的UIの多層ガード）。バナー直置きは作業員スマホでの誤タップリスクがあるため却下。事務員端末は Chrome に統一する運用方針に（Edgeの Sleeping tabs / 効率モードで同期遅延が発生）。**次回テーマ候補**: 削除・追加・登録のワンテンポ遅れを解消する「UXヌルヌル化」— 楽観的UI更新の導入。

2026-03-17: ラベルに樹高・株立ち情報を追加（TREE_INFOテキストオブジェクト、.lbxレイアウト5行化）。見積書PDF明細を管理番号昇順にソート。樹種セレクトで優先4種（アオダモ・モミジ・ツツジ・ナツハゼ）を上位固定表示。登録直後の「樹木が見つかりません」バグ修正（tempId→新IDマッピング+history.replaceStateでチラつき解消）。作業フロー設計セッション実施：手書きリスト廃止・ダブルチェック不要の結論に到達。現場導入は「一緒に試してみて」→作業員が自分で気づく方式で進める方針。ラベルの実機印刷テストは実施済み（樹高表示OK、株立1は非表示仕様でOK）。ビルドエラー（/treesページのプリレンダリング）は既存問題で今回の変更とは無関係、Vercelデプロイは正常。

2026-03-06: スタッフPIN認証・操作ログ・見積編集・ピッキング・クライアントポータル・アクセスコード認証を一気に実装。DB変更はSupabase SQL Editorで直接実行（activity_logs, picking_status, picked_at, portal_enabled, portal_show_price, portal_password, client_receipts）。スタッフPINはuseSyncExternalStoreで実装（useStateのuseEffect内setState問題を回避）。ピッキングはBarcodeDetector+jsQRフォールバック。クライアントポータルは認証不要→PIN認証に強化。積水ハウスへの納品でセキュリティ質問に備えて対策済み（HTTPS/国内DC/アクセスコード/操作記録/データ分離）。SaaS化の種（クライアント自社在庫QR管理→従量課金）は需要が出てから着手する方針。

2026-03-05: 出荷取消し・予約取消し・一括削除（3段階確認）・フィルター永続化・クライアント自動選択・価格アラートを一気に実装。DB側ではestimate_items/shipment_itemsのtree_id FKにON DELETE CASCADEを追加（Supabase SQL Editorで直接実行、マイグレーションファイルなし）。DeleteConfirmDialogは3ステップで段階的に威圧的になるカスタムモーダル。価格アラートはstep="1000"→"1"に変更しブラウザバリデーション干渉を排除、リアルタイムのオレンジ警告ボックス+submit時confirm()の二重チェック。個別削除後のナビゲーションはrouter.back()でフィルター維持。

2026-03-04: ダッシュボードにクライアント別出荷実績テーブルを追加。`getClientSales()`でshipments+shipment_items+clientsをJOIN→JS側で集計。最初は展開式の明細（ClientSalesDetail.tsx）を作ったが、「1000本になったら微妙」との指摘で展開なしのシンプルサマリーに変更。グラフ化も検討したが、現状2社では不要と判断。クライアントが増えて出荷履歴のフィルターが必要になったら追加する方針。社長向け機能として月別売上推移・売れ筋樹種ランキング・在庫金額・滞留在庫アラートを候補に挙げたが、春の出荷シーズンが本格化してからで十分と判断。

2026-02-20: FORT1（Wi-Fi専用・SIMなし）が山（電波圏外）で樹種選択できない問題を修正。原因: `/trees/new`が`tree-repository.ts`のキャッシュ対応関数を使わずSupabaseに直接問い合わせていた。修正: (1) `getAllSpecies()`に差し替え（IndexedDBフォールバック対応）、(2) ダッシュボードにOfflineCacheWarmer追加（アプリ起動時に全データを自動キャッシュ、「✅ オフライン準備OK」表示）。運用: 事務所Wi-Fiでアプリ開く→「✅」確認→山へ。なお、クライアント管理・出荷履歴はまだオフライン未対応（必要になったら同パターンで追加可能）。

2026-02-19: Blackview FORT1（Android 15）セットアップ完了。PWA（Chrome）インストール・ログイン→Smooth Print APK手動インストール（Brother開発者サイトからZIPダウンロード→解凍→APKインストール）→Brother RJ-4250WBとBluetoothペアリング→PWAからのラベル印刷テスト、すべて成功。注意点：Android版Smooth PrintはGoogle Play非公開、Brother開発者サイト（online.brother.co.jp）でユーザー登録してAPKダウンロードが必要。Bluetooth接続時、iPhoneが先にプリンターを掴んでいると接続できない（iPhone側Bluetoothオフで解決、ペアリング自体は複数台共存可能）。

2026-02-18: tree_number廃止を完了（management_numberに統一）。樹種マスター管理ページ(`/species`)を新設し、事務所での事前登録が可能に。ダッシュボードにナビリンク追加。ラベル行間問題は2/17に解決済み。Vercelデプロイ確認済み。

2026-02-17: 現場実地テスト後のセキスイデモに向けて緊急修正を実施。QRコードサイズ縮小（62pt→40pt）、セル粒度拡大（2.4pt→3.5pt）、QR右端配置（x=226pt）で曲面読み取り改善。QRスキャナーをBarcodeDetector+jsQRに完全刷新（html5-qrcodeは不安定すぎた）。Smooth Printのキャッシュ問題はURLパスにタイムスタンプ埋め込みで解決。一覧デフォルトを在庫のみ表示、出荷済み削除ボタン非表示、出荷詳細ページ新規追加、詳細ページの「出荷済み」ボタンを出荷ダイアログ経由に変更。
