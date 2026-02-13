import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import AdmZip from 'adm-zip'

/**
 * QRコードデータを埋め込んだ .lbx テンプレートを動的に生成する
 *
 * Smooth Print の barcode_ パラメータが QR コードに非対応のため、
 * テンプレート内の QR データを直接書き換えて返す。
 *
 * GET /api/label?qr=https://example.com/trees/uuid
 */
export async function GET(request: NextRequest) {
    const qrData = request.nextUrl.searchParams.get('qr')
    if (!qrData) {
        return NextResponse.json({ error: 'qr parameter required' }, { status: 400 })
    }

    try {
        // ベーステンプレートを読み込み
        const templatePath = join(process.cwd(), 'public', 'print-templates', 'satoyama_label.lbx')
        const templateBuffer = await readFile(templatePath)

        const zip = new AdmZip(templateBuffer)
        const labelEntry = zip.getEntry('label.xml')
        if (!labelEntry) {
            return NextResponse.json({ error: 'Invalid template' }, { status: 500 })
        }

        // QRコードのデータを置換
        let labelXml = labelEntry.getData().toString('utf8')
        // バーコードオブジェクト内の <pt:data>...</pt:data> を置換
        labelXml = labelXml.replace(
            /(<barcode:barcode>[\s\S]*?<pt:data>)([\s\S]*?)(<\/pt:data>)/,
            `$1${escapeXml(qrData)}$3`
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
