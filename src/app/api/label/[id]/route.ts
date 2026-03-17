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
    // .lbx拡張子とキャッシュバスター(_timestamp)を除去してツリーIDを取得
    const treeId = rawId.replace(/\.lbx$/, '').replace(/_\d+$/, '')
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

        // --- レイアウト調整: 樹高・株立ち行を追加するため全体を詰める ---
        // SPECIES: y=8.5 h=30 (20pt font)
        labelXml = replacePositionByObjectName(
            labelXml, 'SPECIES',
            'x="9.3pt" y="8.5pt" width="124.8pt" height="30pt"'
        )
        labelXml = replaceFontSizeByObjectName(labelXml, 'SPECIES', '20pt')

        // MGMT_NUM: y=36 h=20 (14pt font)
        labelXml = replacePositionByObjectName(
            labelXml, 'MGMT_NUM',
            'x="13.8pt" y="36pt" width="210pt" height="20pt"'
        )
        labelXml = replaceFontSizeByObjectName(labelXml, 'MGMT_NUM', '14pt')

        // TREE_INFO (新規): y=54 h=18 (12pt font) — 樹高・株立ち
        const treeInfoXml = `<text:text><pt:objectStyle x="9.3pt" y="54pt" width="210pt" height="18pt" backColor="#FFFFFF" backPrintColorNumber="0" ropMode="COPYPEN" angle="0" anchor="TOPLEFT" flip="NONE"><pt:pen style="NULL" widthX="0.5pt" widthY="0.5pt" color="#000000" printColorNumber="1"></pt:pen><pt:brush style="NULL" color="#000000" printColorNumber="1" id="0"></pt:brush><pt:expanded objectName="TREE_INFO" ID="0" lock="0" templateMergeTarget="LABELLIST" templateMergeType="NONE" templateMergeID="0" allowOutOfBoundsTransfer="false" linkStatus="NONE" linkID="0"></pt:expanded></pt:objectStyle><text:ptFontInfo><text:logFont name="美杉ゴシックM" width="0" italic="false" weight="400" charSet="128" pitchAndFamily="49"></text:logFont><text:fontExt effect="NOEFFECT" underline="0" strikeout="0" size="12pt" orgSize="28.8pt" textColor="#000000" textPrintColorNumber="1"></text:fontExt></text:ptFontInfo><text:textControl control="FIXEDFRAME" clipFrame="false" aspectNormal="true" shrink="true" autoLF="false" avoidImage="false"></text:textControl><text:textAlign horizontalAlignment="LEFT" verticalAlignment="CENTER" inLineAlignment="BASELINE"></text:textAlign><text:textStyle vertical="false" nullBlock="false" charSpace="0" lineSpace="0" orgPoint="12pt" combinedChars="false"></text:textStyle><text:transferSettings editOnPrintFormat="" editOnPrintOrder="0"></text:transferSettings><pt:data></pt:data><text:stringItem charLen="0"><text:ptFontInfo><text:logFont name="美杉ゴシックM" width="0" italic="false" weight="400" charSet="128" pitchAndFamily="49"></text:logFont><text:fontExt effect="NOEFFECT" underline="0" strikeout="0" size="12pt" orgSize="28.8pt" textColor="#000000" textPrintColorNumber="1"></text:fontExt></text:ptFontInfo></text:stringItem></text:text>`
        // PRICE の直前に挿入
        const priceObjectIdx = labelXml.indexOf('objectName="PRICE"')
        if (priceObjectIdx !== -1) {
            // PRICEを含む<text:text>の開始位置を探す
            const beforePrice = labelXml.substring(0, priceObjectIdx)
            const priceTextStart = beforePrice.lastIndexOf('<text:text>')
            if (priceTextStart !== -1) {
                labelXml = labelXml.substring(0, priceTextStart) + treeInfoXml + labelXml.substring(priceTextStart)
            }
        }

        // PRICE: y=70 h=20 (14pt font)
        labelXml = replacePositionByObjectName(
            labelXml, 'PRICE',
            'x="9.3pt" y="70pt" width="210pt" height="20pt"'
        )
        labelXml = replaceFontSizeByObjectName(labelXml, 'PRICE', '14pt')

        // NOTES: y=88 h=20 (10pt font)
        labelXml = replacePositionByObjectName(
            labelXml, 'NOTES',
            'x="9.3pt" y="88pt" width="210pt" height="20pt"'
        )
        labelXml = replaceFontSizeByObjectName(labelXml, 'NOTES', '10pt')

        // --- QRサイズ縮小: 40pt角（太い木の曲面対策） ---
        labelXml = replacePositionByObjectName(
            labelXml, 'QR',
            'x="226pt" y="50pt" width="40pt" height="40pt"'
        )

        // --- QRセルサイズを粗く（凹凸面対策） ---
        labelXml = labelXml.replace(/cellSize="[^"]+"/, 'cellSize="3.5pt"')

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

/**
 * objectNameのテキストオブジェクト内のフォントサイズを一括置換
 */
function replaceFontSizeByObjectName(xml: string, objectName: string, newSize: string): string {
    const nameTag = `objectName="${objectName}"`
    const idx = xml.indexOf(nameTag)
    if (idx === -1) return xml

    // objectNameを含む </text:text> の終了位置を探す
    const endTag = '</text:text>'
    const endIdx = xml.indexOf(endTag, idx)
    if (endIdx === -1) return xml

    const before = xml.substring(0, idx)
    const section = xml.substring(idx, endIdx + endTag.length)
    const after = xml.substring(endIdx + endTag.length)

    // セクション内の size="XXpt" と orgPoint="XXpt" を置換
    const updated = section
        .replace(/size="[^"]+pt"/g, `size="${newSize}"`)
        .replace(/orgPoint="[^"]+pt"/g, `orgPoint="${newSize}"`)

    return before + updated + after
}

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}
