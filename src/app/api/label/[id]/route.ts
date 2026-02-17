import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import AdmZip from 'adm-zip'

/**
 * QRコードデータを埋め込んだ .lbx テンプレートを動的に生成
 *
 * GET /api/label/[treeId]
 * → QR URL を baseUrl/trees/[treeId] として .lbx に埋め込み
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: rawId } = await params
    // .lbx 拡張子を除去してツリーIDを取得
    const treeId = rawId.replace(/\.lbx$/, '')
    // リクエストURLからベースURLを組み立て
    const baseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`
    const qrUrl = `${baseUrl}/trees/${treeId}`

    try {
        const templatePath = join(process.cwd(), 'public', 'print-templates', 'satoyama_label.lbx')
        const templateBuffer = await readFile(templatePath)

        const zip = new AdmZip(templateBuffer)
        const labelEntry = zip.getEntry('label.xml')
        if (!labelEntry) {
            return NextResponse.json({ error: 'Invalid template' }, { status: 500 })
        }

        let labelXml = labelEntry.getData().toString('utf8')

        // QRコードデータを埋め込み
        labelXml = labelXml.replace(
            /(<barcode:barcode>[\s\S]*?<pt:data>)([\s\S]*?)(<\/pt:data>)/,
            `$1${escapeXml(qrUrl)}$3`
        )

        // QRコードサイズ縮小: 62.1pt → 40pt（太い木の曲面対策）
        labelXml = labelXml.replace(
            /x="147.7pt" y="39.9pt" width="62.1pt" height="62.1pt"/,
            'x="158pt" y="50pt" width="40pt" height="40pt"'
        )
        labelXml = labelXml.replace(
            /cellSize="2.4pt"/,
            'cellSize="1.5pt"'
        )

        // テキスト行間を詰める
        // SPECIES: height 48.5→38
        labelXml = labelXml.replace(
            /x="9.3pt" y="8.5pt" width="124.8pt" height="48.5pt"/,
            'x="9.3pt" y="8.5pt" width="124.8pt" height="38pt"'
        )
        // MGMT_NUM: y 48.5→42, height 44.9→35
        labelXml = labelXml.replace(
            /x="13.8pt" y="48.5pt" width="279.4pt" height="44.9pt"/,
            'x="13.8pt" y="42pt" width="279.4pt" height="35pt"'
        )
        // PRICE: y 93.4→74, height 38.8→32
        labelXml = labelXml.replace(
            /x="9.3pt" y="93.4pt" width="279.4pt" height="38.8pt"/,
            'x="9.3pt" y="74pt" width="279.4pt" height="32pt"'
        )

        zip.updateFile('label.xml', Buffer.from(labelXml, 'utf8'))
        const outputBuffer = zip.toBuffer()

        return new NextResponse(new Uint8Array(outputBuffer), {
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': 'attachment; filename="label.lbx"',
                'Cache-Control': 'no-cache',
            },
        })
    } catch (error) {
        console.error('Label generation error:', error)
        return NextResponse.json({ error: 'Template generation failed' }, { status: 500 })
    }
}

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}
