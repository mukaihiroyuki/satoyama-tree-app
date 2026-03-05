'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import ShipmentDialog from '@/components/ShipmentDialog'
import ReservationDialog from '@/components/ReservationDialog'
import EstimateDialog from '@/components/EstimateDialog'
import { createClient } from '@/lib/supabase/client'
import { useTrees } from '@/hooks/useTrees'

const statusLabels: Record<string, { label: string; color: string }> = {
    in_stock: { label: '在庫あり', color: 'bg-green-100 text-green-800' },
    reserved: { label: '予約済み', color: 'bg-yellow-100 text-yellow-800' },
    shipped: { label: '出荷済み', color: 'bg-blue-100 text-blue-800' },
    dead: { label: '枯死', color: 'bg-gray-100 text-gray-800' },
}

export default function TreesPage() {
    const { trees, species, locations, loading, isOnline, pendingCount, refreshData } = useTrees()

    // フィルター状態
    const [speciesFilter, setSpeciesFilter] = useState('')
    const [locationFilter, setLocationFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('in_stock')
    const [clientFilter, setClientFilter] = useState('')
    const [shippedAtFilter, setShippedAtFilter] = useState('')
    const [estimateNumberFilter, setEstimateNumberFilter] = useState('')

    // 選択状態
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [isShipmentDialogOpen, setIsShipmentDialogOpen] = useState(false)
    const [isReservationDialogOpen, setIsReservationDialogOpen] = useState(false)
    const [isEstimateDialogOpen, setIsEstimateDialogOpen] = useState(false)

    // 成功時のリフレッシュ
    const handleShipmentSuccess = () => {
        setSelectedIds([])
        refreshData()
    }

    // クライアント一覧をmemoize
    const clientNames = useMemo(() => {
        return [...new Set(
            trees.map(t => t.client?.name).filter(Boolean)
        )] as string[]
    }, [trees])

    // フィルタ適用
    const filteredTrees = useMemo(() => trees.filter(tree => {
        if (speciesFilter && tree.species?.name !== speciesFilter) return false
        if (locationFilter && tree.location !== locationFilter) return false
        if (statusFilter && tree.status !== statusFilter) return false
        if (clientFilter && tree.client?.name !== clientFilter) return false
        if (shippedAtFilter && tree.shipped_at !== shippedAtFilter) return false
        if (estimateNumberFilter && !(tree.estimate_number || '').includes(estimateNumberFilter)) return false
        return true
    }), [trees, speciesFilter, locationFilter, statusFilter, clientFilter, shippedAtFilter, estimateNumberFilter])

    // 選択操作
    const toggleSelectAll = () => {
        if (selectedIds.length === filteredTrees.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(filteredTrees.map(t => t.id))
        }
    }

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    const selectedTreesFiltered = trees.filter(t => selectedIds.includes(t.id))
    const selectedTreesData = selectedTreesFiltered.map(t => ({
        id: t.id,
        management_number: t.management_number,
        species_name: t.species?.name || '不明',
        price: t.price
    }))

    // 選択した木が全部同じクライアントならそのIDを取得
    const selectedClientIds = [...new Set(selectedTreesFiltered.map(t => t.client_id).filter(Boolean))]
    const commonClientId = selectedClientIds.length === 1 ? selectedClientIds[0] as string : undefined

    // 選択中の木のステータス判定
    const selectedStatuses = new Set(selectedTreesFiltered.map(t => t.status))
    const hasReserved = selectedStatuses.has('reserved')
    const hasShipped = selectedStatuses.has('shipped')

    // 予約取消
    async function handleCancelReservation() {
        const reservedIds = trees
            .filter(t => selectedIds.includes(t.id) && t.status === 'reserved')
            .map(t => t.id)
        if (reservedIds.length === 0) return
        if (!confirm(`${reservedIds.length} 本の予約を取り消して在庫に戻しますか？`)) return

        const supabase = createClient()
        const { error } = await supabase
            .from('trees')
            .update({ status: 'in_stock', client_id: null })
            .in('id', reservedIds)

        if (error) {
            console.error('予約取消エラー:', error)
            alert('予約取消に失敗しました')
            return
        }
        setSelectedIds([])
        refreshData()
    }

    // 出荷取消
    async function handleCancelShipment() {
        const shippedIds = trees
            .filter(t => selectedIds.includes(t.id) && t.status === 'shipped')
            .map(t => t.id)
        if (shippedIds.length === 0) return
        if (!confirm(`${shippedIds.length} 本の出荷を取り消して在庫に戻しますか？\n（出荷明細からも削除されます）`)) return

        const supabase = createClient()
        try {
            // 1. 該当する出荷明細を取得（どの出荷に属しているか）
            const { data: items, error: fetchError } = await supabase
                .from('shipment_items')
                .select('id, shipment_id')
                .in('tree_id', shippedIds)
            if (fetchError) throw fetchError

            // 2. 出荷明細を削除
            if (items && items.length > 0) {
                const itemIds = items.map(i => i.id)
                const { error: deleteError } = await supabase
                    .from('shipment_items')
                    .delete()
                    .in('id', itemIds)
                if (deleteError) throw deleteError

                // 3. 空になった出荷レコードを削除
                const affectedShipmentIds = [...new Set(items.map(i => i.shipment_id))]
                for (const shipmentId of affectedShipmentIds) {
                    const { count } = await supabase
                        .from('shipment_items')
                        .select('id', { count: 'exact', head: true })
                        .eq('shipment_id', shipmentId)
                    if (count === 0) {
                        await supabase.from('shipments').delete().eq('id', shipmentId)
                    }
                }
            }

            // 4. 樹木を在庫に戻す
            const { error: updateError } = await supabase
                .from('trees')
                .update({ status: 'in_stock' })
                .in('id', shippedIds)
            if (updateError) throw updateError

            setSelectedIds([])
            refreshData()
        } catch (error) {
            console.error('出荷取消エラー:', error)
            alert('出荷取消に失敗しました')
        }
    }

    // CSVダウンロード機能
    const downloadCSV = () => {
        const headers = ["管理番号", "樹種", "樹高(m)", "本立ち", "上代(円)", "状態", "場所", "クライアント", "出荷日", "見積り番号", "入荷日", "備考"]
        const rows = filteredTrees.map(t => [
            t.management_number || '-',
            t.species?.name || '-',
            t.height,
            t.trunk_count,
            t.price,
            statusLabels[t.status]?.label || t.status,
            t.location || '-',
            t.client?.name || '',
            t.shipped_at || '',
            t.estimate_number || '',
            t.arrived_at,
            t.notes || ''
        ])

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n')

        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]) // Excel対応(BOM付きUTF-8)
        const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.setAttribute('href', url)
        link.setAttribute('download', `satoyama_inventory_${new Date().toISOString().split('T')[0]}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
                <p className="text-green-700">読み込み中...</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 pb-24">
            {/* ヘッダー、メインなどは省略せず全てのロジックを保持 */}
            <header className="bg-white shadow-sm border-b border-green-200">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/"
                                className="text-green-600 hover:text-green-800"
                            >
                                ← 戻る
                            </Link>
                            <h1 className="text-2xl font-bold text-green-800">
                                樹木一覧
                            </h1>
                        </div>
                        <Link
                            href="/trees/new"
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold"
                        >
                            ＋ 新規登録
                        </Link>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* オフラインインジケーター */}
                {(!isOnline || pendingCount > 0) && (
                    <div className={`rounded-xl px-4 py-3 mb-6 flex items-center gap-3 ${
                        !isOnline
                            ? 'bg-yellow-50 border border-yellow-300'
                            : 'bg-blue-50 border border-blue-300'
                    }`}>
                        <span className="text-lg">{!isOnline ? '⚡' : '🔄'}</span>
                        <div>
                            {!isOnline ? (
                                <>
                                    <p className="text-sm font-bold text-yellow-800">オフラインモード</p>
                                    <p className="text-xs text-yellow-600">
                                        キャッシュデータを表示中。
                                        {pendingCount > 0 && `未同期の編集が ${pendingCount} 件あります。`}
                                    </p>
                                </>
                            ) : (
                                <p className="text-sm font-bold text-blue-800">
                                    未同期の編集が {pendingCount} 件あります（自動同期中...）
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* フィルター */}
                <div className="bg-white rounded-xl shadow p-4 mb-6">
                    <div className="flex flex-wrap gap-4">
                        {/* 樹種フィルター */}
                        <div className="flex-1 min-w-[150px]">
                            <label className="block text-sm font-medium text-gray-600 mb-1">樹種</label>
                            <select
                                value={speciesFilter}
                                onChange={(e) => setSpeciesFilter(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            >
                                <option value="">すべて</option>
                                {species.map((s) => (
                                    <option key={s.id} value={s.name}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* 圃場フィルター */}
                        <div className="flex-1 min-w-[150px]">
                            <label className="block text-sm font-medium text-gray-600 mb-1">圃場・場所</label>
                            <select
                                value={locationFilter}
                                onChange={(e) => setLocationFilter(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            >
                                <option value="">すべて</option>
                                {locations.map((loc) => (
                                    <option key={loc} value={loc}>{loc}</option>
                                ))}
                            </select>
                        </div>

                        {/* 状態フィルター */}
                        <div className="flex-1 min-w-[150px]">
                            <label className="block text-sm font-medium text-gray-600 mb-1">状態</label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            >
                                <option value="">すべて</option>
                                <option value="in_stock">在庫あり</option>
                                <option value="reserved">予約済み</option>
                                <option value="shipped">出荷済み</option>
                                <option value="dead">枯死</option>
                            </select>
                        </div>

                        {/* クライアントフィルター */}
                        <div className="flex-1 min-w-[150px]">
                            <label className="block text-sm font-medium text-gray-600 mb-1">クライアント</label>
                            <select
                                value={clientFilter}
                                onChange={(e) => setClientFilter(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            >
                                <option value="">すべて</option>
                                {clientNames.map((name) => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </div>

                        {/* 出荷日フィルター */}
                        <div className="flex-1 min-w-[150px]">
                            <label className="block text-sm font-medium text-gray-600 mb-1">出荷日</label>
                            <input
                                type="date"
                                value={shippedAtFilter}
                                onChange={(e) => setShippedAtFilter(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            />
                        </div>

                        {/* 見積り番号検索 */}
                        <div className="flex-1 min-w-[150px]">
                            <label className="block text-sm font-medium text-gray-600 mb-1">見積り番号</label>
                            <input
                                type="text"
                                value={estimateNumberFilter}
                                onChange={(e) => setEstimateNumberFilter(e.target.value)}
                                placeholder="番号で検索"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            />
                        </div>

                        {/* クリアボタン */}
                        <div className="flex items-end">
                            <button
                                onClick={() => {
                                    setSpeciesFilter('')
                                    setLocationFilter('')
                                    setStatusFilter('')
                                    setClientFilter('')
                                    setShippedAtFilter('')
                                    setEstimateNumberFilter('')
                                    setSelectedIds([])
                                }}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg"
                            >
                                クリア
                            </button>
                        </div>
                    </div>
                </div>

                {/* 一覧テーブル */}
                {filteredTrees.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                        <p className="text-gray-500 text-lg">
                            {trees.length === 0 ? 'まだ樹木が登録されていません' : '条件に一致する樹木がありません'}
                        </p>
                        {trees.length === 0 && (
                            <Link
                                href="/trees/new"
                                className="inline-block mt-4 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold"
                            >
                                最初の樹木を登録する
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-green-50 border-b border-green-200">
                                    <tr>
                                        <th className="px-4 py-3 w-10">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded text-green-600 focus:ring-green-500"
                                                checked={selectedIds.length === filteredTrees.length && filteredTrees.length > 0}
                                                onChange={toggleSelectAll}
                                            />
                                        </th>
                                        <th className="px-4 py-3 text-sm font-semibold text-green-800">管理番号</th>
                                        <th className="px-4 py-3 text-sm font-semibold text-green-800">樹種</th>
                                        <th className="px-4 py-3 text-sm font-semibold text-green-800">樹高</th>
                                        <th className="px-4 py-3 text-sm font-semibold text-green-800">本立ち</th>
                                        <th className="px-4 py-3 text-sm font-semibold text-green-800">上代</th>
                                        <th className="px-4 py-3 text-sm font-semibold text-green-800">状態</th>
                                        <th className="px-4 py-3 text-sm font-semibold text-green-800">場所</th>
                                        <th className="px-4 py-3 text-sm font-semibold text-green-800">クライアント</th>
                                        <th className="px-4 py-3 text-sm font-semibold text-green-800">出荷日</th>
                                        <th className="px-4 py-3 text-sm font-semibold text-green-800">見積り番号</th>
                                        <th className="px-4 py-3 text-sm font-semibold text-green-800">備考</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredTrees.map((tree) => (
                                        <tr
                                            key={tree.id}
                                            className={`hover:bg-green-50 transition-colors cursor-pointer ${selectedIds.includes(tree.id) ? 'bg-green-50/50' : ''}`}
                                            onClick={() => window.location.href = `/trees/${tree.id}`}
                                        >
                                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded text-green-600 focus:ring-green-500"
                                                    checked={selectedIds.includes(tree.id)}
                                                    onChange={() => toggleSelect(tree.id)}
                                                />
                                            </td>
                                            <td className="px-4 py-3 font-mono text-sm font-bold text-gray-600">
                                                {tree.management_number || '-'}
                                            </td>
                                            <td className="px-4 py-3 font-medium">
                                                {tree.species?.name || '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                {tree.height}m
                                            </td>
                                            <td className="px-4 py-3">
                                                {tree.trunk_count}本
                                            </td>
                                            <td className="px-4 py-3 font-bold text-green-700">
                                                &yen;{tree.price.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusLabels[tree.status]?.color || ''}`}>
                                                    {statusLabels[tree.status]?.label || tree.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 text-sm">
                                                {tree.location || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 text-sm">
                                                {tree.client?.name || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 text-sm">
                                                {tree.shipped_at || '-'}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-sm text-gray-600">
                                                {tree.estimate_number || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 text-sm max-w-[200px] truncate">
                                                {tree.notes || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-4 py-3 bg-gray-50 border-t flex justify-between items-center">
                            <p className="text-sm text-gray-600">
                                {filteredTrees.length === trees.length
                                    ? `全 ${trees.length} 件`
                                    : `${filteredTrees.length} 件 / 全 ${trees.length} 件`
                                }
                            </p>
                            <button
                                onClick={downloadCSV}
                                className="text-sm font-bold text-green-700 hover:text-green-900 flex items-center gap-1 bg-white border border-green-200 px-3 py-1.5 rounded-lg shadow-sm hover:bg-green-50 transition-all"
                            >
                                CSV出力 (Excel用)
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* アクションバー（選択時のみ表示） */}
            {selectedIds.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] sm:w-auto bg-green-900/95 backdrop-blur-md text-white px-4 py-3 sm:px-6 sm:py-4 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center gap-3 sm:gap-8 border border-green-700 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex sm:border-r sm:border-green-700 sm:pr-8">
                        <p className="text-base sm:text-lg whitespace-nowrap">
                            <span className="font-bold text-green-400 mr-2">{selectedIds.length}</span>
                            本を選択中
                        </p>
                    </div>
                    <div className="flex gap-2 sm:gap-4 overflow-x-auto w-full sm:w-auto justify-center">
                        <button
                            onClick={() => setIsEstimateDialogOpen(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 px-4 sm:px-6 py-2 rounded-xl font-bold transition-all active:scale-95 whitespace-nowrap text-sm sm:text-base"
                        >
                            見積
                        </button>
                        <button
                            onClick={() => setIsReservationDialogOpen(true)}
                            className="bg-yellow-600 hover:bg-yellow-700 px-4 sm:px-6 py-2 rounded-xl font-bold transition-all active:scale-95 whitespace-nowrap text-sm sm:text-base"
                        >
                            予約
                        </button>
                        <button
                            onClick={() => setIsShipmentDialogOpen(true)}
                            className="bg-blue-600 hover:bg-blue-700 px-4 sm:px-6 py-2 rounded-xl font-bold transition-all active:scale-95 whitespace-nowrap text-sm sm:text-base"
                        >
                            出荷
                        </button>
                        {hasReserved && (
                            <button
                                onClick={handleCancelReservation}
                                className="bg-orange-600 hover:bg-orange-700 px-4 sm:px-6 py-2 rounded-xl font-bold transition-all active:scale-95 whitespace-nowrap text-sm sm:text-base"
                            >
                                予約取消
                            </button>
                        )}
                        {hasShipped && (
                            <button
                                onClick={handleCancelShipment}
                                className="bg-red-600 hover:bg-red-700 px-4 sm:px-6 py-2 rounded-xl font-bold transition-all active:scale-95 whitespace-nowrap text-sm sm:text-base"
                            >
                                出荷取消
                            </button>
                        )}
                        <button
                            onClick={() => setSelectedIds([])}
                            className="text-green-300 hover:text-white transition-colors text-sm sm:text-base px-2 py-2"
                        >
                            × 選択解除
                        </button>
                    </div>
                </div>
            )}

            {/* 予約ダイアログ */}
            <ReservationDialog
                isOpen={isReservationDialogOpen}
                onClose={() => setIsReservationDialogOpen(false)}
                selectedIds={selectedIds}
                selectedTrees={selectedTreesData}
                onSuccess={handleShipmentSuccess}
                defaultClientId={commonClientId}
            />

            {/* 出荷ダイアログ */}
            <ShipmentDialog
                isOpen={isShipmentDialogOpen}
                onClose={() => setIsShipmentDialogOpen(false)}
                selectedIds={selectedIds}
                selectedTrees={selectedTreesData}
                onSuccess={handleShipmentSuccess}
                defaultClientId={commonClientId}
            />

            {/* 見積ダイアログ */}
            <EstimateDialog
                isOpen={isEstimateDialogOpen}
                onClose={() => setIsEstimateDialogOpen(false)}
                selectedTrees={selectedTreesData}
                onSuccess={handleShipmentSuccess}
                defaultClientId={commonClientId}
            />
        </div>
    )
}
