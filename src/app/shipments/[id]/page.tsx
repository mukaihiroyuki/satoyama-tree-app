'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface ShipmentDetail {
    id: string
    shipped_at: string
    destination: string | null
    destination_name: string | null
    logistics_info: string | null
    notes: string | null
    client: { name: string } | { name: string }[] | null
    shipment_items: {
        id: string
        unit_price: number
        discount_amount: number | null
        tree: {
            id: string
            tree_number: number
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
    const [shipment, setShipment] = useState<ShipmentDetail | null>(null)
    const [loading, setLoading] = useState(true)
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
                    client:clients(name),
                    shipment_items(
                        id,
                        unit_price,
                        discount_amount,
                        tree:trees(
                            id,
                            tree_number,
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
                                                                        {item.tree.management_number || `#${item.tree.tree_number}`}
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
