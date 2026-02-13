/**
 * Brother Smooth Print URL scheme ビルダー
 *
 * PWA から brotherwebprint:// URL scheme を呼び出し、
 * Smooth Print 経由で Bluetooth 印刷を実行する。
 *
 * 対象プリンター: Brother RJ-4250WB
 * ラベルサイズ: 102mm × 50mm
 *
 * @see https://support.brother.co.jp/j/s/support/html/smoothprint/
 */

export interface TreeLabelData {
    species: string
    price: number
    managementNumber: string | null
    qrUrl: string
}

const TEMPLATE_FILE = 'satoyama_label.lbx'
const MEDIA_FILE = 'rj4250_102x50.bin'
const TEMPLATE_DIR = '/print-templates'

/**
 * Smooth Print URL scheme を組み立てる
 *
 * Brother の仕様: パラメータ値は UTF-8 でエンコードし、
 * コロンやスラッシュを含めて URL エンコードする必要がある
 * ※ URLSearchParams は : / をエンコードしないため encodeURIComponent を使用
 */
export function buildSmoothPrintUrl(
    data: TreeLabelData,
    baseUrl: string,
    copies: number = 1
): string {
    const templateUrl = `${baseUrl}${TEMPLATE_DIR}/${TEMPLATE_FILE}`

    const parts: string[] = [
        `filename=${encodeURIComponent(templateUrl)}`,
        // 用紙情報をインラインパラメータで指定（.binファイル不要）
        `paperType=roll`,
        `tapeWidth=102`,
        `tapeLength=50`,
        `unit=mm`,
        `copies=${copies}`,
        `text_SPECIES=${encodeURIComponent(data.species)}`,
        `text_PRICE=${encodeURIComponent(`¥${data.price.toLocaleString()}`)}`,
    ]

    if (data.managementNumber) {
        parts.push(`text_MGMT_NUM=${encodeURIComponent(data.managementNumber)}`)
    }

    parts.push(`barcode_QR=${encodeURIComponent(data.qrUrl)}`)

    return `brotherwebprint://print?${parts.join('&')}`
}
