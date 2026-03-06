'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { logActivityBulk } from '@/lib/activity-log'

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
    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const scanningRef = useRef(false)

    async function fetchShipment() {
        const supabase = createClient()
        const { data } = await supabase
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

    // QRスキャン処理
    const processQrCode = useCallback(async (qrData: string) => {
        if (!shipment) return

        // QRからtree IDを抽出（URLの末尾がID）
        const treeId = qrData.includes('/trees/')
            ? qrData.split('/trees/').pop()?.split('?')[0]
            : qrData

        if (!treeId) {
            setScanError('QRコードを読み取れませんでした')
            return
        }

        // この出荷に含まれている木か確認
        const item = shipment.shipment_items.find(i => i.tree?.id === treeId)
        if (!item) {
            setScanError('この木は出荷対象ではありません')
            setTimeout(() => setScanError(null), 3000)
            return
        }

        if (item.picked_at) {
            setScanError('この木は既にスキャン済みです')
            setTimeout(() => setScanError(null), 2000)
            return
        }

        // ピッキング済みにする
        const supabase = createClient()
        const { error } = await supabase
            .from('shipment_items')
            .update({ picked_at: new Date().toISOString() })
            .eq('id', item.id)

        if (error) {
            setScanError('記録に失敗しました')
            return
        }

        // ステータスをin_progressに（初回スキャン時）
        if (shipment.picking_status === 'pending') {
            await supabase
                .from('shipments')
                .update({ picking_status: 'in_progress' })
                .eq('id', shipment.id)
        }

        const speciesName = item.tree?.species
            ? (Array.isArray(item.tree.species) ? item.tree.species[0]?.name : item.tree.species.name)
            : '不明'
        setLastScanned(`${item.tree?.management_number || '-'} ${speciesName}`)
        setScanError(null)
        await fetchShipment()
    }, [shipment])

    // カメラ起動
    async function startScanning() {
        setScanning(true)
        scanningRef.current = true
        setScanError(null)
        setLastScanned(null)

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            })
            streamRef.current = stream
            if (videoRef.current) {
                videoRef.current.srcObject = stream
                videoRef.current.play()
            }

            // BarcodeDetector or jsQR fallback
            if ('BarcodeDetector' in window) {
                const detector = new (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector({ formats: ['qr_code'] })
                const scanLoop = async () => {
                    if (!scanningRef.current || !videoRef.current) return
                    try {
                        const barcodes = await detector.detect(videoRef.current)
                        if (barcodes.length > 0) {
                            await processQrCode(barcodes[0].rawValue)
                        }
                    } catch { /* ignore */ }
                    if (scanningRef.current) requestAnimationFrame(scanLoop)
                }
                requestAnimationFrame(scanLoop)
            } else {
                // jsQR fallback
                const { default: jsQR } = await import('jsqr')
                const canvas = document.createElement('canvas')
                const ctx = canvas.getContext('2d')!
                const scanLoop = () => {
                    if (!scanningRef.current || !videoRef.current) return
                    const video = videoRef.current
                    if (video.readyState === video.HAVE_ENOUGH_DATA) {
                        canvas.width = video.videoWidth
                        canvas.height = video.videoHeight
                        ctx.drawImage(video, 0, 0)
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
                        const code = jsQR(imageData.data, imageData.width, imageData.height)
                        if (code) {
                            processQrCode(code.data)
                        }
                    }
                    if (scanningRef.current) requestAnimationFrame(scanLoop)
                }
                requestAnimationFrame(scanLoop)
            }
        } catch {
            setScanError('カメラを起動できませんでした')
            setScanning(false)
        }
    }

    function stopScanning() {
        scanningRef.current = false
        setScanning(false)
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop())
            streamRef.current = null
        }
    }

    // 出荷確定
    async function handleConfirm() {
        if (!shipment || !allPicked) return
        if (!confirm('全てのピッキングが完了しました。出荷を確定しますか？')) return

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
    }

    // ピッキングスキップ（少量時）
    async function handleSkipPicking() {
        if (!shipment) return
        if (!confirm('ピッキングをスキップして出荷確定しますか？')) return

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
                                className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-black text-lg shadow-lg transition-all active:scale-95"
                            >
                                出荷確定
                            </button>
                        )}
                        {!allPicked && (
                            <button
                                onClick={handleSkipPicking}
                                className="w-full text-gray-500 hover:text-gray-300 py-2 text-sm font-bold"
                            >
                                ピッキングをスキップして出荷確定
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
