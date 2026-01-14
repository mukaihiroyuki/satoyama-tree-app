'use client'

import { QRCodeSVG } from 'qrcode.react'

interface PrintLabelProps {
    treeId: string
    treeNumber: number
    speciesName: string
    url: string
}

export default function PrintLabel({ treeId, treeNumber, speciesName, url }: PrintLabelProps) {
    return (
        <div id="print-label" className="hidden print:block print:w-[101.6mm] print:h-[152.4mm] bg-white p-8 border-2 border-black">
            <div className="flex flex-col items-center justify-between h-full text-black">
                {/* 企業名・プロジェクト名 */}
                <div className="text-2xl font-bold border-b-4 border-black pb-2 w-full text-center">
                    里山プロジェクト
                </div>

                {/* 樹種名と番号 */}
                <div className="text-center space-y-4 my-8">
                    <div className="text-4xl font-black">#{treeNumber}</div>
                    <div className="text-5xl font-bold">{speciesName}</div>
                </div>

                {/* QRコード */}
                <div className="my-4">
                    <QRCodeSVG
                        value={url}
                        size={250}
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
