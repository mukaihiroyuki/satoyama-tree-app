'use client'

import React, { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { logActivity, logActivityBulk } from '@/lib/activity-log'

const PdfDownloadButton = dynamic(() => import('@/components/PdfDownloadButton'), { ssr: false })
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog'

interface ShipmentDetail {
    id: string
    shipped_at: string
    destination: string | null
    destination_name: string | null
    logistics_info: string | null
    notes: string | null
    estimate_id: string | null
    picking_status: string | null
    receipt_completed_at: string | null
    client: { id: string; name: string } | { id: string; name: string }[] | null
    shipment_items: {
        id: string
        unit_price: number
        original_price: number | null
        discount_amount: number | null
        picked_at: string | null
        tree: {
            id: string
            management_number: string | null
            height: number
            trunk_count: number
            species: { name: string } | null
        } | null
    }[]
}

interface SpeciesGroup {
    speciesName: string
    items: ShipmentDetail['shipment_items']
    totalPrice: number
}

export default function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params)
    const router = useRouter()
    const [shipment, setShipment] = useState<ShipmentDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [cancelling, setCancelling] = useState(false)
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
    const [receivedCount, setReceivedCount] = useState(0)
    const [manualPickTarget, setManualPickTarget] = useState<{ itemId: string; treeId: string | null; managementNumber: string } | null>(null)
    const [manualPickReason, setManualPickReason] = useState('')
    const [manualPicking, setManualPicking] = useState(false)
    const [fetchError, setFetchError] = useState<string | null>(null)
    const [isEditingPrices, setIsEditingPrices] = useState(false)
    const [editPrices, setEditPrices] = useState<Record<string, number>>({})
    const [editRate, setEditRate] = useState<string>('')
    const [savingPrices, setSavingPrices] = useState(false)
    const [showAddItems, setShowAddItems] = useState(false)
    const [addSearch, setAddSearch] = useState('')
    const [addSearchResults, setAddSearchResults] = useState<{ id: string; management_number: string | null; price: number; height: number; trunk_count: number; species: { name: string } | null }[]>([])
    const [addSelectedIds, setAddSelectedIds] = useState<Set<string>>(new Set())
    const [addRate, setAddRate] = useState(1)
    const [addSearching, setAddSearching] = useState(false)
    const [addSaving, setAddSaving] = useState(false)
    const [bulkSelectMode, setBulkSelectMode] = useState(false)
    const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set())
    const [showBulkCancelDialog, setShowBulkCancelDialog] = useState(false)
    const [bulkCancelling, setBulkCancelling] = useState(false)

    async function fetchShipment() {
        const supabase = createClient()
        const { data, error } = await supabase
                .from('shipments')
                .select(`
                    id,
                    shipped_at,
                    destination,
                    destination_name,
                    logistics_info,
                    notes,
                    estimate_id,
                    picking_status,
                    receipt_completed_at,
                    client:clients(id, name),
                    shipment_items(
                        id,
                        unit_price,
                        original_price,
                        discount_amount,
                        picked_at,
                        tree:trees(
                            id,
                            management_number,
                            height,
                            trunk_count,
                            species:species_master(name)
                        )
                    )
                `)
                .eq('id', id)
                .single()

            if (error) {
                console.error('Shipment fetch error:', error)
                setFetchError(`データ取得エラー: ${error.message}`)
                setLoading(false)
                return
            }
            setShipment(data as unknown as ShipmentDetail | null)

            // 受入チェック済み件数を取得
            if (data) {
                const client = Array.isArray(data.client) ? data.client[0] : data.client
                if (client?.id) {
                    const itemIds = (data.shipment_items || []).map((i: { id: string }) => i.id)
                    if (itemIds.length > 0) {
                        const { count } = await supabase
                            .from('client_receipts')
                            .select('id', { count: 'exact', head: true })
                            .eq('client_id', client.id)
                            .in('shipment_item_id', itemIds)
                        setReceivedCount(count || 0)
                    }
                }
            }

            setLoading(false)
    }

    useEffect(() => {
        fetchShipment()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])

    // 樹種ごとにグループ化
    const speciesGroups = useMemo<SpeciesGroup[]>(() => {
        if (!shipment) return []

        const groupMap = new Map<string, ShipmentDetail['shipment_items']>()

        for (const item of shipment.shipment_items) {
            const speciesName = item.tree?.species
                ? (Array.isArray(item.tree.species) ? item.tree.species[0]?.name : item.tree.species.name)
                : '不明'
            const existing = groupMap.get(speciesName) || []
            existing.push(item)
            groupMap.set(speciesName, existing)
        }

        return Array.from(groupMap.entries())
            .map(([speciesName, items]) => ({
                speciesName,
                items,
                totalPrice: items.reduce((sum, i) => sum + (i.unit_price || 0), 0),
            }))
            .sort((a, b) => b.items.length - a.items.length) // 本数多い順
    }, [shipment])

    // 明細追加: 樹木検索
    async function handleAddSearch() {
        if (!addSearch.trim()) return
        setAddSearching(true)
        try {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('trees')
                .select('id, management_number, price, height, trunk_count, species:species_master(name)')
                .in('status', ['in_stock', 'reserved'])
                .ilike('management_number', `%${addSearch.trim()}%`)
                .order('management_number')
                .limit(50)
            if (error) console.error('tree search error:', error)
            setAddSearchResults((data as unknown as typeof addSearchResults) || [])
        } finally {
            setAddSearching(false)
        }
    }

    // 明細追加: 確定
    async function handleAddItems() {
        if (!shipment || addSelectedIds.size === 0) return
        setAddSaving(true)
        try {
            const supabase = createClient()
            const selectedTrees = addSearchResults.filter(t => addSelectedIds.has(t.id))

            // 1. shipment_items追加
            const items = selectedTrees.map(tree => ({
                shipment_id: shipment.id,
                tree_id: tree.id,
                unit_price: Math.round(tree.price * addRate),
                original_price: tree.price,
            }))
            const { error: itemsError } = await supabase.from('shipment_items').insert(items)
            if (itemsError) throw itemsError

            // 2. 樹木ステータスをshippedに
            const { error: updateError } = await supabase
                .from('trees')
                .update({ status: 'shipped' })
                .in('id', Array.from(addSelectedIds))
            if (updateError) throw updateError

            await logActivityBulk('ship', Array.from(addSelectedIds), { added_to_existing: shipment.id })

            // リセット&リロード
            setShowAddItems(false)
            setAddSearch('')
            setAddSearchResults([])
            setAddSelectedIds(new Set())
            fetchShipment()
        } catch (error) {
            console.error('明細追加エラー:', error)
            alert('明細追加に失敗しました')
        } finally {
            setAddSaving(false)
        }
    }

    // 一括取消
    async function handleBulkCancel() {
        if (!shipment || bulkSelectedIds.size === 0) return
        setBulkCancelling(true)
        try {
            const supabase = createClient()
            const selectedItems = shipment.shipment_items.filter(i => bulkSelectedIds.has(i.id))
            const treeIds = selectedItems.map(i => i.tree?.id).filter((id): id is string => !!id)

            // 1. 出荷明細を削除
            const { error: deleteError } = await supabase
                .from('shipment_items')
                .delete()
                .in('id', Array.from(bulkSelectedIds))
            if (deleteError) throw deleteError

            // 2. 樹木を在庫に戻す
            if (treeIds.length > 0) {
                const { error: updateError } = await supabase
                    .from('trees')
                    .update({ status: 'in_stock' })
                    .in('id', treeIds)
                if (updateError) throw updateError
            }

            await logActivityBulk('cancel_ship', treeIds, { bulk: true, shipment_id: shipment.id })

            // 3. 残り明細が0なら出荷レコードも削除
            const { count } = await supabase
                .from('shipment_items')
                .select('id', { count: 'exact', head: true })
                .eq('shipment_id', shipment.id)

            if (count === 0) {
                const { error: delErr } = await supabase.from('shipments').delete().eq('id', shipment.id)
                if (delErr) console.error('shipment delete error:', delErr)
                router.push('/shipments')
                return
            }

            // リセット＆リロード
            setBulkSelectMode(false)
            setBulkSelectedIds(new Set())
            setShowBulkCancelDialog(false)
            fetchShipment()
        } catch (error) {
            console.error('一括取消エラー:', error)
            alert('一括取消に失敗しました')
        } finally {
            setBulkCancelling(false)
        }
    }

    const toggleGroup = (speciesName: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev)
            if (next.has(speciesName)) {
                next.delete(speciesName)
            } else {
                next.add(speciesName)
            }
            return next
        })
    }

    // 未スキャン明細の手動確認（理由必須）
    async function handleManualPick() {
        if (!manualPickTarget || !manualPickReason.trim()) return
        setManualPicking(true)
        try {
            const supabase = createClient()
            const { error } = await supabase
                .from('shipment_items')
                .update({ picked_at: new Date().toISOString() })
                .eq('id', manualPickTarget.itemId)

            if (error) {
                alert('手動確認に失敗しました')
                return
            }

            await logActivity('edit', manualPickTarget.treeId, {
                manual_pick: true,
                reason: manualPickReason.trim(),
                management_number: manualPickTarget.managementNumber,
                shipment_id: id,
            })

            setManualPickTarget(null)
            setManualPickReason('')
            fetchShipment()
        } finally {
            setManualPicking(false)
        }
    }

    // 未スキャン一括手動確認
    const [bulkPickOpen, setBulkPickOpen] = useState(false)
    const [bulkPickReason, setBulkPickReason] = useState('')
    const [bulkPicking, setBulkPicking] = useState(false)

    async function handleBulkManualPick() {
        if (!shipment || !bulkPickReason.trim()) return
        setBulkPicking(true)
        try {
            const supabase = createClient()
            const now = new Date().toISOString()
            const unpicked = shipment.shipment_items.filter(i => !i.picked_at)

            // 全未スキャン明細を一括更新
            const { error } = await supabase
                .from('shipment_items')
                .update({ picked_at: now })
                .in('id', unpicked.map(i => i.id))

            if (error) throw error

            const treeIds = unpicked.map(i => i.tree?.id).filter((id): id is string => !!id)
            await logActivityBulk('edit', treeIds, {
                manual_pick: true,
                bulk: true,
                reason: bulkPickReason.trim(),
                shipment_id: id,
            })

            setBulkPickOpen(false)
            setBulkPickReason('')
            fetchShipment()
        } catch (error) {
            console.error('一括手動確認エラー:', error)
            alert('一括手動確認に失敗しました')
        } finally {
            setBulkPicking(false)
        }
    }

    function startEditingPrices() {
        if (!shipment) return
        const prices: Record<string, number> = {}
        for (const item of shipment.shipment_items) {
            prices[item.id] = item.unit_price || 0
        }
        setEditPrices(prices)
        // 掛け率を推定（original_priceがある最初のitemから逆算）
        const sample = shipment.shipment_items.find(i => i.original_price && i.original_price > 0)
        if (sample && sample.original_price) {
            const estimated = sample.unit_price / sample.original_price
            setEditRate(String(parseFloat(estimated.toFixed(2))))
        } else {
            setEditRate('')
        }
        setIsEditingPrices(true)
    }

    function applyRate(rateValue: number) {
        if (!shipment) return
        const prices: Record<string, number> = {}
        for (const item of shipment.shipment_items) {
            const base = item.original_price || item.unit_price || 0
            prices[item.id] = Math.round(base * rateValue)
        }
        setEditPrices(prices)
    }

    async function handleSavePrices() {
        if (!shipment) return
        setSavingPrices(true)
        const supabase = createClient()
        try {
            for (const [itemId, price] of Object.entries(editPrices)) {
                const original = shipment.shipment_items.find(i => i.id === itemId)
                if (original && original.unit_price !== price) {
                    const { error } = await supabase
                        .from('shipment_items')
                        .update({ unit_price: price })
                        .eq('id', itemId)
                    if (error) throw error
                }
            }
            setIsEditingPrices(false)
            fetchShipment()
        } catch (error) {
            console.error('単価更新エラー:', error)
            alert('単価の更新に失敗しました')
        } finally {
            setSavingPrices(false)
        }
    }

    // 個別の木を出荷から取り消す
    async function handleCancelItem(itemId: string, treeId: string | undefined) {
        if (!shipment) return
        if (!confirm('この樹木を出荷から取り消しますか？')) return

        const supabase = createClient()
        try {
            // 1. 出荷明細を削除
            const { error: deleteError } = await supabase
                .from('shipment_items')
                .delete()
                .eq('id', itemId)
            if (deleteError) throw deleteError

            // 2. 樹木を在庫に戻す
            if (treeId) {
                await supabase
                    .from('trees')
                    .update({ status: 'in_stock' })
                    .eq('id', treeId)
            }

            if (treeId) await logActivity('cancel_ship', treeId)

            // 3. 残り明細が0なら出荷レコードも削除
            const { count } = await supabase
                .from('shipment_items')
                .select('id', { count: 'exact', head: true })
                .eq('shipment_id', shipment.id)
            if (count === 0) {
                const { error: delErr } = await supabase.from('shipments').delete().eq('id', shipment.id)
                if (delErr) console.error('shipment delete error:', delErr)
                router.push('/shipments')
                return
            }

            // 画面をリロードして反映
            window.location.reload()
        } catch (error) {
            console.error('個別取消エラー:', error)
            alert('取消に失敗しました')
        }
    }

    async function handleCancelShipment() {
        if (!shipment) return
        if (!confirm('この出荷を取り消しますか？\n対象の樹木はすべて「在庫あり」に戻ります。')) return

        setCancelling(true)
        const supabase = createClient()

        try {
            const treeIds = shipment.shipment_items
                .map(item => item.tree?.id)
                .filter((id): id is string => !!id)

            // 1. 樹木を在庫に戻す
            if (treeIds.length > 0) {
                const { error } = await supabase
                    .from('trees')
                    .update({ status: 'in_stock' })
                    .in('id', treeIds)
                if (error) throw error
            }

            // 2. 出荷明細を削除
            const { error: itemsError } = await supabase
                .from('shipment_items')
                .delete()
                .eq('shipment_id', shipment.id)
            if (itemsError) throw itemsError

            // 3. 見積経由の場合、見積ステータスを「発行済」に戻す
            if (shipment.estimate_id) {
                await supabase
                    .from('estimates')
                    .update({ status: '発行済', updated_at: new Date().toISOString() })
                    .eq('id', shipment.estimate_id)
            }

            // 4. 出荷レコードを削除
            const { error: shipmentError } = await supabase
                .from('shipments')
                .delete()
                .eq('id', shipment.id)
            if (shipmentError) throw shipmentError

            await logActivityBulk('cancel_ship', treeIds)
            router.push('/shipments')
        } catch (error) {
            console.error('出荷取消エラー:', error)
            alert('出荷取消に失敗しました')
        } finally {
            setCancelling(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-500">読み込み中...</p>
            </div>
        )
    }

    if (!shipment) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    {fetchError ? (
                        <p className="text-red-600 font-bold mb-4">{fetchError}</p>
                    ) : (
                        <p className="text-gray-500 mb-4">出荷データが見つかりません</p>
                    )}
                    <Link href="/shipments" className="text-blue-600 hover:underline">出荷一覧に戻る</Link>
                </div>
            </div>
        )
    }

    const clientData = Array.isArray(shipment.client) ? shipment.client[0] : shipment.client
    const clientName = clientData?.name || '不明'
    const clientId = clientData?.id
    const totalItems = shipment.shipment_items.length
    const totalAmount = isEditingPrices
        ? Object.values(editPrices).reduce((sum, p) => sum + p, 0)
        : shipment.shipment_items.reduce((sum, i) => sum + (i.unit_price || 0), 0)
    const unscannedItems = shipment.shipment_items.filter(i => !i.picked_at)

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            <header className="bg-white border-b border-gray-200 px-4 py-6">
                <div className="max-w-4xl mx-auto flex items-center gap-4">
                    <Link href="/shipments" className="text-blue-600">← 戻る</Link>
                    <h1 className="text-xl font-bold text-gray-800">出荷詳細</h1>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
                {/* サマリーカード */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">出荷日</p>
                            <p className="text-lg font-bold text-gray-800 mt-1">{shipment.shipped_at}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">顧客</p>
                            <p className="text-lg font-bold text-gray-800 mt-1">{clientName}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">出荷本数</p>
                            <p className="text-lg font-bold text-blue-700 mt-1">{totalItems} 本</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">合計金額</p>
                            <p className="text-lg font-bold text-blue-700 mt-1">&yen;{totalAmount.toLocaleString()}</p>
                        </div>
                    </div>
                    {shipment.notes && (
                        <div className="mt-4 bg-gray-50 rounded-lg p-3 text-sm text-gray-600 border border-gray-100">
                            {shipment.notes}
                        </div>
                    )}
                </div>

                {/* ピッキング */}
                {shipment.picking_status !== 'completed' && (
                    <Link
                        href={`/shipments/${shipment.id}/picking`}
                        className="block w-full bg-amber-500 hover:bg-amber-600 text-white text-center py-4 rounded-xl font-black text-lg shadow-lg transition-all active:scale-95"
                    >
                        {shipment.picking_status === 'in_progress'
                            ? `ピッキング再開（途中）`
                            : 'ピッキング開始'
                        }
                    </Link>
                )}
                {shipment.picking_status === 'completed' && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                        <span className="text-green-700 font-bold">ピッキング完了・出荷確定済み</span>
                    </div>
                )}

                {/* 未スキャン明細（事務所用：手動確認） */}
                {(shipment.picking_status === 'completed' || shipment.picking_status === 'in_progress') && unscannedItems.length > 0 && (
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
                        <h3 className="font-bold text-amber-800 mb-2">
                            未スキャン ({unscannedItems.length}本)
                        </h3>
                        <p className="text-xs text-amber-600 mb-1">
                            ピッキング時にスキャンされなかった明細です。
                        </p>
                        <p className="text-xs font-bold text-red-600 mb-3">
                            ※ 手動確認は事務所で行ってください。現場での操作は禁止です。
                        </p>
                        <button
                            onClick={() => setBulkPickOpen(true)}
                            className="w-full mb-3 bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-lg font-bold text-sm transition-colors"
                        >
                            未スキャン {unscannedItems.length}本を一括確認
                        </button>
                        <div className="space-y-2">
                            {unscannedItems.map(item => {
                                const speciesName = item.tree?.species
                                    ? (Array.isArray(item.tree.species) ? item.tree.species[0]?.name : item.tree.species.name)
                                    : '不明'
                                return (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-between bg-white rounded-lg px-4 py-2 border border-amber-200"
                                    >
                                        <div>
                                            <span className="font-mono text-sm font-bold text-gray-800">
                                                {item.tree?.management_number || '-'}
                                            </span>
                                            <span className="text-xs text-gray-500 ml-2">{speciesName}</span>
                                        </div>
                                        <button
                                            onClick={() => setManualPickTarget({
                                                itemId: item.id,
                                                treeId: item.tree?.id || null,
                                                managementNumber: item.tree?.management_number || '-',
                                            })}
                                            className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded font-bold transition-colors"
                                        >
                                            手動確認
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* 手動確認ダイアログ */}
                {manualPickTarget && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-1">手動確認</h3>
                            <p className="text-xs font-bold text-red-600 mb-2">
                                ※ この操作は事務所で行ってください。現場での操作は禁止です。
                            </p>
                            <p className="text-sm text-gray-500 mb-4">
                                <span className="font-mono font-bold">{manualPickTarget.managementNumber}</span> をスキャンなしで確認済みにします
                            </p>
                            <label className="block text-sm font-bold text-gray-700 mb-1">
                                理由 <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={manualPickReason}
                                onChange={(e) => setManualPickReason(e.target.value)}
                                placeholder="例: 現場で積込み確認済み、ラベル剥がれでスキャン不可"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
                                rows={3}
                                autoFocus
                            />
                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={() => { setManualPickTarget(null); setManualPickReason('') }}
                                    className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-colors"
                                >
                                    キャンセル
                                </button>
                                <button
                                    onClick={handleManualPick}
                                    disabled={!manualPickReason.trim() || manualPicking}
                                    className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors"
                                >
                                    {manualPicking ? '処理中...' : '確認済みにする'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 一括手動確認ダイアログ */}
                {bulkPickOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-1">一括手動確認</h3>
                            <p className="text-sm text-amber-700 font-bold mb-4">
                                未スキャン {unscannedItems.length}本 を全て確認済みにします
                            </p>
                            <label className="block text-sm font-bold text-gray-700 mb-1">
                                理由 <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={bulkPickReason}
                                onChange={(e) => setBulkPickReason(e.target.value)}
                                placeholder="例: 現場で積込み確認済み、QRラベル不一致のため一括処理"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
                                rows={3}
                                autoFocus
                            />
                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={() => { setBulkPickOpen(false); setBulkPickReason('') }}
                                    className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-colors"
                                >
                                    キャンセル
                                </button>
                                <button
                                    onClick={handleBulkManualPick}
                                    disabled={!bulkPickReason.trim() || bulkPicking}
                                    className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors"
                                >
                                    {bulkPicking ? '処理中...' : `${unscannedItems.length}本を確認済みにする`}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 受入状況 */}
                <div className={`rounded-xl p-4 border ${
                    shipment.receipt_completed_at
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-gray-50 border-gray-200'
                }`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className={`font-bold ${shipment.receipt_completed_at ? 'text-emerald-700' : 'text-gray-500'}`}>
                                {shipment.receipt_completed_at ? '受入完了' : '受入待ち'}
                            </p>
                            <p className="text-sm text-gray-500 mt-0.5">
                                {receivedCount}/{totalItems} 本チェック済み
                                {shipment.receipt_completed_at && (
                                    <span className="ml-2">
                                        ({new Date(shipment.receipt_completed_at).toLocaleDateString('ja-JP')} 完了)
                                    </span>
                                )}
                            </p>
                        </div>
                        {shipment.receipt_completed_at && receivedCount < totalItems && (
                            <span className="text-amber-600 text-sm font-bold">
                                {totalItems - receivedCount}本 未確認
                            </span>
                        )}
                    </div>
                </div>

                {/* PDF ダウンロードボタン */}
                <div className="flex flex-wrap gap-3">
                    <PdfDownloadButton
                        type="delivery"
                        shipmentId={shipment.id}
                        label="納品書ダウンロード"
                    />
                    <PdfDownloadButton
                        type="invoice"
                        shipmentId={shipment.id}
                        label="請求書ダウンロード"
                    />
                    {!isEditingPrices ? (
                        <button
                            onClick={startEditingPrices}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm border border-gray-200 transition-colors"
                        >
                            単価編集
                        </button>
                    ) : (
                        <div className="w-full space-y-3">
                            {/* 掛け率一括変更 */}
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <label className="block text-sm font-bold text-blue-800 mb-2">掛け率で一括変更</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        value={editRate}
                                        onChange={(e) => setEditRate(e.target.value)}
                                        step="0.01"
                                        min="0"
                                        max="1"
                                        placeholder="0.5"
                                        className="w-24 border border-blue-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                    <button
                                        onClick={() => {
                                            const r = parseFloat(editRate)
                                            if (r > 0 && r <= 1) applyRate(r)
                                            else alert('掛け率は0〜1の範囲で入力してください')
                                        }}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm transition-colors"
                                    >
                                        適用
                                    </button>
                                    <span className="text-sm text-blue-600">
                                        {editRate && parseFloat(editRate) > 0 && parseFloat(editRate) < 1
                                            ? `${Math.round(parseFloat(editRate) * 100)}%（${Math.round(parseFloat(editRate) * 10)}掛け）`
                                            : ''}
                                    </span>
                                </div>
                                <p className="text-xs text-blue-500 mt-1">※ 上代 × 掛け率で全明細の単価を一括計算します。個別の微調整は下の明細を展開してください。</p>
                            </div>
                            {/* 保存・キャンセル */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setIsEditingPrices(false)}
                                    className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-bold text-sm border border-gray-200 transition-colors"
                                >
                                    キャンセル
                                </button>
                                <button
                                    onClick={handleSavePrices}
                                    disabled={savingPrices}
                                    className="flex-[2] px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-xl font-bold text-sm transition-colors"
                                >
                                    {savingPrices ? '保存中...' : '単価を保存'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* クライアントポータル */}
                {clientId && (
                    <div className="flex gap-3">
                        <Link
                            href={`/c/${clientId}/s/${shipment.id}`}
                            target="_blank"
                            className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-3 rounded-xl font-bold border border-emerald-200 transition-colors text-center"
                        >
                            ポータルを開く
                        </Link>
                        <button
                            onClick={() => {
                                const url = `${window.location.origin}/c/${clientId}/s/${shipment.id}`
                                navigator.clipboard.writeText(url)
                                alert(`ポータルURLをコピーしました:\n${url}`)
                            }}
                            className="px-4 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold border border-emerald-200 transition-colors text-sm"
                        >
                            URL コピー
                        </button>
                    </div>
                )}

                {/* 明細追加 */}
                <button
                    onClick={() => setShowAddItems(true)}
                    className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 py-3 rounded-xl font-bold border border-blue-200 transition-colors"
                >
                    明細を追加する
                </button>

                {/* 明細追加ダイアログ */}
                {showAddItems && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col">
                            <div className="p-6 border-b border-gray-100">
                                <h3 className="text-lg font-bold text-gray-800">明細を追加</h3>
                                <p className="text-sm text-gray-500 mt-1">管理番号で検索して、この出荷に樹木を追加します</p>
                            </div>

                            <div className="p-6 space-y-4 overflow-y-auto flex-1">
                                {/* 検索 */}
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={addSearch}
                                        onChange={(e) => setAddSearch(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddSearch()}
                                        placeholder="管理番号（例: TJ-005）"
                                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        autoFocus
                                    />
                                    <button
                                        onClick={handleAddSearch}
                                        disabled={addSearching}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-bold text-sm transition-colors"
                                    >
                                        {addSearching ? '...' : '検索'}
                                    </button>
                                </div>

                                {/* 掛け率 */}
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium text-gray-700">掛け率:</label>
                                    <input
                                        type="number"
                                        value={addRate}
                                        onChange={(e) => setAddRate(parseFloat(e.target.value) || 0)}
                                        step="0.01"
                                        min="0"
                                        max="1"
                                        className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                    <span className="text-xs text-gray-500">
                                        {addRate < 1 ? `${Math.round(addRate * 100)}%` : '掛け率なし'}
                                    </span>
                                </div>

                                {/* 検索結果 */}
                                {addSearchResults.length > 0 && (
                                    <div className="space-y-1">
                                        <p className="text-xs text-gray-500 font-bold">{addSearchResults.length}件ヒット（{addSelectedIds.size}本選択中）</p>
                                        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-60 overflow-y-auto">
                                            {addSearchResults.map(tree => {
                                                const selected = addSelectedIds.has(tree.id)
                                                const speciesName = tree.species
                                                    ? (Array.isArray(tree.species) ? tree.species[0]?.name : tree.species.name)
                                                    : '不明'
                                                return (
                                                    <div
                                                        key={tree.id}
                                                        onClick={() => {
                                                            setAddSelectedIds(prev => {
                                                                const next = new Set(prev)
                                                                if (next.has(tree.id)) next.delete(tree.id)
                                                                else next.add(tree.id)
                                                                return next
                                                            })
                                                        }}
                                                        className={`px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-colors ${selected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                                                    >
                                                        <span className="text-lg">{selected ? '✅' : '⬜'}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-mono text-sm font-bold text-gray-800">{tree.management_number || '-'}</p>
                                                            <p className="text-xs text-gray-500">{speciesName} / {tree.height}m / {tree.trunk_count}本立ち</p>
                                                        </div>
                                                        <span className="text-sm font-bold text-gray-600">
                                                            &yen;{Math.round(tree.price * addRate).toLocaleString()}
                                                        </span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                                {addSearchResults.length === 0 && addSearch && !addSearching && (
                                    <p className="text-sm text-gray-400 text-center py-4">該当する在庫が見つかりません</p>
                                )}
                            </div>

                            <div className="p-6 bg-gray-50 flex gap-3 border-t border-gray-100">
                                <button
                                    onClick={() => { setShowAddItems(false); setAddSearch(''); setAddSearchResults([]); setAddSelectedIds(new Set()) }}
                                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-white transition-colors"
                                    disabled={addSaving}
                                >
                                    キャンセル
                                </button>
                                <button
                                    onClick={handleAddItems}
                                    disabled={addSaving || addSelectedIds.size === 0}
                                    className="flex-[2] bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-3 rounded-xl font-bold shadow-lg transition-all active:scale-95"
                                >
                                    {addSaving ? '追加中...' : `${addSelectedIds.size}本を追加する`}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 出荷取消 */}
                <button
                    onClick={handleCancelShipment}
                    disabled={cancelling}
                    className="w-full bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 py-3 rounded-xl font-bold border border-red-200 transition-colors"
                >
                    {cancelling ? '取消処理中...' : '出荷を取り消す'}
                </button>

                {/* 樹種別内訳 */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                            樹種別内訳（{speciesGroups.length} 種）
                        </h2>
                        <button
                            onClick={() => {
                                if (bulkSelectMode) {
                                    setBulkSelectMode(false)
                                    setBulkSelectedIds(new Set())
                                } else {
                                    setBulkSelectMode(true)
                                }
                            }}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                                bulkSelectMode
                                    ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                    : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                            }`}
                        >
                            {bulkSelectMode ? '選択モード解除' : '一括取消モード'}
                        </button>
                    </div>

                    {/* 一括取消バー */}
                    {bulkSelectMode && (
                        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-3 flex items-center justify-between">
                            <div>
                                <span className="text-red-700 font-bold">{bulkSelectedIds.size}本 選択中</span>
                                <button
                                    onClick={() => {
                                        const allIds = new Set(shipment.shipment_items.map(i => i.id))
                                        setBulkSelectedIds(allIds)
                                        // 全グループ展開
                                        setExpandedGroups(new Set(speciesGroups.map(g => g.speciesName)))
                                    }}
                                    className="ml-3 text-xs text-red-500 hover:text-red-700 font-bold underline"
                                >
                                    全選択
                                </button>
                                <button
                                    onClick={() => setBulkSelectedIds(new Set())}
                                    className="ml-2 text-xs text-gray-500 hover:text-gray-700 font-bold underline"
                                >
                                    全解除
                                </button>
                            </div>
                            <button
                                onClick={() => setShowBulkCancelDialog(true)}
                                disabled={bulkSelectedIds.size === 0}
                                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                            >
                                {bulkSelectedIds.size}本を取消
                            </button>
                        </div>
                    )}
                    <div className="space-y-3">
                        {speciesGroups.map((group) => {
                            const isExpanded = expandedGroups.has(group.speciesName)
                            return (
                                <div
                                    key={group.speciesName}
                                    className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
                                >
                                    {/* グループヘッダー */}
                                    <button
                                        onClick={() => toggleGroup(group.speciesName)}
                                        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-gray-400 text-sm">
                                                {isExpanded ? '▼' : '▶'}
                                            </span>
                                            <span className="font-bold text-gray-800 text-lg">
                                                {group.speciesName}
                                            </span>
                                            <span className="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full text-sm font-bold">
                                                {group.items.length} 本
                                            </span>
                                        </div>
                                        <span className="font-bold text-blue-700">
                                            &yen;{(isEditingPrices
                                                ? group.items.reduce((sum, i) => sum + (editPrices[i.id] ?? i.unit_price ?? 0), 0)
                                                : group.totalPrice
                                            ).toLocaleString()}
                                        </span>
                                    </button>

                                    {/* 展開時：個別ツリー一覧 */}
                                    {isExpanded && (
                                        <div className="border-t border-gray-100">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        {bulkSelectMode && (
                                                            <th className="px-2 py-2 w-10">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={group.items.every(i => bulkSelectedIds.has(i.id))}
                                                                    onChange={(e) => {
                                                                        setBulkSelectedIds(prev => {
                                                                            const next = new Set(prev)
                                                                            group.items.forEach(i => {
                                                                                if (e.target.checked) next.add(i.id)
                                                                                else next.delete(i.id)
                                                                            })
                                                                            return next
                                                                        })
                                                                    }}
                                                                    className="w-4 h-4 accent-red-600"
                                                                />
                                                            </th>
                                                        )}
                                                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-400">管理番号</th>
                                                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-400">樹高</th>
                                                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-400">本立ち</th>
                                                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-400">単価</th>
                                                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-400"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {group.items.map((item) => (
                                                        <tr key={item.id} className={`hover:bg-blue-50/30 ${bulkSelectedIds.has(item.id) ? 'bg-red-50' : ''}`}>
                                                            {bulkSelectMode && (
                                                                <td className="px-2 py-2.5">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={bulkSelectedIds.has(item.id)}
                                                                        onChange={() => {
                                                                            setBulkSelectedIds(prev => {
                                                                                const next = new Set(prev)
                                                                                if (next.has(item.id)) next.delete(item.id)
                                                                                else next.add(item.id)
                                                                                return next
                                                                            })
                                                                        }}
                                                                        className="w-4 h-4 accent-red-600"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    />
                                                                </td>
                                                            )}
                                                            <td className="px-4 py-2.5">
                                                                {item.tree ? (
                                                                    <Link
                                                                        href={`/trees/${item.tree.id}`}
                                                                        className="font-mono text-blue-600 hover:underline"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        {item.tree.management_number || '-'}
                                                                    </Link>
                                                                ) : (
                                                                    <span className="text-gray-400">-</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right text-gray-600">
                                                                {item.tree?.height ?? '-'}m
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right text-gray-600">
                                                                {item.tree?.trunk_count ?? '-'}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right font-bold text-gray-800">
                                                                {isEditingPrices ? (
                                                                    <input
                                                                        type="number"
                                                                        value={editPrices[item.id] ?? item.unit_price ?? 0}
                                                                        onChange={(e) => setEditPrices(prev => ({
                                                                            ...prev,
                                                                            [item.id]: parseInt(e.target.value) || 0,
                                                                        }))}
                                                                        step="1"
                                                                        className="w-28 border border-blue-300 rounded px-2 py-1 text-right text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    />
                                                                ) : (
                                                                    <>&yen;{(item.unit_price || 0).toLocaleString()}</>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleCancelItem(item.id, item.tree?.id)
                                                                    }}
                                                                    className="text-xs text-red-500 hover:text-red-700 font-bold"
                                                                >
                                                                    取消
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </main>

            {/* 一括取消 3重確認ダイアログ */}
            <DeleteConfirmDialog
                isOpen={showBulkCancelDialog}
                onClose={() => setShowBulkCancelDialog(false)}
                onConfirm={handleBulkCancel}
                itemCount={bulkSelectedIds.size}
                itemLabel="出荷明細"
                clientName={clientName}
            />
        </div>
    )
}
