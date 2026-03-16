'use client'

import React, { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { EstimateStatus } from '@/types/database'
import ShipmentDialog from '@/components/ShipmentDialog'
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog'
import { ASSIGNEES } from '@/lib/constants'
import { logActivity } from '@/lib/activity-log'
import { useRouter } from 'next/navigation'

const PdfDownloadButton = dynamic(() => import('@/components/PdfDownloadButton'), { ssr: false })

interface EstimateDetail {
    id: string
    estimate_number: string
    status: EstimateStatus
    rate: number | null
    issued_at: string | null
    notes: string | null
    assignee: string | null
    created_at: string
    client: { id: string; name: string; address: string | null } | { id: string; name: string; address: string | null }[] | null
    estimate_items: {
        id: string
        unit_price: number
        original_price: number | null
        tree: {
            id: string
            management_number: string | null
            height: number
            trunk_count: number
            price: number
            notes: string | null
            species: { name: string } | null
        } | null
    }[]
}

interface Client {
    id: string
    name: string
    default_rate: number | null
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
    const router = useRouter()
    const [estimate, setEstimate] = useState<EstimateDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
    const [updatingStatus, setUpdatingStatus] = useState(false)
    const [isShipmentDialogOpen, setIsShipmentDialogOpen] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)

    // 編集モード
    const [isEditing, setIsEditing] = useState(false)
    const [editRate, setEditRate] = useState<number>(1)
    const [editIssuedAt, setEditIssuedAt] = useState('')
    const [editAssignee, setEditAssignee] = useState('')
    const [editNotes, setEditNotes] = useState('')
    const [editStatus, setEditStatus] = useState<EstimateStatus>('下書き')
    const [editClientId, setEditClientId] = useState('')
    const [editPrices, setEditPrices] = useState<Record<string, number>>({})
    const [clients, setClients] = useState<Client[]>([])
    const [saving, setSaving] = useState(false)

    // 明細追加用
    const [isAddingItem, setIsAddingItem] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<{ id: string; management_number: string | null; species_name: string; price: number }[]>([])
    const [searching, setSearching] = useState(false)

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
                assignee,
                created_at,
                client:clients(id, name, address),
                estimate_items(
                    id,
                    unit_price,
                    original_price,
                    tree:trees(
                        id,
                        management_number,
                        height,
                        trunk_count,
                        price,
                        notes,
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
                totalPrice: items.reduce((sum, i) => sum + (isEditing ? (editPrices[i.id] ?? i.unit_price) : i.unit_price), 0),
            }))
            .sort((a, b) => b.items.length - a.items.length)
    }, [estimate, isEditing, editPrices])

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

    function handleShipmentSuccess() {
        handleStatusChange('出荷済')
    }

    // 編集モード開始
    function startEditing() {
        if (!estimate) return
        const client = Array.isArray(estimate.client) ? estimate.client[0] : estimate.client
        setEditRate(estimate.rate ?? 1)
        setEditIssuedAt(estimate.issued_at || '')
        setEditAssignee(estimate.assignee || '')
        setEditNotes(estimate.notes || '')
        setEditStatus(estimate.status)
        setEditClientId(client?.id || '')
        const prices: Record<string, number> = {}
        for (const item of estimate.estimate_items) {
            prices[item.id] = item.unit_price
        }
        setEditPrices(prices)
        setIsEditing(true)

        // クライアント一覧を取得
        const supabase = createClient()
        supabase.from('clients').select('id, name, default_rate').order('name').then(({ data }) => {
            setClients(data || [])
        })
    }

    // 掛け率を変更して全明細に一括適用
    function handleRateChange(newRate: number) {
        setEditRate(newRate)
        if (!estimate) return
        const newPrices: Record<string, number> = {}
        for (const item of estimate.estimate_items) {
            const originalPrice = item.tree?.price ?? item.original_price ?? item.unit_price
            newPrices[item.id] = Math.round(originalPrice * newRate)
        }
        setEditPrices(newPrices)
    }

    // 明細削除
    async function handleRemoveItem(itemId: string) {
        if (!confirm('この明細を削除しますか？')) return
        const supabase = createClient()
        const { error } = await supabase
            .from('estimate_items')
            .delete()
            .eq('id', itemId)
        if (error) {
            alert('明細の削除に失敗しました')
            return
        }
        await fetchEstimate()
        setEditPrices(prev => {
            const next = { ...prev }
            delete next[itemId]
            return next
        })
    }

    // 樹木検索（明細追加用）
    async function handleSearch() {
        if (!searchQuery.trim()) return
        setSearching(true)
        const supabase = createClient()
        const { data } = await supabase
            .from('trees')
            .select('id, management_number, price, species:species_master(name)')
            .or(`management_number.ilike.%${searchQuery}%`)
            .eq('status', 'in_stock')
            .limit(10)

        const results = (data || []).map(t => ({
            id: t.id,
            management_number: t.management_number,
            species_name: (t.species as { name: string } | { name: string }[] | null)
                ? (Array.isArray(t.species) ? t.species[0]?.name : (t.species as { name: string }).name) || '不明'
                : '不明',
            price: t.price,
        }))

        // 既に見積に入っているものを除外
        const existingTreeIds = new Set(estimate?.estimate_items.map(i => i.tree?.id).filter(Boolean))
        setSearchResults(results.filter(r => !existingTreeIds.has(r.id)))
        setSearching(false)
    }

    // 明細追加
    async function handleAddItem(tree: { id: string; price: number }) {
        if (!estimate) return
        const supabase = createClient()
        const unitPrice = Math.round(tree.price * editRate)
        const { error } = await supabase
            .from('estimate_items')
            .insert({
                estimate_id: estimate.id,
                tree_id: tree.id,
                unit_price: unitPrice,
                original_price: tree.price,
            })
        if (error) {
            alert('明細の追加に失敗しました')
            return
        }
        setSearchQuery('')
        setSearchResults([])
        await fetchEstimate()
    }

    // 編集保存
    async function handleSave() {
        if (!estimate) return
        setSaving(true)
        const supabase = createClient()

        try {
            // 1. 見積ヘッダー更新
            const { error: headerError } = await supabase
                .from('estimates')
                .update({
                    rate: editRate,
                    issued_at: editIssuedAt || null,
                    assignee: editAssignee || null,
                    notes: editNotes || null,
                    status: editStatus,
                    client_id: editClientId || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', estimate.id)
            if (headerError) throw headerError

            // 2. 明細の単価を個別更新
            for (const [itemId, price] of Object.entries(editPrices)) {
                const original = estimate.estimate_items.find(i => i.id === itemId)
                if (original && original.unit_price !== price) {
                    const { error } = await supabase
                        .from('estimate_items')
                        .update({ unit_price: price })
                        .eq('id', itemId)
                    if (error) throw error
                }
            }

            await logActivity('edit', null, {
                estimate_id: estimate.id,
                estimate_number: estimate.estimate_number,
            })

            setIsEditing(false)
            await fetchEstimate()
        } catch (error) {
            console.error('見積更新エラー:', error)
            alert('保存に失敗しました')
        } finally {
            setSaving(false)
        }
    }

    // 見積削除
    async function handleDeleteEstimate() {
        if (!estimate) return
        setDeleting(true)
        const supabase = createClient()

        // 出荷が紐づいているか確認
        const { data: shipments } = await supabase
            .from('shipments')
            .select('id')
            .eq('estimate_id', estimate.id)
            .limit(1)

        if (shipments && shipments.length > 0) {
            alert('この見積には出荷が紐づいているため削除できません。')
            setDeleting(false)
            return
        }

        // estimate_itemsはFK CASCADEで自動削除
        const { error } = await supabase
            .from('estimates')
            .delete()
            .eq('id', estimate.id)

        if (error) {
            console.error('見積削除エラー:', error)
            alert('削除に失敗しました')
            setDeleting(false)
            return
        }

        await logActivity('delete', null, {
            estimate_number: estimate.estimate_number,
            client_name: Array.isArray(estimate.client) ? estimate.client[0]?.name : estimate.client?.name,
            item_count: estimate.estimate_items.length,
        })

        router.push('/estimates')
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
    const totalAmount = isEditing
        ? estimate.estimate_items.reduce((sum, i) => sum + (editPrices[i.id] ?? i.unit_price), 0)
        : estimate.estimate_items.reduce((sum, i) => sum + (i.unit_price || 0), 0)

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
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/estimates" className="text-emerald-600">&larr; 戻る</Link>
                        <h1 className="text-xl font-bold text-gray-800">見積詳細</h1>
                    </div>
                    {!isEditing && estimate.status !== '出荷済' && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={startEditing}
                                className="text-sm font-bold text-emerald-700 bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-200 hover:bg-emerald-100"
                            >
                                編集
                            </button>
                            {estimate.status === '下書き' && (
                                <button
                                    onClick={() => setIsDeleteDialogOpen(true)}
                                    disabled={deleting}
                                    className="text-sm font-bold text-red-600 bg-red-50 px-4 py-2 rounded-lg border border-red-200 hover:bg-red-100 disabled:opacity-50"
                                >
                                    削除
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
                {/* サマリーカード */}
                <div className={`bg-white rounded-xl shadow-sm border p-6 ${isEditing ? 'border-emerald-300 ring-2 ring-emerald-200' : 'border-gray-100'}`}>
                    {isEditing ? (
                        /* 編集モード */
                        <div className="space-y-4">
                            <p className="text-sm font-bold text-emerald-600 uppercase tracking-wider">編集中</p>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-500 font-bold mb-1">見積番号</label>
                                    <p className="text-lg font-bold font-mono text-gray-400">{estimate.estimate_number}</p>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 font-bold mb-1">クライアント</label>
                                    <select
                                        value={editClientId}
                                        onChange={(e) => setEditClientId(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                    >
                                        <option value="">選択してください</option>
                                        {clients.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 font-bold mb-1">掛け率</label>
                                    <input
                                        type="number"
                                        value={editRate}
                                        onChange={(e) => handleRateChange(parseFloat(e.target.value) || 0)}
                                        step="0.01"
                                        min="0"
                                        max="1"
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">
                                        {editRate < 1 ? `${Math.round(editRate * 100)}%` : '掛け率なし'}
                                        {' '}— 変更すると全明細に反映
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 font-bold mb-1">ステータス</label>
                                    <select
                                        value={editStatus}
                                        onChange={(e) => setEditStatus(e.target.value as EstimateStatus)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                    >
                                        <option value="下書き">下書き</option>
                                        <option value="発行済">発行済</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 font-bold mb-1">発行日</label>
                                    <input
                                        type="date"
                                        value={editIssuedAt}
                                        onChange={(e) => setEditIssuedAt(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 font-bold mb-1">担当者</label>
                                    <select
                                        value={editAssignee}
                                        onChange={(e) => setEditAssignee(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                    >
                                        <option value="">選択してください</option>
                                        {ASSIGNEES.map(name => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-gray-500 font-bold mb-1">備考</label>
                                <textarea
                                    value={editNotes}
                                    onChange={(e) => setEditNotes(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-20"
                                />
                            </div>

                            <div className="bg-emerald-50 rounded-lg p-3 flex justify-between items-center">
                                <span className="text-sm font-bold text-gray-600">{totalItems} 本 / 合計</span>
                                <span className="text-lg font-black text-emerald-700">&yen;{totalAmount.toLocaleString()}</span>
                            </div>

                            {/* 保存・キャンセルボタン */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setIsEditing(false)}
                                    disabled={saving}
                                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-gray-50"
                                >
                                    キャンセル
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl font-bold shadow-lg shadow-emerald-200 disabled:opacity-50"
                                >
                                    {saving ? '保存中...' : '変更を保存'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* 表示モード */
                        <>
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
                                <div>
                                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">担当者</p>
                                    <p className="text-lg font-bold text-gray-800 mt-1">{estimate.assignee || '-'}</p>
                                </div>
                            </div>

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
                                        &rarr; 発行済にする
                                    </button>
                                )}
                            </div>

                            {estimate.notes && (
                                <div className="mt-4 bg-gray-50 rounded-lg p-3 text-sm text-gray-600 border border-gray-100">
                                    {estimate.notes}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* アクションボタン（表示モード時のみ） */}
                {!isEditing && (
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
                )}

                {/* 明細追加（編集モード時） */}
                {isEditing && (
                    <div className="bg-white rounded-xl shadow-sm border border-emerald-200 p-4">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-bold text-gray-700">明細を追加</h3>
                            <button
                                onClick={() => setIsAddingItem(!isAddingItem)}
                                className="text-sm font-bold text-emerald-600"
                            >
                                {isAddingItem ? '閉じる' : '+ 樹木を追加'}
                            </button>
                        </div>
                        {isAddingItem && (
                            <div className="space-y-3">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        placeholder="管理番号で検索"
                                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                    />
                                    <button
                                        onClick={handleSearch}
                                        disabled={searching}
                                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold"
                                    >
                                        検索
                                    </button>
                                </div>
                                {searchResults.length > 0 && (
                                    <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                                        {searchResults.map(tree => (
                                            <div key={tree.id} className="p-3 flex justify-between items-center">
                                                <div>
                                                    <span className="font-mono text-sm">{tree.management_number || '-'}</span>
                                                    <span className="text-gray-500 text-sm ml-2">{tree.species_name}</span>
                                                    <span className="text-gray-500 text-sm ml-2">&yen;{tree.price.toLocaleString()}</span>
                                                </div>
                                                <button
                                                    onClick={() => handleAddItem(tree)}
                                                    className="text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg"
                                                >
                                                    追加
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {searching && <p className="text-sm text-gray-400 text-center">検索中...</p>}
                            </div>
                        )}
                    </div>
                )}

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
                                                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-400">備考</th>
                                                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-400">樹高</th>
                                                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-400">本立ち</th>
                                                        <th className="px-4 py-2 text-right text-xs font-bold text-gray-400">単価</th>
                                                        {isEditing && (
                                                            <th className="px-4 py-2 text-right text-xs font-bold text-gray-400">操作</th>
                                                        )}
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
                                                            <td className="px-4 py-2.5 text-gray-500 text-xs max-w-[120px] truncate" title={item.tree?.notes || ''}>
                                                                {item.tree?.notes || ''}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right text-gray-600">
                                                                {item.tree?.height ?? '-'}m
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right text-gray-600">
                                                                {item.tree?.trunk_count ?? '-'}
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right">
                                                                {isEditing ? (
                                                                    <input
                                                                        type="number"
                                                                        value={editPrices[item.id] ?? item.unit_price}
                                                                        onChange={(e) => setEditPrices(prev => ({
                                                                            ...prev,
                                                                            [item.id]: parseInt(e.target.value) || 0,
                                                                        }))}
                                                                        className="w-24 text-right border border-gray-300 rounded px-2 py-1 text-sm"
                                                                    />
                                                                ) : (
                                                                    <span className="font-bold text-gray-800">
                                                                        &yen;{(item.unit_price || 0).toLocaleString()}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            {isEditing && (
                                                                <td className="px-4 py-2.5 text-right">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            handleRemoveItem(item.id)
                                                                        }}
                                                                        className="text-red-500 hover:text-red-700 text-xs font-bold"
                                                                    >
                                                                        削除
                                                                    </button>
                                                                </td>
                                                            )}
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

            {/* 見積削除ダイアログ */}
            <DeleteConfirmDialog
                isOpen={isDeleteDialogOpen}
                onClose={() => setIsDeleteDialogOpen(false)}
                onConfirm={handleDeleteEstimate}
                itemCount={totalItems}
                itemLabel={estimate.estimate_number}
                clientName={clientName}
            />

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
