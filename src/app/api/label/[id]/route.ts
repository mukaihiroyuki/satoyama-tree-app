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
    // QRデータはIDのみ（短い = セル数が減る = 1粒が大きく = 曲面でも読みやすい）
    const qrData = treeId

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
            `$1${escapeXml(qrData)}$3`
        )

        // QRセルサイズを粗く（凹凸面・曲面対策）
        // テンプレートのサイズ・位置は .lbx 側で既に調整済み
        labelXml = labelXml.replace(
            /cellSize="[^"]+"/,
            'cellSize="3.5pt"'
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
