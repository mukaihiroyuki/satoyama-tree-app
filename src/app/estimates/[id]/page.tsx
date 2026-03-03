'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { EstimateStatus } from '@/types/database'
import PdfDownloadButton from '@/components/PdfDownloadButton'
import ShipmentDialog from '@/components/ShipmentDialog'

interface EstimateDetail {
    id: string
    estimate_number: string
    status: EstimateStatus
    rate: number | null
    issued_at: string | null
    notes: string | null
    created_at: string
    client: { id: string; name: string; address: string | null } | { id: string; name: string; address: string | null }[] | null
    estimate_items: {
        id: string
        unit_price: number
        tree: {
            id: string
            management_number: string | null
            height: number
            trunk_count: number
            price: number
            species: { name: string } | null
        } | null
    }[]
}

interface SpeciesGroup {
    speciesName: string
    items: EstimateDetail['estimate_items']
    totalPrice: number
}

const statusColors: Record<string, string> = {
    '下書き': 'bg-gray-100 text-gray-700',
    '発行済': 'bg-emerald-100 text-emerald-700',
    '出荷済': 'bg-blue-100 text-blue-700',
}

export default function EstimateDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params)
    const [estimate, setEstimate] = useState<EstimateDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
    const [updatingStatus, setUpdatingStatus] = useState(false)
    const [isShipmentDialogOpen, setIsShipmentDialogOpen] = useState(false)

    async function fetchEstimate() {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('estimates')
            .select(`
                id,
                estimate_number,
                status,
                rate,
                issued_at,
                notes,
                created_at,
                client:clients(id, name, address),
                estimate_items(
                    id,
                    unit_price,
                    tree:trees(
                        id,
                        management_number,
                        height,
                        trunk_count,
                        price,
                        species:species_master(name)
                    )
                )
            `)
            .eq('id', id)
            .single()

        if (error) console.error('Estimate fetch error:', error)
        setEstimate(data as EstimateDetail | null)
        setLoading(false)
    }

    useEffect(() => {
        fetchEstimate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])

    const speciesGroups = useMemo<SpeciesGroup[]>(() => {
        if (!estimate) return []

        const groupMap = new Map<string, EstimateDetail['estimate_items']>()
        for (const item of estimate.estimate_items) {
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
            .sort((a, b) => b.items.length - a.items.length)
    }, [estimate])

    const toggleGroup = (speciesName: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev)
            if (next.has(speciesName)) next.delete(speciesName)
            else next.add(speciesName)
            return next
        })
    }

    async function handleStatusChange(newStatus: EstimateStatus) {
        if (!estimate) return
        setUpdatingStatus(true)
        const supabase = createClient()
        const { error } = await supabase
            .from('estimates')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', estimate.id)

        if (error) {
            console.error('Status update error:', error)
            alert('ステータス更新に失敗しました')
        } else {
            setEstimate(prev => prev ? { ...prev, status: newStatus } : null)
        }
        setUpdatingStatus(false)
    }

    // 出荷変換の成功ハンドラ
    function handleShipmentSuccess() {
        handleStatusChange('出荷済')
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-500">読み込み中...</p>
            </div>
        )
    }

    if (!estimate) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-500 mb-4">見積データが見つかりません</p>
                    <Link href="/estimates" className="text-emerald-600 hover:underline">見積一覧に戻る</Link>
                </div>
            </div>
        )
    }

    const client = Array.isArray(estimate.client) ? estimate.client[0] : estimate.client
    const clientName = client?.name || '不明'
    const totalItems = estimate.estimate_items.length
    const totalAmount = estimate.estimate_items.reduce((sum, i) => sum + (i.unit_price || 0), 0)

    // ShipmentDialog用のデータ変換
    const shipmentTreesData = estimate.estimate_items
        .filter(item => item.tree)
        .map(item => ({
            id: item.tree!.id,
            management_number: item.tree!.management_number,
            species_name: item.tree?.species
                ? (Array.isArray(item.tree.species) ? item.tree.species[0]?.name : item.tree.species.name) || '不明'
                : '不明',
            price: item.tree!.price,
        }))
    const shipmentTreeIds = shipmentTreesData.map(t => t.id)

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            <header className="bg-white border-b border-gray-200 px-4 py-6">
                <div className="max-w-4xl mx-auto flex items-center gap-4">
                    <Link href="/estimates" className="text-emerald-600">← 戻る</Link>
                    <h1 className="text-xl font-bold text-gray-800">見積詳細</h1>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
                {/* サマリーカード */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">見積番号</p>
                            <p className="text-lg font-bold text-gray-800 mt-1 font-mono">{estimate.estimate_number}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">クライアント</p>
                            <p className="text-lg font-bold text-gray-800 mt-1">{clientName}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">本数</p>
                            <p className="text-lg font-bold text-emerald-700 mt-1">{totalItems} 本</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">合計金額</p>
                            <p className="text-lg font-bold text-emerald-700 mt-1">&yen;{totalAmount.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">掛け率</p>
                            <p className="text-lg font-bold text-gray-800 mt-1">
                                {estimate.rate !== null ? `${Math.round(estimate.rate * 100)}%` : '-'}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">発行日</p>
                            <p className="text-lg font-bold text-gray-800 mt-1">{estimate.issued_at || '-'}</p>
                        </div>
                    </div>

                    {/* ステータス */}
                    <div className="mt-4 flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${statusColors[estimate.status] || ''}`}>
                            {estimate.status}
                        </span>
                        {estimate.status === '下書き' && (
                            <button
                                onClick={() => handleStatusChange('発行済')}
                                disabled={updatingStatus}
                                className="text-sm font-bold text-emerald-600 hover:text-emerald-800 disabled:opacity-50"
                            >
                                → 発行済にする
                            </button>
                        )}
                    </div>

                    {estimate.notes && (
                        <div className="mt-4 bg-gray-50 rounded-lg p-3 text-sm text-gray-600 border border-gray-100">
                            {estimate.notes}
                        </div>
                    )}
                </div>

                {/* アクションボタン */}
                <div className="flex flex-wrap gap-3">
                    <PdfDownloadButton
                        type="estimate"
                        estimateId={estimate.id}
                        label="見積書ダウンロード"
                    />
                    {estimate.status !== '出荷済' && (
                        <button
                            onClick={() => setIsShipmentDialogOpen(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all active:scale-95"
                        >
                            出荷に変換
                        </button>
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
                                            <span className="bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full text-sm font-bold">
                                                {group.items.length} 本
                                            </span>
                                        </div>
                                        <span className="font-bold text-emerald-700">
                                            &yen;{group.totalPrice.toLocaleString()}
                                        </span>
                                    </button>

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
                                                        <tr key={item.id} className="hover:bg-emerald-50/30">
                                                            <td className="px-4 py-2.5">
                                                                {item.tree ? (
                                                                    <Link
                                                                        href={`/trees/${item.tree.id}`}
                                                                        className="font-mono text-emerald-600 hover:underline"
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

            {/* 出荷ダイアログ（見積→出荷変換用） */}
            <ShipmentDialog
                isOpen={isShipmentDialogOpen}
                onClose={() => setIsShipmentDialogOpen(false)}
                selectedIds={shipmentTreeIds}
                selectedTrees={shipmentTreesData}
                onSuccess={handleShipmentSuccess}
                estimateId={estimate.id}
                defaultClientId={client?.id}
                defaultRate={estimate.rate ?? undefined}
            />
        </div>
    )
}
