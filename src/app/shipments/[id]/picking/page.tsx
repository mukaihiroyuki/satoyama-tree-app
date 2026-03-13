'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { logActivity, logActivityBulk } from '@/lib/activity-log'
import { playSuccess, playError } from '@/lib/sound'

interface PickingItem {
    id: string
    picked_at: string | null
    tree: {
        id: string
        management_number: string | null
        height: number
        trunk_count: number
        species: { name: string } | null
    } | null
}

interface ShipmentInfo {
    id: string
    shipped_at: string
    picking_status: string
    client: { name: string } | { name: string }[] | null
    shipment_items: PickingItem[]
}

export default function PickingPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params)
    const router = useRouter()
    const [shipment, setShipment] = useState<ShipmentInfo | null>(null)
    const [loading, setLoading] = useState(true)
    const [scanning, setScanning] = useState(false)
    const [lastScanned, setLastScanned] = useState<string | null>(null)
    const [scanError, setScanError] = useState<string | null>(null)
    const [confirming, setConfirming] = useState(false)
    const [pendingConfirm, setPendingConfirm] = useState<PickingItem | null>(null)
    const [savingPick, setSavingPick] = useState(false)
    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const scanningRef = useRef(false)
    const processingRef = useRef(false)
    const shipmentRef = useRef<ShipmentInfo | null>(null)
    const scanLoopRef = useRef<(() => void) | null>(null)

    // shipmentが更新されたらrefも同期（スキャンループが常に最新を参照）
    useEffect(() => {
        shipmentRef.current = shipment
    }, [shipment])

    async function fetchShipment() {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('shipments')
            .select(`
                id, shipped_at, picking_status,
                client:clients(name),
                shipment_items(
                    id, picked_at,
                    tree:trees(id, management_number, height, trunk_count, species:species_master(name))
                )
            `)
            .eq('id', id)
            .single()
        if (error) {
            console.error('Picking fetch error:', error)
            setScanError(`データ取得エラー: ${error.message}`)
        }
        setShipment(data as ShipmentInfo | null)
        setLoading(false)
    }

    useEffect(() => {
        fetchShipment()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])

    const pickedCount = shipment?.shipment_items.filter(i => i.picked_at).length || 0
    const totalCount = shipment?.shipment_items.length || 0
    const allPicked = pickedCount === totalCount && totalCount > 0

    // QRスキャン処理: スキャン → 一時停止 → 確認パネル表示
    async function processQrCode(qrData: string) {
        const currentShipment = shipmentRef.current
        if (!currentShipment) return
        if (processingRef.current) return
        processingRef.current = true

        try {
            // QRからtree IDを抽出（URLの末尾がID）
            const treeId = qrData.includes('/trees/')
                ? qrData.split('/trees/').pop()?.split('?')[0]
                : qrData

            if (!treeId) {
                setScanError('QRコードを読み取れませんでした')
                playError()
                setTimeout(() => setScanError(null), 4000)
                return
            }

            // この出荷に含まれている木か確認（ローカル完結）
            const item = currentShipment.shipment_items.find(i => i.tree?.id === treeId)
            if (!item) {
                setScanError('この木はこの出荷の対象ではありません')
                logActivity('scan_error', treeId, {
                    reason: 'not_in_shipment',
                    scanned_id: treeId,
                    shipment_id: currentShipment.id,
                }).catch(() => {})
                navigator.vibrate?.(500)
                playError()
                setTimeout(() => setScanError(null), 4000)
                return
            }

            if (item.picked_at) {
                setScanError('この木は既にスキャン済みです')
                navigator.vibrate?.(200)
                playError()
                setTimeout(() => setScanError(null), 2000)
                return
            }

            // スキャン一時停止 → 確認パネル表示
            scanningRef.current = false
            setScanError(null)
            navigator.vibrate?.([100, 50, 100])
            playSuccess()
            setPendingConfirm(item)
        } finally {
            processingRef.current = false
        }
    }

    // 確認ボタン押下: 楽観的更新 + Supabaseバックグラウンド書き込み
    async function handleConfirmPick() {
        if (!pendingConfirm || !shipment) return
        setSavingPick(true)

        const item = pendingConfirm
        const now = new Date().toISOString()
        const speciesName = item.tree?.species
            ? (Array.isArray(item.tree.species) ? item.tree.species[0]?.name : item.tree.species.name)
            : '不明'

        // ローカルstate即時更新
        setShipment(prev => {
            if (!prev) return prev
            return {
                ...prev,
                picking_status: prev.picking_status === 'pending' ? 'in_progress' : prev.picking_status,
                shipment_items: prev.shipment_items.map(i =>
                    i.id === item.id ? { ...i, picked_at: now } : i
                ),
            }
        })

        setLastScanned(`${item.tree?.management_number || '-'} ${speciesName}`)
        setPendingConfirm(null)
        setSavingPick(false)

        // スキャン再開
        scanningRef.current = true
        resumeScanLoop()

        // Supabase更新はバックグラウンド
        const supabase = createClient()
        supabase
            .from('shipment_items')
            .update({ picked_at: now })
            .eq('id', item.id)
            .then(({ error }) => {
                if (error) console.error('[picking] picked_at update failed:', error)
            })

        if (shipment.picking_status === 'pending') {
            supabase
                .from('shipments')
                .update({ picking_status: 'in_progress' })
                .eq('id', shipment.id)
                .then(({ error }) => {
                    if (error) console.error('[picking] status update failed:', error)
                })
        }
    }

    // 確認スキップ: スキャン再開のみ
    function handleDismissConfirm() {
        setPendingConfirm(null)
        scanningRef.current = true
        resumeScanLoop()
    }

    // スキャンループ再開（確認後にカメラを止めずに再開）
    function resumeScanLoop() {
        if (scanLoopRef.current && scanningRef.current) {
            setTimeout(scanLoopRef.current, 200)
        }
    }

    // カメラ起動
    async function startScanning() {
        setScanning(true)
        scanningRef.current = true
        setScanError(null)
        setLastScanned(null)

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    // @ts-expect-error -- focusMode は標準仕様だがTypeScript型定義に未反映
                    focusMode: { ideal: 'continuous' },
                }
            })
            streamRef.current = stream
            if (videoRef.current) {
                videoRef.current.srcObject = stream
                videoRef.current.play()
            }

            // BarcodeDetector or jsQR fallback
            if ('BarcodeDetector' in window) {
                const detector = new (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (source: HTMLVideoElement | HTMLCanvasElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector({ formats: ['qr_code'] })
                const canvas = document.createElement('canvas')
                const ctx = canvas.getContext('2d')!
                const scanLoop = async () => {
                    if (!videoRef.current) return
                    if (!scanningRef.current) return // 一時停止中はループ停止
                    if (!processingRef.current) {
                        try {
                            const video = videoRef.current
                            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                                const vw = video.videoWidth
                                const vh = video.videoHeight
                                const cropW = Math.round(vw * 0.6)
                                const cropH = Math.round(vh * 0.6)
                                const cropX = Math.round((vw - cropW) / 2)
                                const cropY = Math.round((vh - cropH) / 2)
                                canvas.width = cropW
                                canvas.height = cropH
                                ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)
                                const barcodes = await detector.detect(canvas)
                                if (barcodes.length > 0) {
                                    await processQrCode(barcodes[0].rawValue)
                                }
                            }
                        } catch { /* ignore */ }
                    }
                    if (scanningRef.current) setTimeout(scanLoop, 200)
                }
                scanLoopRef.current = scanLoop
                setTimeout(scanLoop, 200)
            } else {
                // jsQR fallback (iOS PWA等)
                const { default: jsQR } = await import('jsqr')
                const canvas = document.createElement('canvas')
                const ctx = canvas.getContext('2d')!
                const scanLoop = () => {
                    if (!videoRef.current) return
                    if (!scanningRef.current) return // 一時停止中はループ停止
                    if (!processingRef.current) {
                        const video = videoRef.current
                        if (video.readyState === video.HAVE_ENOUGH_DATA) {
                            const vw = video.videoWidth
                            const vh = video.videoHeight
                            const cropW = Math.round(vw * 0.6)
                            const cropH = Math.round(vh * 0.6)
                            const cropX = Math.round((vw - cropW) / 2)
                            const cropY = Math.round((vh - cropH) / 2)
                            canvas.width = cropW
                            canvas.height = cropH
                            ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)
                            const imageData = ctx.getImageData(0, 0, cropW, cropH)
                            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                                inversionAttempts: 'dontInvert',
                            })
                            if (code) {
                                processQrCode(code.data)
                            }
                        }
                    }
                    if (scanningRef.current) setTimeout(scanLoop, 200)
                }
                scanLoopRef.current = scanLoop
                setTimeout(scanLoop, 200)
            }
        } catch {
            setScanError('カメラを起動できませんでした')
            setScanning(false)
        }
    }

    function stopScanning() {
        scanningRef.current = false
        scanLoopRef.current = null
        setScanning(false)
        setPendingConfirm(null)
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop())
            streamRef.current = null
        }
    }

    // 出荷確定
    async function handleConfirm() {
        if (!shipment || !allPicked) return
        if (!confirm('全てのピッキングが完了しました。出荷を確定しますか？')) return

        setConfirming(true)
        try {
            const supabase = createClient()
            const { error } = await supabase
                .from('shipments')
                .update({ picking_status: 'completed' })
                .eq('id', shipment.id)

            if (error) {
                alert('出荷確定に失敗しました')
                return
            }

            const treeIds = shipment.shipment_items
                .map(i => i.tree?.id)
                .filter((id): id is string => !!id)
            await logActivityBulk('ship', treeIds, { picking: 'confirmed' })

            stopScanning()
            router.push(`/shipments/${shipment.id}`)
        } finally {
            setConfirming(false)
        }
    }

    // ピッキングスキップ（少量時）
    async function handleSkipPicking() {
        if (!shipment) return
        if (!confirm('ピッキングをスキップして出荷確定しますか？')) return

        setConfirming(true)
        try {
            const supabase = createClient()
            const now = new Date().toISOString()

            // 全明細をpicked_at設定
            for (const item of shipment.shipment_items) {
                if (!item.picked_at) {
                    await supabase
                        .from('shipment_items')
                        .update({ picked_at: now })
                        .eq('id', item.id)
                }
            }

            await supabase
                .from('shipments')
                .update({ picking_status: 'completed' })
                .eq('id', shipment.id)

            router.push(`/shipments/${shipment.id}`)
        } finally {
            setConfirming(false)
        }
    }

    useEffect(() => {
        return () => {
            scanningRef.current = false
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop())
            }
        }
    }, [])

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <p className="text-white">読み込み中...</p>
            </div>
        )
    }

    if (!shipment) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <p className="text-white">出荷データが見つかりません</p>
            </div>
        )
    }

    const clientName = Array.isArray(shipment.client) ? shipment.client[0]?.name : shipment.client?.name || '不明'

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            {/* ヘッダー */}
            <header className="bg-gray-800 px-4 py-4">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <Link href={`/shipments/${shipment.id}`} className="text-blue-400" onClick={stopScanning}>
                        &larr; 戻る
                    </Link>
                    <h1 className="text-lg font-bold">ピッキング</h1>
                    <span className="text-sm text-gray-400">{clientName}</span>
                </div>
            </header>

            {/* 進捗バー */}
            <div className="bg-gray-800 px-4 pb-4">
                <div className="max-w-2xl mx-auto">
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-3xl font-black">
                            {pickedCount}<span className="text-lg text-gray-400">/{totalCount}</span>
                        </span>
                        <span className="text-sm text-gray-400">
                            {allPicked ? '全てスキャン完了' : 'スキャン中...'}
                        </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-3">
                        <div
                            className={`h-3 rounded-full transition-all duration-500 ${allPicked ? 'bg-green-500' : 'bg-blue-500'}`}
                            style={{ width: `${totalCount > 0 ? (pickedCount / totalCount) * 100 : 0}%` }}
                        />
                    </div>
                </div>
            </div>

            <main className="max-w-2xl mx-auto p-4 space-y-4">
                {/* スキャンフィードバック */}
                {lastScanned && (
                    <div className="bg-green-900/50 border border-green-500 rounded-xl p-4 text-center animate-in fade-in duration-200">
                        <p className="text-green-400 text-sm font-bold">スキャン完了</p>
                        <p className="text-white text-lg font-black mt-1">{lastScanned}</p>
                    </div>
                )}

                {scanError && (
                    <div className="bg-red-900/50 border border-red-500 rounded-xl p-4 text-center animate-in fade-in duration-200">
                        <p className="text-red-400 font-bold">{scanError}</p>
                    </div>
                )}

                {/* 確認パネル */}
                {pendingConfirm && (
                    <div className="bg-yellow-900/60 border-2 border-yellow-500 rounded-xl p-5 animate-in fade-in duration-200">
                        <p className="text-yellow-400 text-sm font-bold mb-3">スキャン読取り — 確認してください</p>
                        <div className="bg-gray-800 rounded-lg p-4 mb-4">
                            <p className="text-white text-xl font-black">
                                {pendingConfirm.tree?.management_number || '-'}
                            </p>
                            <p className="text-gray-300 text-sm mt-1">
                                {pendingConfirm.tree?.species
                                    ? (Array.isArray(pendingConfirm.tree.species) ? pendingConfirm.tree.species[0]?.name : pendingConfirm.tree.species.name)
                                    : '不明'}
                                {' / '}
                                {pendingConfirm.tree?.height}m
                                {' / '}
                                {pendingConfirm.tree?.trunk_count}本立ち
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleDismissConfirm}
                                className="flex-1 py-3 border border-gray-500 rounded-xl font-bold text-gray-300 hover:bg-gray-700 transition-colors"
                                disabled={savingPick}
                            >
                                スキップ
                            </button>
                            <button
                                onClick={handleConfirmPick}
                                disabled={savingPick}
                                className="flex-[2] bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-3 rounded-xl font-black text-lg shadow-lg shadow-green-900 transition-all active:scale-95"
                            >
                                {savingPick ? '保存中...' : '確定'}
                            </button>
                        </div>
                    </div>
                )}

                {/* カメラ */}
                {scanning ? (
                    <div className="relative">
                        <video
                            ref={videoRef}
                            className="w-full rounded-xl bg-black aspect-[4/3] object-cover"
                            playsInline
                            muted
                        />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-48 h-48 border-2 border-white/50 rounded-2xl" />
                        </div>
                        <button
                            onClick={stopScanning}
                            className="absolute top-3 right-3 bg-black/60 text-white px-3 py-1 rounded-lg text-sm font-bold"
                        >
                            カメラ停止
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {!allPicked && (
                            <button
                                onClick={startScanning}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-black text-lg shadow-lg transition-all active:scale-95"
                            >
                                QRスキャン開始
                            </button>
                        )}
                        {allPicked && (
                            <button
                                onClick={handleConfirm}
                                disabled={confirming}
                                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-4 rounded-xl font-black text-lg shadow-lg transition-all active:scale-95"
                            >
                                {confirming ? '確定処理中...' : '出荷確定'}
                            </button>
                        )}
                        {!allPicked && (
                            <button
                                onClick={handleSkipPicking}
                                disabled={confirming}
                                className="w-full text-gray-500 hover:text-gray-300 disabled:text-gray-700 py-2 text-sm font-bold"
                            >
                                {confirming ? '確定処理中...' : 'ピッキングをスキップして出荷確定'}
                            </button>
                        )}
                    </div>
                )}

                {/* チェックリスト */}
                <div className="bg-gray-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-700">
                        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">チェックリスト</h2>
                    </div>
                    <div className="divide-y divide-gray-700/50">
                        {shipment.shipment_items.map(item => {
                            const picked = !!item.picked_at
                            const speciesName = item.tree?.species
                                ? (Array.isArray(item.tree.species) ? item.tree.species[0]?.name : item.tree.species.name)
                                : '不明'
                            return (
                                <div
                                    key={item.id}
                                    className={`px-4 py-3 flex items-center gap-3 ${picked ? 'bg-green-900/20' : ''}`}
                                >
                                    <span className={`text-xl ${picked ? 'text-green-500' : 'text-gray-600'}`}>
                                        {picked ? '✅' : '⬜'}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className={`font-mono text-sm ${picked ? 'text-green-400' : 'text-gray-300'}`}>
                                            {item.tree?.management_number || '-'}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {speciesName} / {item.tree?.height}m / {item.tree?.trunk_count}本立ち
                                        </p>
                                    </div>
                                    {picked && item.picked_at && (
                                        <span className="text-xs text-gray-600">
                                            {new Date(item.picked_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </main>
        </div>
    )
}
