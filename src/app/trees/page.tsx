'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import ShipmentDialog from '@/components/ShipmentDialog'

interface Species {
    id: string
    name: string
}

interface TreeWithSpecies {
    id: string
    tree_number: number
    height: number
    trunk_count: number
    price: number
    status: string
    notes: string | null
    location: string | null
    arrived_at: string
    species: {
        name: string
    }
}

const statusLabels: Record<string, { label: string; color: string }> = {
    in_stock: { label: '在庫あり', color: 'bg-green-100 text-green-800' },
    reserved: { label: '予約済み', color: 'bg-yellow-100 text-yellow-800' },
    shipped: { label: '出荷済み', color: 'bg-blue-100 text-blue-800' },
    dead: { label: '枯死', color: 'bg-gray-100 text-gray-800' },
}

export default function TreesPage() {
    const [trees, setTrees] = useState<TreeWithSpecies[]>([])
    const [species, setSpecies] = useState<Species[]>([])
    const [locations, setLocations] = useState<string[]>([])
    const [loading, setLoading] = useState(true)

    // フィルター状態
    const [speciesFilter, setSpeciesFilter] = useState('')
    const [locationFilter, setLocationFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')

    // 選択状態
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [isShipmentDialogOpen, setIsShipmentDialogOpen] = useState(false)

    // 初回読み込み
    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        const supabase = createClient()

        // 樹種一覧
        const { data: speciesData } = await supabase
            .from('species_master')
            .select('id, name')
            .order('name_kana')
        setSpecies(speciesData || [])

        // 樹木一覧
        const { data: treesData } = await supabase
            .from('trees')
            .select(`*, species:species_master(name)`)
            .order('tree_number', { ascending: false })
        setTrees(treesData || [])

        // 場所一覧（ユニーク値）
        const uniqueLocations = [...new Set(
            (treesData || [])
                .map(t => t.location)
                .filter(Boolean)
        )] as string[]
        setLocations(uniqueLocations)

        setLoading(false)
    }

    // 成功時のリフレッシュ
    const handleShipmentSuccess = () => {
        setSelectedIds([])
        fetchData()
    }

    // フィルタ適用
    const filteredTrees = trees.filter(tree => {
        if (speciesFilter && tree.species?.name !== speciesFilter) return false
        if (locationFilter && tree.location !== locationFilter) return false
        if (statusFilter && tree.status !== statusFilter) return false
        return true
    })

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

    // 選択中の樹木データ取得
    const selectedTreesData = trees
        .filter(t => selectedIds.includes(t.id))
        .map(t => ({
            id: t.id,
            tree_number: t.tree_number,
            species_name: t.species?.name || '不明',
            price: t.price
        }))

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
                                📋 樹木一覧
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

                        {/* クリアボタン */}
                        <div className="flex items-end">
                            <button
                                onClick={() => {
                                    setSpeciesFilter('')
                                    setLocationFilter('')
                                    setStatusFilter('')
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
                                        <th className="px-4 py-3 text-sm font-semibold text-green-800">No.</th>
                                        <th className="px-4 py-3 text-sm font-semibold text-green-800">樹種</th>
                                        <th className="px-4 py-3 text-sm font-semibold text-green-800">樹高</th>
                                        <th className="px-4 py-3 text-sm font-semibold text-green-800">本立ち</th>
                                        <th className="px-4 py-3 text-sm font-semibold text-green-800">上代</th>
                                        <th className="px-4 py-3 text-sm font-semibold text-green-800">状態</th>
                                        <th className="px-4 py-3 text-sm font-semibold text-green-800">場所</th>
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
                                                #{tree.tree_number}
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
                                                ¥{tree.price.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusLabels[tree.status]?.color || ''}`}>
                                                    {statusLabels[tree.status]?.label || tree.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 text-sm">
                                                {tree.location || '-'}
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
                        </div>
                    </div>
                )}
            </main>

            {/* アクションバー（選択時のみ表示） */}
            {selectedIds.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-green-900/90 backdrop-blur-md text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-8 border border-green-700 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex border-r border-green-700 pr-8">
                        <p className="text-lg">
                            <span className="font-bold text-green-400 mr-2">{selectedIds.length}</span>
                            本を選択中
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={() => alert(`機能開発中: ${selectedIds.length}本を予約する`)}
                            className="bg-yellow-600 hover:bg-yellow-700 px-6 py-2 rounded-xl font-bold transition-all active:scale-95 whitespace-nowrap"
                        >
                            🗓️ 予約する
                        </button>
                        <button
                            onClick={() => setIsShipmentDialogOpen(true)}
                            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-xl font-bold transition-all active:scale-95 whitespace-nowrap"
                        >
                            📦 出荷する
                        </button>
                    </div>
                    <button
                        onClick={() => setSelectedIds([])}
                        className="text-green-300 hover:text-white transition-colors"
                    >
                        キャンセル
                    </button>
                </div>
            )}

            {/* 出荷ダイアログ */}
            <ShipmentDialog
                isOpen={isShipmentDialogOpen}
                onClose={() => setIsShipmentDialogOpen(false)}
                selectedIds={selectedIds}
                selectedTrees={selectedTreesData}
                onSuccess={handleShipmentSuccess}
            />
        </div>
    )
}
