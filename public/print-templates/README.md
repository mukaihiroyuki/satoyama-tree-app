# Print Templates for Smooth Print

## Required Files

### satoyama_label.lbx
P-touch Editor で作成するラベルテンプレート。

**作成手順:**
1. P-touch Editor を起動
2. 用紙サイズ: 102mm x 152mm
3. 以下のオブジェクトを配置し、プロパティでオブジェクト名を設定:
   - `SPECIES` (テキスト): 樹種名 - 大きく中央に
   - `PRICE` (テキスト): 上代表示
   - `MGMT_NUM` (テキスト): 管理番号
   - `QRCODE` (バーコード → QRコード): 樹木詳細URL
4. ヘッダーに「里山プロジェクト」を固定テキストで配置
5. ファイル → 名前を付けて保存 → テンプレート(*.lbx) で保存

### rj4250_102x152.bin
Printer Setting Tool で作成する用紙設定ファイル。

**作成手順:**
1. Printer Setting Tool を起動
2. RJ-4250WB を選択
3. Paper Size Setup Tool で 102mm x 152mm を設定
4. 「コマンドファイルに保存」で .bin 出力
