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
 */
export function buildSmoothPrintUrl(
    data: TreeLabelData,
    baseUrl: string,
    copies: number = 1
): string {
    // テンプレートと用紙設定のURL（コロン・スラッシュ含めてエンコード）
    const templateUrl = `${baseUrl}${TEMPLATE_DIR}/${TEMPLATE_FILE}`
    const mediaUrl = `${baseUrl}${TEMPLATE_DIR}/${MEDIA_FILE}`

    const params = new URLSearchParams()

    // テンプレートファイル（HTTP URL をエンコード）
    params.set('filename', templateUrl)
    // 用紙情報ファイル（RJシリーズは .bin ファイル指定）
    params.set('size', mediaUrl)
    // 印刷部数
    params.set('copies', String(copies))

    // 動的テキストデータ（P-touch Editor のオブジェクト名と対応）
    params.set('text_SPECIES', data.species)
    params.set('text_PRICE', `¥${data.price.toLocaleString()}`)

    if (data.managementNumber) {
        params.set('text_MGMT_NUM', data.managementNumber)
    }

    // QRコード（バーコードオブジェクト）
    params.set('barcode_QRCODE', data.qrUrl)

    return `brotherwebprint://print?${params.toString()}`
}
