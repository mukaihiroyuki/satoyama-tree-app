'use client'

import React, { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const PdfDownloadButton = dynamic(() => import('@/components/PdfDownloadButton'), { ssr: false })

interface ShipmentDetail {
    id: string
    shipped_at: string
    destination: string | null
    destination_name: string | null
    logistics_info: string | null
    notes: string | null
    estimate_id: string | null
    client: { name: string } | { name: string }[] | null
    shipment_items: {
        id: string
        unit_price: number
        discount_amount: number | null
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

    useEffect(() => {
        async function fetch() {
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
                    client:clients(name),
                    shipment_items(
                        id,
                        unit_price,
                        discount_amount,
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
            }
            setShipment(data as ShipmentDetail | null)
            setLoading(false)
        }
        fetch()
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

            // 3. 残り明細が0なら出荷レコードも削除
            const { count } = await supabase
                .from('shipment_items')
                .select('id', { count: 'exact', head: true })
                .eq('shipment_id', shipment.id)
            if (count === 0) {
                await supabase.from('shipments').delete().eq('id', shipment.id)
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
                    <p className="text-gray-500 mb-4">出荷データが見つかりません</p>
                    <Link href="/shipments" className="text-blue-600 hover:underline">出荷一覧に戻る</Link>
                </div>
            </div>
        )
    }

    const clientName = Array.isArray(shipment.client)
        ? shipment.client[0]?.name
        : shipment.client?.name || '不明'
    const totalItems = shipment.shipment_items.length
    const totalAmount = shipment.shipment_items.reduce((sum, i) => sum + (i.unit_price || 0), 0)

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
                </div>

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
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                        樹種別内訳（{speciesGroups.length} 種）
                    </h2>
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
                                            &yen;{group.totalPrice.toLocaleString()}
                                        </span>
                                    </button>

                                    {/* 展開時：個別ツリー一覧 */}
                                    {isExpanded && (
                                        <div className="border-t border-gray-100">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-400">管理番号</th>
                                                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-400">樹高</th>
                                                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-400">本立ち</th>
                                                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-400">単価</th>
                                                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-400"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {group.items.map((item) => (
                                                        <tr key={item.id} className="hover:bg-blue-50/30">
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
                                                                &yen;{(item.unit_price || 0).toLocaleString()}
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
        </div>
    )
}
