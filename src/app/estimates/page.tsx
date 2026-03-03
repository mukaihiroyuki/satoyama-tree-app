'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { EstimateStatus } from '@/types/database'

interface EstimateRow {
    id: string
    estimate_number: string
    status: EstimateStatus
    rate: number | null
    issued_at: string | null
    notes: string | null
    assignee: string | null
    created_at: string
    client: { name: string } | { name: string }[] | null
    estimate_items: { unit_price: number }[]
}

const statusColors: Record<string, string> = {
    '下書き': 'bg-gray-100 text-gray-700',
    '発行済': 'bg-emerald-100 text-emerald-700',
    '出荷済': 'bg-blue-100 text-blue-700',
}

export default function EstimatesPage() {
    const [estimates, setEstimates] = useState<EstimateRow[]>([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState('')

    useEffect(() => {
        async function fetch() {
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
                    client:clients(name),
                    estimate_items(unit_price)
                `)
                .order('created_at', { ascending: false })

            if (error) console.error('Estimates fetch error:', error)
            setEstimates((data as EstimateRow[]) || [])
            setLoading(false)
        }
        fetch()
    }, [])

    const filtered = useMemo(() => {
        if (!statusFilter) return estimates
        return estimates.filter(e => e.status === statusFilter)
    }, [estimates, statusFilter])

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
                <p className="text-green-700">読み込み中...</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 pb-12">
            <header className="bg-white shadow-sm border-b border-green-200">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/" className="text-green-600 hover:text-green-800">← 戻る</Link>
                            <h1 className="text-2xl font-bold text-green-800">見積一覧</h1>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* フィルター */}
                <div className="bg-white rounded-xl shadow p-4 mb-6">
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="min-w-[150px]">
                            <label className="block text-sm font-medium text-gray-600 mb-1">ステータス</label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            >
                                <option value="">すべて</option>
                                <option value="下書き">下書き</option>
                                <option value="発行済">発行済</option>
                                <option value="出荷済">出荷済</option>
                            </select>
                        </div>
                    </div>
                </div>

                {filtered.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                        <p className="text-gray-500 text-lg">
                            {estimates.length === 0 ? 'まだ見積もりがありません' : '条件に一致する見積もりがありません'}
                        </p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-green-50 border-b border-green-200">
                                    <tr>
                                        <th className="px-4 py-3 text-sm font-semibold text-green-800">見積番号</th>
                                        <th className="px-4 py-3 text-sm font-semibold text-green-800">クライアント</th>
                                        <th className="px-4 py-3 text-sm font-semibold text-green-800">掛け率</th>
                                        <th className="px-4 py-3 text-sm font-semibold text-green-800 text-right">本数</th>
                                        <th className="px-4 py-3 text-sm font-semibold text-green-800 text-right">合計金額</th>
                                        <th className="px-4 py-3 text-sm font-semibold text-green-800">ステータス</th>
                                        <th className="px-4 py-3 text-sm font-semibold text-green-800">担当者</th>
                                        <th className="px-4 py-3 text-sm font-semibold text-green-800">発行日</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filtered.map((est) => {
                                        const clientName = Array.isArray(est.client)
                                            ? est.client[0]?.name
                                            : est.client?.name || '-'
                                        const totalAmount = est.estimate_items.reduce((sum, i) => sum + i.unit_price, 0)
                                        return (
                                            <tr
                                                key={est.id}
                                                className="hover:bg-green-50 transition-colors cursor-pointer"
                                                onClick={() => window.location.href = `/estimates/${est.id}`}
                                            >
                                                <td className="px-4 py-3 font-mono text-sm font-bold text-gray-600">
                                                    {est.estimate_number}
                                                </td>
                                                <td className="px-4 py-3 font-medium">{clientName}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">
                                                    {est.rate !== null ? `${Math.round(est.rate * 100)}%` : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-right text-sm">
                                                    {est.estimate_items.length} 本
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-green-700">
                                                    &yen;{totalAmount.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusColors[est.status] || ''}`}>
                                                        {est.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600">
                                                    {est.assignee || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600">
                                                    {est.issued_at || '-'}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-4 py-3 bg-gray-50 border-t">
                            <p className="text-sm text-gray-600">
                                {filtered.length === estimates.length
                                    ? `全 ${estimates.length} 件`
                                    : `${filtered.length} 件 / 全 ${estimates.length} 件`
                                }
                            </p>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
