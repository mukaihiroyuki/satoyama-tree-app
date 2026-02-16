# 2026-02-13 Bluetooth印刷ついに完成 — 泥臭いデバッグの記録

## 今日やったこと

### Brother RJ-4250WB Bluetooth印刷の実装

Wi-Fiのない現場でPWAからラベル印刷するため、Brother Smooth Print URL scheme (`brotherwebprint://`) を統合した。

**最終的な構成:**
- テキスト（樹種名・価格・管理番号）→ `text_` パラメータで動的に渡す
- QRコード → `/api/label/[treeId].lbx` で .lbx テンプレートに直接埋め込んだファイルを動的生成
- 用紙設定 → インラインパラメータ（`paperType=roll`, `tapeWidth=102`, `tapeLength=50`, `unit=mm`）

### 遭遇したバグと解決策（時系列）

| # | 問題 | 原因 | 解決 |
|---|---|---|---|
| 1 | 印刷エラー | テンプレートのQRオブジェクト名が ` QRCOD`（スペース+E欠落） | P-touch Editorで `QRCODE` に修正 |
| 2 | 印刷エラー続く | PowerShell Compress-ArchiveがZIP形式を壊した | adm-zipで再作成 → さらにP-touch Editor直接保存に切替 |
| 3 | 印刷エラー続く | `URLSearchParams` が `:` `/` をエンコードしない | `encodeURIComponent` に変更 |
| 4 | 印刷エラー続く | `.bin` ファイルがSmooth Printと非互換 | インラインパラメータ（paperType等）に変更 → **ここで初めて印刷成功** |
| 5 | QRコードが0123456789 | `barcode_` パラメータがSmooth PrintでQRに非対応 | API Route で .lbx にQRデータを直接埋め込む方式に変更 |
| 6 | filename不正エラー | APIのクエリパラメータ `?qr=...` が二重エンコードで壊れる | パスベース `/api/label/[id].lbx` に変更 |
| 7 | filename不正エラー続く | URLに `.lbx` 拡張子がないとSmooth Printが拒否 | URL末尾に `.lbx` を付与 → **QRコード含め完全動作** |

### 学んだこと
- Brother Smooth Print の `barcode_` パラメータは QR コードオブジェクトに効かない（テキストのみ対応）
- Smooth Print は `filename` URL の拡張子 `.lbx` を検証する
- `.bin` ファイルよりインラインパラメータ（paperType等）の方が確実
- `URLSearchParams` は `:` `/` をエンコードしないので URL scheme には不適切

## 次回の引き継ぎ事項

### 要調査: QRスキャンページが動作しない
- **場所**: `/scan` ページ
- **症状**: QRコードスキャナーのカメラが起動しない、検索ボタンも機能しない
- **優先度**: 高（現場でQRスキャン → 樹木詳細を開くフローの中核機能）

### その他の残タスク
- オフライン印刷テスト: 事務所Wi-Fiでテンプレートキャッシュ後、機内モードでBluetooth印刷できるか確認
- ラベルレイアウトの微調整（P-touch Editorでフォントサイズ・配置を調整）

## 今日の変更ファイル

| ファイル | 内容 |
|---|---|
| `src/lib/smoothprint.ts` | URL scheme ビルダー（encodeURIComponent + インラインパラメータ） |
| `src/app/trees/[id]/page.tsx` | 印刷ボタンのデュアルモード（AirPrint/Bluetooth） |
| `src/app/api/label/[id]/route.ts` | **新規** QRデータ埋め込み .lbx 動的生成API |
| `public/print-templates/satoyama_label.lbx` | P-touch Editor テンプレート（102mm x 50mm） |
| `public/print-templates/rj4250_102x50.bin` | 用紙設定（結局インラインパラメータに切替で未使用） |

## 感情メモ
7つのバグを順番に潰していく泥臭いセッションだった。1つ直すと次の壁が出てくる。でも1つずつ確実に原因を特定して進んだ。最後にQRコードが正しいURLを返した時の達成感は格別。

---

## 編集者からの感想

「アルファベット1文字で3時間」— これは笑い話じゃなくて、**現場でモノを動かす人間だけが踏める地雷**の話だ。ドキュメントに書いてないことを、実機とエラーメッセージだけを頼りに7回立ち上がって突破した。これは開発力じゃなくて**突破力**。

### ここが素晴らしい！【言語化ポイント】
- **「もう疲れてきた」の後も「自信ある？」と確認しながら進んだ**: 疲れても投げずに、リスク判断を続けた。これは [[現場監督のメンタリティ]]
- **「出荷のことを考えると…これで合ってるのか」**: QRの飛び先を技術仕様ではなく **業務フローから逆算して判断** した。[[事業者の目線で技術を使う]]
- **事務員のBluetooth成功を切り分けの手がかりにした**: 自分だけで悩まず、チームの情報を即座に活用。[[現場の集合知]]

### 思考を深める「壁打ち」クエスチョン
今日7つの罠を全部 CLAUDE.md に残したけど、**事務員さんが1人でBluetooth印刷をセットアップする時のマニュアル**って必要じゃない？ Smooth Printの初回接続からラベル印刷までの手順書、誰が作る？

### コンテンツ化提案
- **案1（共感重視）**: 「Wi-Fiのない山で印刷したかっただけなのに — 7つの壁を越えたBluetooth印刷の記録」
- **案2（キャッチーさ重視）**: 「Brother Smooth Print URL scheme 完全攻略 — 公式ドキュメントに書いてない7つの罠」

### Obsidian推奨タグ
#BrotherPrinter #SmoothPrint #Bluetooth印刷 #PWA #デバッグ #URLscheme #里山プロジェクト #泥臭い開発 #現場DX
