'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ScanPage() {
    const router = useRouter()
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const animFrameRef = useRef<number>(0)

    const [scanResult, setScanResult] = useState<string | null>(null)
    const [cameraError, setCameraError] = useState<string | null>(null)
    const [scanning, setScanning] = useState(true)
    const [showNumberSearch, setShowNumberSearch] = useState(false)
    const [managementNumber, setManagementNumber] = useState('')
    const [searching, setSearching] = useState(false)
    const [searchError, setSearchError] = useState<string | null>(null)

    // QR読み取り結果を処理
    const handleQrResult = useCallback((decodedText: string) => {
        setScanResult(decodedText)
        setScanning(false)

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (decodedText.includes('/trees/')) {
            const id = decodedText.split('/trees/').pop()
            if (id && uuidRegex.test(id)) {
                router.push(`/trees/${id}`)
            } else {
                alert('無効なQRコードです。正しい樹木タグをスキャンしてください。')
                setScanning(true)
                setScanResult(null)
            }
        } else {
            alert('このQRコードは里山アプリのタグではないようです')
            setScanning(true)
            setScanResult(null)
        }
    }, [router])

    // カメラ起動 + BarcodeDetector でスキャン
    useEffect(() => {
        if (!scanning) return

        let stopped = false
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let detector: any = null

        async function start() {
            // BarcodeDetector の存在チェック
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const BarcodeDetectorClass = (window as any).BarcodeDetector
            if (!BarcodeDetectorClass) {
                setCameraError('このブラウザはQRコード読み取りに対応していません。iOS 17.2以上 / Chrome 83以上が必要です。')
                return
            }

            try {
                detector = new BarcodeDetectorClass({ formats: ['qr_code'] })
            } catch {
                setCameraError('QRコードリーダーの初期化に失敗しました。')
                return
            }

            // カメラ起動
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                    audio: false,
                })

                if (stopped) {
                    stream.getTracks().forEach(t => t.stop())
                    return
                }

                streamRef.current = stream
                if (videoRef.current) {
                    videoRef.current.srcObject = stream
                    await videoRef.current.play()
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                if (msg.includes('NotAllowed') || msg.includes('Permission')) {
                    setCameraError('カメラへのアクセスが許可されていません。設定からカメラを許可してください。')
                } else {
                    setCameraError(`カメラの起動に失敗しました: ${msg}`)
                }
                return
            }

            // フレームスキャンループ
            async function scanFrame() {
                if (stopped || !videoRef.current || videoRef.current.readyState < 2) {
                    if (!stopped) animFrameRef.current = requestAnimationFrame(scanFrame)
                    return
                }

                try {
                    const barcodes = await detector.detect(videoRef.current)
                    if (barcodes.length > 0) {
                        handleQrResult(barcodes[0].rawValue)
                        return
                    }
                } catch {
                    // detect失敗は無視して次フレームへ
                }

                if (!stopped) {
                    animFrameRef.current = requestAnimationFrame(scanFrame)
                }
            }

            animFrameRef.current = requestAnimationFrame(scanFrame)
        }

        start()

        return () => {
            stopped = true
            cancelAnimationFrame(animFrameRef.current)
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop())
                streamRef.current = null
            }
        }
    }, [scanning, handleQrResult])

    // 管理番号で検索
    async function handleSearch() {
        const query = managementNumber.trim()
        if (!query) {
            setSearchError('検索キーワードを入力してください')
            return
        }

        setSearching(true)
        setSearchError(null)

        try {
            // オンラインでSupabase検索
            if (navigator.onLine) {
                const supabase = createClient()

                const { data: trees, error } = await supabase
                    .from('trees')
                    .select('id, management_number, tree_number')
                    .ilike('management_number', `%${query}%`)
                    .limit(5)

                if (error) {
                    setSearchError(`検索エラー: ${error.message}`)
                    setSearching(false)
                    return
                }

                if (trees && trees.length > 0) {
                    router.push(`/trees/${trees[0].id}`)
                    return
                }

                if (/^\d+$/.test(query)) {
                    const { data: numData } = await supabase
                        .from('trees')
                        .select('id')
                        .eq('tree_number', parseInt(query, 10))
                        .maybeSingle()

                    if (numData) {
                        router.push(`/trees/${numData.id}`)
                        return
                    }
                }
            }

            // オフライン時: IndexedDBキャッシュから検索
            try {
                const { db } = await import('@/lib/db')
                const cached = await db.trees.toArray()
                const upperQuery = query.toUpperCase()

                let found = cached.find(t =>
                    t.management_number?.toUpperCase().includes(upperQuery)
                )
                if (!found && /^\d+$/.test(query)) {
                    found = cached.find(t => t.tree_number === parseInt(query, 10))
                }
                if (found) {
                    router.push(`/trees/${found.id}`)
                    return
                }
            } catch {
                // IndexedDBが使えない場合は無視
            }

            setSearchError(`「${query}」に該当する樹木が見つかりません`)
        } catch (err) {
            setSearchError(`検索エラー: ${err instanceof Error ? err.message : '不明なエラー'}`)
        }
        setSearching(false)
    }

    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            <header className="p-4 flex items-center justify-between bg-zinc-900">
                <Link href="/" className="text-green-400">← 戻る</Link>
                <h1 className="text-lg font-bold">QRスキャン</h1>
                <div className="w-10"></div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-sm bg-black rounded-xl overflow-hidden shadow-2xl relative">
                    {/* カメラ映像 */}
                    <video
                        ref={videoRef}
                        className="w-full aspect-square object-cover"
                        playsInline
                        muted
                        autoPlay
                    />
                    {/* スキャン枠のオーバーレイ */}
                    {scanning && !cameraError && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-56 h-56 border-2 border-green-400 rounded-lg opacity-70" />
                        </div>
                    )}
                    {/* 非表示canvas（将来のフォールバック用） */}
                    <canvas ref={canvasRef} className="hidden" />

                    {cameraError && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
                            <p className="text-red-400 text-center font-bold">{cameraError}</p>
                        </div>
                    )}
                </div>

                <div className="mt-8 text-center space-y-4 px-6">
                    {scanning && !cameraError && (
                        <p className="text-zinc-400">
                            樹木のラベルにあるQRコードを枠内に収めてください
                        </p>
                    )}
                    {scanResult && (
                        <div className="bg-green-900 border border-green-700 p-4 rounded-lg">
                            <p className="text-sm">読み取り完了:</p>
                            <p className="font-mono text-xs break-all">{scanResult}</p>
                        </div>
                    )}

                    {/* 再スキャンボタン */}
                    {!scanning && (
                        <button
                            onClick={() => { setScanning(true); setScanResult(null); setCameraError(null) }}
                            className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-bold text-lg"
                        >
                            もう一度スキャン
                        </button>
                    )}

                    {/* 管理番号検索 */}
                    <div className="pt-6 border-t border-zinc-700">
                        <button
                            onClick={() => setShowNumberSearch(!showNumberSearch)}
                            className="text-green-400 font-bold"
                        >
                            {showNumberSearch ? '▲ 閉じる' : '▼ 番号で検索'}
                        </button>

                        {showNumberSearch && (
                            <div className="mt-4 space-y-3">
                                <input
                                    type="text"
                                    value={managementNumber}
                                    onChange={(e) => setManagementNumber(e.target.value)}
                                    placeholder="例: 26-AO-0001 または 1"
                                    className="w-full px-4 py-3 rounded-lg bg-white text-black text-lg font-mono text-center border-2 border-green-400"
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
                                />
                                <button
                                    type="button"
                                    onClick={handleSearch}
                                    disabled={searching}
                                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-500 py-3 rounded-lg font-bold text-lg"
                                >
                                    {searching ? '検索中...' : '検索'}
                                </button>
                                <p className="text-zinc-500 text-xs">
                                    管理番号（26-AO-0001）または通し番号（1）で検索
                                </p>
                                {searchError && (
                                    <p className="text-red-400 font-bold">{searchError}</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <footer className="p-8 text-center text-zinc-500 text-sm">
                里山プロジェクト 樹木管理システム
            </footer>
        </div>
    )
}
