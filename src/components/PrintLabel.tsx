'use client'

import { QRCodeSVG } from 'qrcode.react'

export type LabelLayout = 'RJ-100' | 'PT-36' | 'PT-24'

interface PrintLabelProps {
    treeId: string
    treeNumber: number
    speciesName: string
    url: string
    price?: number
    managementNumber?: string | null
    layout?: LabelLayout
}

export default function PrintLabel({
    treeId,
    treeNumber,
    speciesName,
    url,
    price,
    managementNumber,
    layout = 'RJ-100'
}: PrintLabelProps) {
    if (layout === 'PT-36' || layout === 'PT-24') {
        // PTシリーズ（36mm or 24mm幅）用：羽ラベル（フラッグ）スタイル
        const heightMm = layout === 'PT-36' ? 36 : 24
        const qrSize = layout === 'PT-36' ? 80 : 55

        return (
            <div id="print-label" className="hidden print:block bg-white text-black font-sans">
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @media print {
                        @page {
                            size: auto;
                            margin: 0;
                        }
                        #print-label {
                            width: 150mm;
                            height: ${heightMm}mm;
                            padding: 2mm;
                            display: flex !important;
                            flex-direction: row;
                            align-items: center;
                            justify-content: space-between;
                        }
                    }
                `}} />

                {/* 左側：樹種名と番号 */}
                <div className="flex flex-col justify-center h-full pl-4 border-l-8 border-green-800">
                    {managementNumber && <div className={`${layout === 'PT-36' ? 'text-lg' : 'text-sm'} font-mono font-black`}>{managementNumber}</div>}
                    <div className={`${layout === 'PT-36' ? 'text-xl' : 'text-sm'} font-black leading-tight`}>{speciesName}</div>
                    {price && <div className={`${layout === 'PT-36' ? 'text-lg' : 'text-xs'} font-bold`}>¥{price.toLocaleString()}</div>}
                </div>

                {/* 右側：QRコード */}
                <div className="flex items-center pr-4">
                    <QRCodeSVG
                        value={url}
                        size={qrSize}
                        level="M"
                        includeMargin={false}
                    />
                </div>
            </div>
        )
    }

    // デフォルト：RJ-4250WB (100mm幅) 用：大判スタイル
    return (
        <div id="print-label" className="hidden print:block print:w-[101.6mm] print:h-[152.4mm] bg-white p-8 border-2 border-black">
            <div className="flex flex-col items-center justify-between h-full text-black">
                {/* 企業名・プロジェクト名 */}
                <div className="text-2xl font-bold border-b-4 border-black pb-2 w-full text-center">
                    里山プロジェクト
                </div>

                {/* 樹種名と番号 */}
                <div className="text-center space-y-1 my-4">
                    {managementNumber && <div className="text-3xl font-mono font-black">{managementNumber}</div>}
                    <div className="text-5xl font-bold">{speciesName}</div>
                    {price && <div className="text-2xl font-bold">¥{price.toLocaleString()}</div>}
                </div>

                {/* QRコード */}
                <div className="my-4">
                    <QRCodeSVG
                        value={url}
                        size={160}
                        level="H"
                        includeMargin={true}
                    />
                </div>

                {/* ID情報 */}
                <div className="text-sm font-mono mt-auto w-full text-right opacity-50">
                    ID: {treeId}
                </div>
            </div>
        </div>
    )
}
