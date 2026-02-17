/**
 * Brother Smooth Print URL scheme ビルダー
 *
 * PWA から brotherwebprint:// URL scheme を呼び出し、
 * Smooth Print 経由で Bluetooth 印刷を実行する。
 *
 * 対象プリンター: Brother RJ-4250WB
 * ラベルサイズ: 102mm × 50mm
 *
 * QRコードは barcode_ パラメータが非対応のため、
 * /api/label/[treeId] で .lbx に直接埋め込んで返す方式を採用。
 *
 * @see https://support.brother.co.jp/j/s/support/html/smoothprint/
 */

export interface TreeLabelData {
    species: string
    price: number
    managementNumber: string | null
    treeId: string
}

/**
 * Smooth Print URL scheme を組み立てる
 *
 * テキストデータ: text_ パラメータで動的に渡す（Smooth Print対応）
 * QRコード: /api/label/[treeId] でテンプレートに埋め込み済み .lbx を生成
 */
export function buildSmoothPrintUrl(
    data: TreeLabelData,
    baseUrl: string,
    copies: number = 1
): string {
    // QRデータを埋め込んだテンプレートを動的生成（パスベースでクエリパラメータなし）
    // キャッシュバスター: Smooth Printが古い.lbxをキャッシュするため、パスにタイムスタンプを埋め込む
    const cacheBuster = Date.now()
    const templateUrl = `${baseUrl}/api/label/${data.treeId}_${cacheBuster}.lbx`

    const parts: string[] = [
        `filename=${encodeURIComponent(templateUrl)}`,
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

    return `brotherwebprint://print?${parts.join('&')}`
}
