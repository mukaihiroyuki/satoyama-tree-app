'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { logActivity } from '@/lib/activity-log'
import { playSuccess, playError } from '@/lib/sound'

interface Client {
    id: string
    name: string
}

interface TreeInfo {
    id: string
    management_number: string | null
    height: number
    trunk_count: number
    price: number
    status: string
    client_id: string | null
    species: { name: string } | { name: string }[] | null
}

interface ReservedTreeInfo {
    id: string
    management_number: string | null
    species_name: string
    height: number
    trunk_count: number
    price: number
    reserved_at: string
}

interface ReservationScanSession {
    clientId: string
    clientName: string
    reservedTreeIds: string[]
    reservedTrees: ReservedTreeInfo[]
    startedAt: string
}

const SESSION_KEY = 'reservation-scan-session'

function getSpeciesName(species: { name: string } | { name: string }[] | null): string {
    if (!species) return '不明'
    if (Array.isArray(species)) return species[0]?.name || '不明'
    return species.name
}

export default function ReservationScanPage() {
    const router = useRouter()
    const [phase, setPhase] = useState<'setup' | 'scanning'>('setup')
    const [clients, setClients] = useState<Client[]>([])
    const [selectedClientId, setSelectedClientId] = useState('')
    const [selectedClientName, setSelectedClientName] = useState('')
    const [loadingClients, setLoadingClients] = useState(true)
    const [reservedTrees, setReservedTrees] = useState<ReservedTreeInfo[]>([])
    const [existingSession, setExistingSession] = useState<ReservationScanSession | null>(null)

    // クライアント新規追加
    const [isAddingClient, setIsAddingClient] = useState(false)
    const [newClientName, setNewClientName] = useState('')
    const [addingClient, setAddingClient] = useState(false)

    // スキャン関連
    const [scanning, setScanning] = useState(false)
    const [lastScanned, setLastScanned] = useState<string | null>(null)
    const [scanError, setScanError] = useState<string | null>(null)
    const [pendingConfirm, setPendingConfirm] = useState<TreeInfo | null>(null)
    const [pendingOverride, setPendingOverride] = useState(false)
    const [savingReserve, setSavingReserve] = useState(false)

    // 手入力検索
    const [manualSearch, setManualSearch] = useState('')
    const [searching, setSearching] = useState(false)
    const [searchResults, setSearchResults] = useState<TreeInfo[] | null>(null)

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const scanningRef = useRef(false)
    const processingRef = useRef(false)
    const scanLoopRef = useRef<(() => void) | null>(null)
    const reservedTreeIdsRef = useRef<Set<string>>(new Set())

    // reservedTrees が更新されたら ref も同期
    useEffect(() => {
        reservedTreeIdsRef.current = new Set(reservedTrees.map(t => t.id))
    }, [reservedTrees])

    // セッション保存
    const saveSession = useCallback((clientId: string, clientName: string, trees: ReservedTreeInfo[]) => {
        const session: ReservationScanSession = {
            clientId,
            clientName,
            reservedTreeIds: trees.map(t => t.id),
            reservedTrees: trees,
            startedAt: existingSession?.startedAt || new Date().toISOString(),
        }
        localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    }, [existingSession?.startedAt])

    // 初期化: クライアント取得 + セッション復帰チェック
    useEffect(() => {
        async function init() {
            // セッション復帰チェック
            let savedSession: ReservationScanSession | null = null
            try {
                const saved = localStorage.getItem(SESSION_KEY)
                if (saved) {
                    savedSession = JSON.parse(saved) as ReservationScanSession
                    setExistingSession(savedSession)
                }
            } catch { /* ignore */ }

            // クライアント取得
            try {
                const supabase = createClient()
                const { data } = await supabase.from('clients').select('id, name').order('name')
                setClients(data || [])
                // 既存セッションがあればそのクライアントを選択、なければ未選択のまま（強制選択させる）
                if (savedSession) {
                    setSelectedClientId(savedSession.clientId)
                    setSelectedClientName(savedSession.clientName)
                }
            } catch {
                setScanError('クライアント情報を取得できませんでした')
            }
            setLoadingClients(false)
        }
        init()
    }, [])

    // クライアント選択変更時に名前を同期
    useEffect(() => {
        const client = clients.find(c => c.id === selectedClientId)
        if (client) setSelectedClientName(client.name)
    }, [selectedClientId, clients])

    // クライアント新規追加
    async function handleAddClient() {
        if (!newClientName.trim()) return
        setAddingClient(true)
        try {
            const supabase = createClient()
            const { data, error } = await supabase.from('clients').insert({ name: newClientName.trim() }).select().single()
            if (error) {
                alert('クライアント登録に失敗しました')
                return
            }
            if (data) {
                setClients(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
                setSelectedClientId(data.id)
                setSelectedClientName(data.name)
                setNewClientName('')
                setIsAddingClient(false)
            }
        } finally {
            setAddingClient(false)
        }
    }

    // セッション再開
    function resumeSession() {
        if (!existingSession) return
        setSelectedClientId(existingSession.clientId)
        setSelectedClientName(existingSession.clientName)
        setReservedTrees(existingSession.reservedTrees)
        setPhase('scanning')
    }

    // セッション開始
    function startSession() {
        if (!selectedClientId) {
            alert('クライアントを選択してください')
            return
        }
        setReservedTrees([])
        saveSession(selectedClientId, selectedClientName, [])
        setPhase('scanning')
    }

    // セッション完了
    function finishSession() {
        if (reservedTrees.length > 0 && !confirm(`${reservedTrees.length}本の予約済みリストをクリアして終了しますか？\n（予約自体は取り消されません）`)) return
        stopScanning()
        localStorage.removeItem(SESSION_KEY)
        router.push('/')
    }

    // --- QRスキャン処理 ---
    async function processQrCode(qrData: string) {
        if (processingRef.current) return
        processingRef.current = true

        try {
            const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
            const trimmed = qrData.trim()
            const uuidMatch = trimmed.match(uuidRegex)
            const treeId = uuidMatch ? uuidMatch[0] : null

            if (!treeId) {
                setScanError('QRコードを読み取れませんでした')
                playError()
                setTimeout(() => setScanError(null), 4000)
                return
            }

            // セッション内重複チェック
            if (reservedTreeIdsRef.current.has(treeId)) {
                setScanError('この木は既にスキャン済みです')
                playError()
                navigator.vibrate?.(200)
                setTimeout(() => setScanError(null), 2000)
                return
            }

            // Supabaseから樹木情報取得
            const supabase = createClient()
            const { data: tree, error } = await supabase
                .from('trees')
                .select('id, management_number, height, trunk_count, price, status, client_id, species:species_master(name)')
                .eq('id', treeId)
                .single()

            if (error || !tree) {
                // オフラインフォールバック
                try {
                    const { db } = await import('@/lib/db')
                    const cached = await db.trees.get(treeId)
                    if (cached) {
                        const treeInfo: TreeInfo = {
                            id: cached.id,
                            management_number: cached.management_number,
                            height: cached.height,
                            trunk_count: cached.trunk_count,
                            price: cached.price,
                            status: cached.status,
                            client_id: cached.client_id,
                            species: cached.species ? { name: cached.species.name } : null,
                        }
                        await handleTreeFound(treeInfo)
                        return
                    }
                } catch { /* IndexedDB unavailable */ }

                setScanError('この管理番号の樹木が見つかりません')
                playError()
                setTimeout(() => setScanError(null), 4000)
                return
            }

            await handleTreeFound(tree as unknown as TreeInfo)
        } finally {
            processingRef.current = false
        }
    }

    // 樹木情報取得後のステータスチェック
    async function handleTreeFound(tree: TreeInfo) {
        const status = tree.status

        if (status === 'shipped') {
            setScanError('この木は出荷済みです')
            playError()
            setTimeout(() => setScanError(null), 4000)
            return
        }
        if (status === 'dead' || status === 'disabled') {
            setScanError('この木は利用不可です')
            playError()
            setTimeout(() => setScanError(null), 4000)
            return
        }
        if (status === 'reserved' && tree.client_id === selectedClientId) {
            // 同じクライアントで既に予約済み → リストに追加（DB更新不要）
            if (!reservedTreeIdsRef.current.has(tree.id)) {
                const newItem: ReservedTreeInfo = {
                    id: tree.id,
                    management_number: tree.management_number,
                    species_name: getSpeciesName(tree.species),
                    height: tree.height,
                    trunk_count: tree.trunk_count,
                    price: tree.price,
                    reserved_at: new Date().toISOString(),
                }
                setReservedTrees(prev => {
                    const updated = [newItem, ...prev]
                    saveSession(selectedClientId, selectedClientName, updated)
                    return updated
                })
                setLastScanned(`${tree.management_number || '-'} (既に予約済み)`)
                playSuccess()
                navigator.vibrate?.([100, 50, 100])
                setTimeout(() => setLastScanned(null), 3000)
            }
            return
        }
        if (status === 'reserved' && tree.client_id !== selectedClientId) {
            // 別クライアントに予約済み → 上書き確認
            scanningRef.current = false
            setPendingConfirm(tree)
            setPendingOverride(true)
            playError()
            navigator.vibrate?.(500)
            return
        }

        // in_stock → 確認パネル表示
        scanningRef.current = false
        setScanError(null)
        navigator.vibrate?.([100, 50, 100])
        playSuccess()
        setPendingConfirm(tree)
        setPendingOverride(false)
    }

    // 確認 → 予約実行
    async function handleConfirmReserve() {
        if (!pendingConfirm) return
        setSavingReserve(true)

        const tree = pendingConfirm
        const now = new Date().toISOString()

        const newItem: ReservedTreeInfo = {
            id: tree.id,
            management_number: tree.management_number,
            species_name: getSpeciesName(tree.species),
            height: tree.height,
            trunk_count: tree.trunk_count,
            price: tree.price,
            reserved_at: now,
        }

        // Optimistic更新
        setReservedTrees(prev => {
            const updated = [newItem, ...prev]
            saveSession(selectedClientId, selectedClientName, updated)
            return updated
        })
        setLastScanned(`${tree.management_number || '-'} ${getSpeciesName(tree.species)}`)
        setPendingConfirm(null)
        setPendingOverride(false)
        setSavingReserve(false)

        // スキャン再開
        scanningRef.current = true
        resumeScanLoop()

        setTimeout(() => setLastScanned(null), 3000)

        // バックグラウンドSupabase書き込み
        const supabase = createClient()
        supabase
            .from('trees')
            .update({ status: 'reserved', client_id: selectedClientId })
            .eq('id', tree.id)
            .then(({ error }) => {
                if (error) console.error('[reservation-scan] reserve failed:', error)
            })

        logActivity('reserve', tree.id, {
            source: 'reservation-scan',
            client_id: selectedClientId,
        }).catch(() => {})
    }

    // 確認スキップ
    function handleDismissConfirm() {
        setPendingConfirm(null)
        setPendingOverride(false)
        scanningRef.current = true
        resumeScanLoop()
    }

    // 取消し（unreserve）
    async function handleUnreserve(treeId: string) {
        setReservedTrees(prev => {
            const updated = prev.filter(t => t.id !== treeId)
            saveSession(selectedClientId, selectedClientName, updated)
            return updated
        })

        const supabase = createClient()
        supabase
            .from('trees')
            .update({ status: 'in_stock', client_id: null })
            .eq('id', treeId)
            .then(({ error }) => {
                if (error) console.error('[reservation-scan] unreserve failed:', error)
            })

        logActivity('cancel_reserve', treeId, { source: 'reservation-scan' }).catch(() => {})
    }

    // --- 手入力検索 ---
    async function handleManualSearch() {
        const query = manualSearch.trim()
        if (!query) return

        setSearching(true)
        setSearchResults(null)
        setScanError(null)

        try {
            const supabase = createClient()
            // 数字のみ入力 → 末尾一致で検索（現場で「003」のように入力するケースが多い）
            const isNumberOnly = /^\d+$/.test(query)
            const pattern = isNumberOnly ? `%-${query}` : `%${query}%`
            const { data: trees, error } = await supabase
                .from('trees')
                .select('id, management_number, height, trunk_count, price, status, client_id, species:species_master(name)')
                .ilike('management_number', pattern)
                .order('management_number')
                .limit(20)

            if (error || !trees?.length) {
                // オフラインフォールバック
                try {
                    const { db } = await import('@/lib/db')
                    const cached = await db.trees.toArray()
                    const upperQuery = query.toUpperCase()
                    const found = cached.filter(t =>
                        t.management_number?.toUpperCase().includes(upperQuery)
                    ).slice(0, 10)
                    if (found.length > 0) {
                        const mapped: TreeInfo[] = found.map(t => ({
                            id: t.id,
                            management_number: t.management_number,
                            height: t.height,
                            trunk_count: t.trunk_count,
                            price: t.price,
                            status: t.status,
                            client_id: t.client_id,
                            species: t.species ? { name: t.species.name } : null,
                        }))
                        setSearchResults(mapped)
                        setSearching(false)
                        return
                    }
                } catch { /* ignore */ }

                setScanError(`「${query}」が見つかりません`)
                playError()
                setTimeout(() => setScanError(null), 4000)
                setSearching(false)
                return
            }

            if (trees.length === 1) {
                setManualSearch('')
                await handleTreeFound(trees[0] as unknown as TreeInfo)
            } else {
                setSearchResults(trees as unknown as TreeInfo[])
            }
        } catch {
            setScanError('検索エラーが発生しました')
            setTimeout(() => setScanError(null), 4000)
        }
        setSearching(false)
    }

    function handleSelectSearchResult(tree: TreeInfo) {
        setSearchResults(null)
        setManualSearch('')
        handleTreeFound(tree)
    }

    // --- スキャンループ再開 ---
    function resumeScanLoop() {
        if (scanLoopRef.current && scanningRef.current) {
            setTimeout(scanLoopRef.current, 200)
        }
    }

    // --- カメラ起動 ---
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

            if ('BarcodeDetector' in window) {
                const detector = new (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (source: HTMLCanvasElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector({ formats: ['qr_code'] })
                const canvas = document.createElement('canvas')
                const ctx = canvas.getContext('2d')!
                const scanLoop = async () => {
                    if (!videoRef.current || !scanningRef.current) return
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
                const { default: jsQR } = await import('jsqr')
                const canvas = document.createElement('canvas')
                const ctx = canvas.getContext('2d')!
                const scanLoop = () => {
                    if (!videoRef.current || !scanningRef.current) return
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

    // クリーンアップ
    useEffect(() => {
        return () => {
            scanningRef.current = false
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop())
            }
        }
    }, [])

    // ========== Phase 1: セットアップ ==========
    if (phase === 'setup') {
        return (
            <div className="min-h-screen bg-amber-50">
                <header className="bg-amber-600 text-white px-4 py-4 shadow-lg">
                    <div className="max-w-2xl mx-auto flex items-center justify-between">
                        <Link href="/" className="text-amber-200 font-bold">&larr; ホーム</Link>
                        <h1 className="text-lg font-black">予約スキャン</h1>
                        <div className="w-16" />
                    </div>
                </header>

                <main className="max-w-2xl mx-auto p-4 space-y-6">
                    {/* セッション復帰 */}
                    {existingSession && (
                        <div className="bg-amber-100 border-2 border-amber-400 rounded-xl p-5">
                            <p className="font-bold text-amber-800 mb-2">前回のセッションがあります</p>
                            <p className="text-sm text-amber-700">
                                クライアント: <strong>{existingSession.clientName}</strong><br />
                                予約済み: <strong>{existingSession.reservedTrees.length}本</strong><br />
                                開始: {new Date(existingSession.startedAt).toLocaleString('ja-JP')}
                            </p>
                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={() => {
                                        localStorage.removeItem(SESSION_KEY)
                                        setExistingSession(null)
                                    }}
                                    className="flex-1 py-3 border border-amber-400 rounded-xl font-bold text-amber-700 hover:bg-amber-200 transition-colors"
                                >
                                    破棄
                                </button>
                                <button
                                    onClick={resumeSession}
                                    className="flex-[2] bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-xl font-black text-lg shadow-lg transition-all active:scale-95"
                                >
                                    再開する
                                </button>
                            </div>
                        </div>
                    )}

                    {/* クライアント選択 */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-bold text-gray-800">クライアント選択</h2>
                            <button
                                onClick={() => setIsAddingClient(!isAddingClient)}
                                className="text-green-600 hover:text-green-700 text-sm font-bold"
                            >
                                {isAddingClient ? 'キャンセル' : '＋ 新規登録'}
                            </button>
                        </div>

                        {loadingClients ? (
                            <p className="text-gray-500">読み込み中...</p>
                        ) : isAddingClient ? (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newClientName}
                                    onChange={(e) => setNewClientName(e.target.value)}
                                    placeholder="会社名・氏名"
                                    className="flex-1 border border-green-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none"
                                    autoFocus
                                />
                                <button
                                    onClick={handleAddClient}
                                    disabled={addingClient || !newClientName.trim()}
                                    className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold disabled:bg-gray-400"
                                >
                                    {addingClient ? '...' : '保存'}
                                </button>
                            </div>
                        ) : (
                            <select
                                value={selectedClientId}
                                onChange={(e) => setSelectedClientId(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-3 text-lg focus:ring-2 focus:ring-amber-500 outline-none"
                            >
                                <option value="" disabled>選択してください</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* スキャン開始ボタン */}
                    <button
                        onClick={startSession}
                        disabled={!selectedClientId || loadingClients}
                        className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white py-5 rounded-xl font-black text-xl shadow-lg transition-all active:scale-95"
                    >
                        スキャン開始
                    </button>
                </main>
            </div>
        )
    }

    // ========== Phase 2: スキャン中 ==========
    return (
        <div className="min-h-screen bg-gray-900 text-white">
            {/* ヘッダー */}
            <header className="bg-amber-800 px-4 py-4">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <button onClick={() => { stopScanning(); setPhase('setup') }} className="text-amber-300 font-bold">
                        &larr; 戻る
                    </button>
                    <h1 className="text-lg font-black">予約スキャン中</h1>
                    <span className="text-sm text-amber-300 max-w-[120px] truncate">{selectedClientName}</span>
                </div>
            </header>

            {/* 予約カウント */}
            <div className="bg-amber-800 px-4 pb-4">
                <div className="max-w-2xl mx-auto">
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-3xl font-black">
                            {reservedTrees.length}<span className="text-lg text-amber-400">本 予約済み</span>
                        </span>
                    </div>
                </div>
            </div>

            <main className="max-w-2xl mx-auto p-4 space-y-4">
                {/* スキャンフィードバック */}
                {lastScanned && (
                    <div className="bg-amber-900/50 border border-amber-500 rounded-xl p-4 text-center animate-in fade-in duration-200">
                        <p className="text-amber-400 text-sm font-bold">予約完了</p>
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
                    <div className={`${pendingOverride ? 'bg-red-900/60 border-red-500' : 'bg-amber-900/60 border-amber-500'} border-2 rounded-xl p-5 animate-in fade-in duration-200`}>
                        <p className={`${pendingOverride ? 'text-red-400' : 'text-amber-400'} text-sm font-bold mb-3`}>
                            {pendingOverride ? '⚠️ 別のクライアントに予約済みです — 上書きしますか？' : 'スキャン読取り — 確認してください'}
                        </p>
                        <div className="bg-gray-800 rounded-lg p-4 mb-4">
                            <p className="text-white text-xl font-black">
                                {pendingConfirm.management_number || '-'}
                            </p>
                            <p className="text-gray-300 text-sm mt-1">
                                {getSpeciesName(pendingConfirm.species)}
                                {' / '}
                                {pendingConfirm.height}m
                                {' / '}
                                {pendingConfirm.trunk_count}本立ち
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleDismissConfirm}
                                className="flex-1 py-3 border border-gray-500 rounded-xl font-bold text-gray-300 hover:bg-gray-700 transition-colors"
                                disabled={savingReserve}
                            >
                                スキップ
                            </button>
                            <button
                                onClick={handleConfirmReserve}
                                disabled={savingReserve}
                                className={`flex-[2] ${pendingOverride ? 'bg-red-600 hover:bg-red-700 shadow-red-900' : 'bg-amber-600 hover:bg-amber-700 shadow-amber-900'} disabled:bg-gray-600 text-white py-3 rounded-xl font-black text-lg shadow-lg transition-all active:scale-95`}
                            >
                                {savingReserve ? '保存中...' : pendingOverride ? '上書き予約' : '予約する'}
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
                            <div className="w-48 h-48 border-2 border-amber-400/50 rounded-2xl" />
                        </div>
                        <button
                            onClick={stopScanning}
                            className="absolute top-3 right-3 bg-black/60 text-white px-3 py-1 rounded-lg text-sm font-bold"
                        >
                            カメラ停止
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={startScanning}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white py-4 rounded-xl font-black text-lg shadow-lg transition-all active:scale-95"
                    >
                        QRスキャン開始
                    </button>
                )}

                {/* 手入力検索 */}
                <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">管理番号で登録</h3>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={manualSearch}
                            onChange={e => setManualSearch(e.target.value)}
                            placeholder="例: 26-AO-0001"
                            className="flex-1 bg-gray-700 text-white rounded-lg px-3 py-3 text-lg font-mono placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            onKeyDown={e => { if (e.key === 'Enter') handleManualSearch() }}
                        />
                        <button
                            onClick={handleManualSearch}
                            disabled={searching || !manualSearch.trim()}
                            className="bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 text-white px-5 py-3 rounded-lg font-bold transition-colors"
                        >
                            {searching ? '...' : '検索'}
                        </button>
                    </div>

                    {/* 検索結果リスト */}
                    {searchResults && searchResults.length > 1 && (
                        <div className="space-y-1">
                            <p className="text-xs text-gray-500">{searchResults.length}件ヒット — タップで選択</p>
                            {searchResults.map(tree => (
                                <button
                                    key={tree.id}
                                    onClick={() => handleSelectSearchResult(tree)}
                                    className="w-full text-left bg-gray-700 hover:bg-gray-600 rounded-lg px-3 py-2 transition-colors"
                                >
                                    <span className="font-mono text-amber-400">{tree.management_number || '-'}</span>
                                    <span className="text-gray-400 text-sm ml-2">{getSpeciesName(tree.species)} / {tree.height}m</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* 予約済みリスト */}
                <div className="bg-gray-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-700 flex justify-between items-center">
                        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                            予約済みリスト ({reservedTrees.length}本)
                        </h2>
                    </div>
                    {reservedTrees.length === 0 ? (
                        <div className="px-4 py-8 text-center text-gray-600">
                            QRスキャンまたは管理番号で樹木を追加してください
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-700/50 max-h-[40vh] overflow-y-auto">
                            {reservedTrees.map(tree => (
                                <div key={tree.id} className="px-4 py-3 flex items-center gap-3">
                                    <span className="text-amber-500 text-xl">✅</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-mono text-sm text-amber-400">
                                            {tree.management_number || '-'}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {tree.species_name} / {tree.height}m / {tree.trunk_count}本立ち
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleUnreserve(tree.id)}
                                        className="text-red-500 hover:text-red-400 text-xs font-bold px-2 py-1 border border-red-800 rounded-lg"
                                    >
                                        取消
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* セッション完了ボタン */}
                <button
                    onClick={finishSession}
                    className="w-full py-3 border border-gray-600 rounded-xl font-bold text-gray-400 hover:text-white hover:border-gray-400 transition-colors"
                >
                    セッション完了 → ホームに戻る
                </button>
            </main>
        </div>
    )
}
