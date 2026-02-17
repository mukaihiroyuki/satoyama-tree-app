import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import AdmZip from 'adm-zip'

/**
 * QRコードデータを埋め込んだ .lbx テンプレートを動的に生成
 *
 * GET /api/label/[treeId]
 * → QRデータとしてtreeIdを埋め込み、レイアウトを動的に調整
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: rawId } = await params
    const treeId = rawId.replace(/\.lbx$/, '')
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

        // --- QRコードデータを埋め込み ---
        labelXml = labelXml.replace(
            /(<barcode:barcode>[\s\S]*?<pt:data>)([\s\S]*?)(<\/pt:data>)/,
            `$1${escapeXml(qrData)}$3`
        )

        // --- QRサイズ縮小: 40pt角（太い木の曲面対策） ---
        labelXml = replacePositionByObjectName(
            labelXml, 'QR',
            'x="158pt" y="50pt" width="40pt" height="40pt"'
        )

        // --- QRセルサイズを粗く（凹凸面対策） ---
        labelXml = labelXml.replace(/cellSize="[^"]+"/, 'cellSize="3.5pt"')

        // --- テキスト行間を詰める ---
        labelXml = replacePositionByObjectName(
            labelXml, 'SPECIES',
            'x="9.3pt" y="8.5pt" width="124.8pt" height="38pt"'
        )
        labelXml = replacePositionByObjectName(
            labelXml, 'MGMT_NUM',
            'x="13.8pt" y="42pt" width="279.4pt" height="35pt"'
        )
        labelXml = replacePositionByObjectName(
            labelXml, 'PRICE',
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

/**
 * objectNameから逆引きして、直前のx/y/width/height属性を差し替える
 * テンプレートの現在値に依存しない汎用ロジック
 */
function replacePositionByObjectName(xml: string, objectName: string, newPos: string): string {
    const nameTag = `objectName="${objectName}"`
    const idx = xml.indexOf(nameTag)
    if (idx === -1) return xml

    // objectNameより前の部分から、直近のx/y/width/height属性を探す
    const before = xml.substring(0, idx)
    const posRegex = /x="[^"]+" y="[^"]+" width="[^"]+" height="[^"]+"/g
    let lastMatch: RegExpExecArray | null = null
    let match: RegExpExecArray | null
    while ((match = posRegex.exec(before)) !== null) {
        lastMatch = match
    }

    if (!lastMatch) return xml

    return xml.substring(0, lastMatch.index) + newPos + xml.substring(lastMatch.index + lastMatch[0].length)
}

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}
