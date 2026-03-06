'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ClientInfo {
    id: string
    name: string
    portal_enabled: boolean
    portal_show_price: boolean
    portal_password: string | null
}

interface DeliveredTree {
    shipment_item_id: string
    tree_id: string
    management_number: string | null
    species_name: string
    height: number
    trunk_count: number
    unit_price: number
    shipped_at: string
    received: boolean
    notes: string | null
}

export default function ClientPortalPage({ params }: { params: Promise<{ clientId: string }> }) {
    const { clientId } = React.use(params)
    const [client, setClient] = useState<ClientInfo | null>(null)
    const [trees, setTrees] = useState<DeliveredTree[]>([])
    const [loading, setLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)
    const [authenticated, setAuthenticated] = useState(false)
    const [pinInput, setPinInput] = useState('')
    const [pinError, setPinError] = useState(false)
    const [scanning, setScanning] = useState(false)
    const [scanFeedback, setScanFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
    const [receiptCompleted, setReceiptCompleted] = useState<string | null>(null) // timestamptz or null
    const [shipmentIds, setShipmentIds] = useState<string[]>([])
    const [completing, setCompleting] = useState(false)
    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const scanningRef = useRef(false)
    const processingRef = useRef(false)

    async function fetchData() {
        const supabase = createClient()

        // クライアント情報
        const { data: clientData } = await supabase
            .from('clients')
            .select('id, name, portal_enabled, portal_show_price, portal_password')
            .eq('id', clientId)
            .single()

        if (!clientData || !clientData.portal_enabled) {
            setNotFound(true)
            setLoading(false)
            return
        }
        setClient(clientData)

        // パスワード認証チェック
        if (clientData.portal_password) {
            const sessionKey = `portal_auth_${clientId}`
            if (sessionStorage.getItem(sessionKey) === 'true') {
                setAuthenticated(true)
            }
        } else {
            setAuthenticated(true)
        }

        // 出荷済みの樹木を取得
        const { data: shipments } = await supabase
            .from('shipments')
            .select(`
                id,
                shipped_at,
                receipt_completed_at,
                shipment_items(
                    id, unit_price,
                    tree:trees(id, management_number, height, trunk_count, notes, species:species_master(name))
                )
            `)
            .eq('client_id', clientId)

        // 受入チェック済みのアイテムを取得
        const { data: receipts } = await supabase
            .from('client_receipts')
            .select('shipment_item_id')
            .eq('client_id', clientId)
        const receivedSet = new Set((receipts || []).map(r => r.shipment_item_id))

        // 受入完了状態と出荷IDを取得
        const ids: string[] = []
        let completed: string | null = null
        for (const shipment of shipments || []) {
            const s = shipment as unknown as { id: string; receipt_completed_at: string | null }
            ids.push(s.id)
            if (s.receipt_completed_at) completed = s.receipt_completed_at
        }
        setShipmentIds(ids)
        setReceiptCompleted(completed)

        // フラット化
        const allTrees: DeliveredTree[] = []
        for (const shipment of shipments || []) {
            for (const item of shipment.shipment_items || []) {
                const tree = item.tree as unknown as { id: string; management_number: string | null; height: number; trunk_count: number; notes: string | null; species: { name: string } | { name: string }[] | null } | null
                if (!tree) continue
                const speciesName = tree.species
                    ? (Array.isArray(tree.species) ? tree.species[0]?.name : tree.species.name) || '不明'
                    : '不明'
                allTrees.push({
                    shipment_item_id: item.id,
                    tree_id: tree.id,
                    management_number: tree.management_number,
                    species_name: speciesName,
                    height: tree.height,
                    trunk_count: tree.trunk_count,
                    unit_price: item.unit_price,
                    shipped_at: shipment.shipped_at,
                    received: receivedSet.has(item.id),
                    notes: tree.notes,
                })
            }
        }
        setTrees(allTrees)
        setLoading(false)
    }

    useEffect(() => {
        fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientId])

    // QRスキャンで受入チェック
    const processQrCode = useCallback(async (qrData: string) => {
        // 多重実行防止
        if (processingRef.current) return
        processingRef.current = true

        try {
            const treeId = qrData.includes('/trees/')
                ? qrData.split('/trees/').pop()?.split('?')[0]
                : qrData

            if (!treeId) {
                setScanFeedback({ type: 'error', message: 'QRを読み取れませんでした' })
                return
            }

            const item = trees.find(t => t.tree_id === treeId)
            if (!item) {
                setScanFeedback({ type: 'error', message: 'この樹木は納品対象ではありません' })
                setTimeout(() => setScanFeedback(null), 3000)
                return
            }
            if (item.received) {
                setScanFeedback({ type: 'error', message: '既に受入チェック済みです' })
                setTimeout(() => setScanFeedback(null), 2000)
                return
            }

            const supabase = createClient()
            const { error } = await supabase.from('client_receipts').insert({
                shipment_item_id: item.shipment_item_id,
                tree_id: item.tree_id,
                client_id: clientId,
            })

            if (error) {
                setScanFeedback({ type: 'error', message: '記録に失敗しました' })
                return
            }

            setScanFeedback({ type: 'success', message: `${item.management_number || '-'} ${item.species_name}` })
            await fetchData()
        } finally {
            // 次のスキャンまで少し待つ（連続読み取り防止）
            setTimeout(() => { processingRef.current = false }, 1500)
        }
    }, [trees, clientId])

    // カメラ
    async function startScanning() {
        setScanning(true)
        scanningRef.current = true
        setScanFeedback(null)
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            streamRef.current = stream
            if (videoRef.current) {
                videoRef.current.srcObject = stream
                videoRef.current.play()
            }
            if ('BarcodeDetector' in window) {
                const detector = new (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector({ formats: ['qr_code'] })
                const loop = async () => {
                    if (!scanningRef.current || !videoRef.current) return
                    try {
                        const barcodes = await detector.detect(videoRef.current)
                        if (barcodes.length > 0) await processQrCode(barcodes[0].rawValue)
                    } catch { /* ignore */ }
                    if (scanningRef.current) requestAnimationFrame(loop)
                }
                requestAnimationFrame(loop)
            } else {
                const { default: jsQR } = await import('jsqr')
                const canvas = document.createElement('canvas')
                const ctx = canvas.getContext('2d')!
                const loop = () => {
                    if (!scanningRef.current || !videoRef.current) return
                    const v = videoRef.current
                    if (v.readyState === v.HAVE_ENOUGH_DATA) {
                        canvas.width = v.videoWidth
                        canvas.height = v.videoHeight
                        ctx.drawImage(v, 0, 0)
                        const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
                        const code = jsQR(img.data, img.width, img.height)
                        if (code) processQrCode(code.data)
                    }
                    if (scanningRef.current) requestAnimationFrame(loop)
                }
                requestAnimationFrame(loop)
            }
        } catch {
            setScanFeedback({ type: 'error', message: 'カメラを起動できませんでした' })
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

    useEffect(() => {
        return () => {
            scanningRef.current = false
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
        }
    }, [])

    // CSVダウンロード
    function downloadCSV() {
        const headers = ['管理番号', '樹種', '樹高(m)', '本立ち', ...(client?.portal_show_price ? ['単価(円)'] : []), '出荷日', '受入', '備考']
        const rows = trees.map(t => [
            t.management_number || '-',
            t.species_name,
            String(t.height),
            String(t.trunk_count),
            ...(client?.portal_show_price ? [String(t.unit_price)] : []),
            t.shipped_at,
            t.received ? '済' : '未',
            t.notes || '',
        ])
        const bom = '\uFEFF'
        const csv = bom + [headers, ...rows].map(r => r.join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${client?.name || 'trees'}_納品リスト.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-500">読み込み中...</p>
            </div>
        )
    }

    if (notFound || !client) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-500">ページが見つかりません</p>
            </div>
        )
    }

    // パスワード認証画面
    if (!authenticated) {
        const handlePinSubmit = () => {
            if (pinInput === client.portal_password) {
                sessionStorage.setItem(`portal_auth_${clientId}`, 'true')
                setAuthenticated(true)
                setPinError(false)
            } else {
                setPinError(true)
                setPinInput('')
            }
        }
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="bg-white rounded-2xl shadow-lg p-8 w-80 text-center">
                    <div className="text-4xl mb-4">🔒</div>
                    <h1 className="text-lg font-bold text-gray-800 mb-1">{client.name}</h1>
                    <p className="text-sm text-gray-500 mb-6">アクセスコードを入力してください</p>
                    <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        value={pinInput}
                        onChange={(e) => {
                            setPinInput(e.target.value)
                            setPinError(false)
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handlePinSubmit()
                        }}
                        placeholder="----"
                        className={`w-full text-center text-2xl tracking-[0.5em] border-2 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                            pinError ? 'border-red-400 bg-red-50' : 'border-gray-300'
                        }`}
                        autoFocus
                    />
                    {pinError && (
                        <p className="text-red-500 text-sm mt-2 font-bold">コードが違います</p>
                    )}
                    <button
                        onClick={handlePinSubmit}
                        disabled={!pinInput}
                        className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white py-3 rounded-xl font-bold transition-colors"
                    >
                        開く
                    </button>
                </div>
            </div>
        )
    }

    // 受入完了処理
    async function handleCompleteReceipt() {
        const unchecked = trees.filter(t => !t.received).length
        const msg = unchecked > 0
            ? `${unchecked}本が未チェックです。このまま受入を完了しますか？`
            : '全ての樹木を確認しました。受入を完了しますか？'
        if (!confirm(msg)) return

        setCompleting(true)
        const supabase = createClient()
        const now = new Date().toISOString()
        for (const shipmentId of shipmentIds) {
            await supabase
                .from('shipments')
                .update({ receipt_completed_at: now })
                .eq('id', shipmentId)
        }
        setReceiptCompleted(now)
        setCompleting(false)
    }

    const receivedCount = trees.filter(t => t.received).length
    const totalCount = trees.length

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            <header className="bg-emerald-700 text-white px-4 py-6">
                <div className="max-w-3xl mx-auto">
                    <p className="text-emerald-200 text-xs font-bold uppercase tracking-wider">納品ポータル</p>
                    <h1 className="text-2xl font-black mt-1">{client.name}</h1>
                    <p className="text-emerald-200 text-sm mt-1">
                        {totalCount} 本納品 / {receivedCount} 本受入済み
                    </p>
                </div>
            </header>

            <main className="max-w-3xl mx-auto p-4 space-y-4">
                {/* 進捗バー */}
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex justify-between text-sm mb-2">
                        <span className="font-bold text-gray-700">受入チェック</span>
                        <span className="font-bold text-emerald-700">{receivedCount}/{totalCount}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                            className={`h-3 rounded-full transition-all ${receivedCount === totalCount && totalCount > 0 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                            style={{ width: `${totalCount > 0 ? (receivedCount / totalCount) * 100 : 0}%` }}
                        />
                    </div>
                </div>

                {/* 受入完了済みバナー */}
                {receiptCompleted && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                        <p className="text-emerald-700 font-bold text-lg">受入完了済み</p>
                        <p className="text-emerald-600 text-sm mt-1">
                            {new Date(receiptCompleted).toLocaleDateString('ja-JP')} に受入を完了しました
                        </p>
                    </div>
                )}

                {/* フィードバック */}
                {scanFeedback && (
                    <div className={`rounded-xl p-4 text-center font-bold ${
                        scanFeedback.type === 'success'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                        {scanFeedback.type === 'success' ? '受入OK: ' : ''}{scanFeedback.message}
                    </div>
                )}

                {/* スキャン / CSV */}
                {scanning ? (
                    <div className="relative">
                        <video ref={videoRef} className="w-full rounded-xl bg-black aspect-[4/3] object-cover" playsInline muted />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-48 h-48 border-2 border-white/50 rounded-2xl" />
                        </div>
                        <button
                            onClick={stopScanning}
                            className="absolute top-3 right-3 bg-black/60 text-white px-3 py-1 rounded-lg text-sm font-bold"
                        >
                            停止
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-3">
                        {receivedCount < totalCount && (
                            <button
                                onClick={startScanning}
                                className={`flex-1 py-3 rounded-xl font-bold shadow-lg transition-all active:scale-95 ${
                                    receiptCompleted
                                        ? 'bg-amber-500 hover:bg-amber-600 text-white'
                                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                }`}
                            >
                                {receiptCompleted ? '追加チェック' : 'QRスキャンで受入'}
                            </button>
                        )}
                        <button
                            onClick={downloadCSV}
                            className="bg-white border border-gray-300 text-gray-700 px-4 py-3 rounded-xl font-bold hover:bg-gray-50"
                        >
                            CSV
                        </button>
                    </div>
                )}

                {/* 受入完了ボタン */}
                {!receiptCompleted && totalCount > 0 && (
                    <button
                        onClick={handleCompleteReceipt}
                        disabled={completing}
                        className={`w-full py-3 rounded-xl font-bold transition-all active:scale-95 ${
                            receivedCount === totalCount
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg'
                                : 'bg-white border-2 border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        {completing ? '処理中...' : receivedCount === totalCount
                            ? '受入を完了する'
                            : `受入を完了する（${totalCount - receivedCount}本未チェック）`
                        }
                    </button>
                )}

                {/* 樹木リスト */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                        <h2 className="text-sm font-bold text-gray-500">納品リスト</h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {trees.map(t => (
                            <div
                                key={t.shipment_item_id}
                                className={`px-4 py-3 flex items-center gap-3 ${t.received ? 'bg-green-50/50' : ''}`}
                            >
                                <span className="text-lg">{t.received ? '✅' : '⬜'}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="font-mono text-sm font-bold text-gray-800">
                                        {t.management_number || '-'}
                                        <span className="font-sans text-gray-500 ml-2">{t.species_name}</span>
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {t.height}m / {t.trunk_count}本立ち
                                        {client.portal_show_price && (
                                            <span className="ml-2 text-gray-600 font-bold">&yen;{t.unit_price.toLocaleString()}</span>
                                        )}
                                        <span className="ml-2">出荷: {t.shipped_at}</span>
                                    </p>
                                    {t.notes && (
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {t.notes}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                        {trees.length === 0 && (
                            <div className="px-4 py-8 text-center text-gray-400">
                                まだ納品されたデータがありません
                            </div>
                        )}
                    </div>
                </div>

                <p className="text-center text-xs text-gray-400">
                    Powered by 里山樹木管理システム
                </p>
            </main>
        </div>
    )
}
