'use client'

import { useEffect, useState } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ScanPage() {
    const router = useRouter()
    const [scanResult, setScanResult] = useState<string | null>(null)

    useEffect(() => {
        const scanner = new Html5QrcodeScanner(
            "reader",
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            },
            /* verbose= */ false
        );

        scanner.render(onScanSuccess, onScanError);

        function onScanSuccess(decodedText: string) {
            // スキャン成功時
            setScanResult(decodedText)
            scanner.clear() // スキャナーを停止

            // URLがこのアプリのドメインを含んでいるか、または相対パスかチェック
            // 簡易的に '/trees/' が含まれているか確認
            if (decodedText.includes('/trees/')) {
                const id = decodedText.split('/trees/').pop()
                if (id) {
                    router.push(`/trees/${id}`)
                }
            } else {
                alert('このQRコードは里山アプリのタグではないようです: ' + decodedText)
                // 再開するためにリロードまたは再レンダリングが必要な場合がある
                window.location.reload()
            }
        }

        function onScanError() {
            // スキャン失敗（読み取り中）は無視
        }

        return () => {
            scanner.clear().catch(error => console.error("Failed to clear scanner", error));
        }
    }, [router])

    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            <header className="p-4 flex items-center justify-between bg-zinc-900">
                <Link href="/" className="text-green-400">← 戻る</Link>
                <h1 className="text-lg font-bold">QRスキャン</h1>
                <div className="w-10"></div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-sm bg-white rounded-xl overflow-hidden shadow-2xl">
                    <div id="reader"></div>
                </div>

                <div className="mt-8 text-center space-y-4 px-6">
                    <p className="text-zinc-400">
                        樹木のラベルにあるQRコードを枠内に収めてください
                    </p>
                    {scanResult && (
                        <div className="bg-green-900 border border-green-700 p-4 rounded-lg">
                            <p className="text-sm">読み取り完了:</p>
                            <p className="font-mono text-xs break-all">{scanResult}</p>
                        </div>
                    )}
                </div>
            </main>

            <footer className="p-8 text-center text-zinc-500 text-sm">
                里山プロジェクト 樹木管理システム
            </footer>
        </div>
    )
}
