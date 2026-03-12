'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface ActivityLog {
    id: string
    tree_id: string | null
    action: string
    details: Record<string, unknown> | null
    actor: string | null
    created_at: string
    tree: { management_number: string | null; species: { name: string } | null } | null
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
    create: { label: '登録', color: 'bg-green-100 text-green-700' },
    edit: { label: '編集', color: 'bg-blue-100 text-blue-700' },
    reserve: { label: '予約', color: 'bg-yellow-100 text-yellow-700' },
    cancel_reserve: { label: '予約取消', color: 'bg-orange-100 text-orange-700' },
    ship: { label: '出荷', color: 'bg-purple-100 text-purple-700' },
    cancel_ship: { label: '出荷取消', color: 'bg-red-100 text-red-700' },
    delete: { label: '削除', color: 'bg-red-100 text-red-700' },
    estimate: { label: '見積', color: 'bg-emerald-100 text-emerald-700' },
    scan_error: { label: 'スキャンエラー', color: 'bg-red-200 text-red-800' },
}

function formatDetails(details: Record<string, unknown> | null): string {
    if (!details) return ''
    const parts: string[] = []
    for (const [key, value] of Object.entries(details)) {
        if (key === 'management_number') continue
        parts.push(`${key}: ${String(value)}`)
    }
    return parts.join(', ')
}

export default function LogsPage() {
    const [logs, setLogs] = useState<ActivityLog[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<string>('all')
    const [limit, setLimit] = useState(50)

    useEffect(() => {
        async function fetchLogs() {
            setLoading(true)
            const supabase = createClient()
            let query = supabase
                .from('activity_logs')
                .select('id, tree_id, action, details, actor, created_at, tree:trees(management_number, species:species_master(name))')
                .order('created_at', { ascending: false })
                .limit(limit)

            if (filter !== 'all') {
                query = query.eq('action', filter)
            }

            const { data } = await query
            setLogs((data as unknown as ActivityLog[]) || [])
            setLoading(false)
        }
        fetchLogs()
    }, [filter, limit])

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
            <header className="bg-white shadow-sm border-b border-green-200">
                <div className="max-w-3xl mx-auto px-4 py-6">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="text-green-600 hover:text-green-800">
                            &larr; 戻る
                        </Link>
                        <h1 className="text-2xl font-bold text-green-800">操作ログ</h1>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-6">
                {/* フィルター */}
                <div className="flex flex-wrap gap-2 mb-4">
                    {[
                        { value: 'all', label: 'すべて' },
                        { value: 'create', label: '登録' },
                        { value: 'edit', label: '編集' },
                        { value: 'reserve', label: '予約' },
                        { value: 'ship', label: '出荷' },
                        { value: 'cancel_reserve', label: '予約取消' },
                        { value: 'cancel_ship', label: '出荷取消' },
                        { value: 'delete', label: '削除' },
                        { value: 'estimate', label: '見積' },
                        { value: 'scan_error', label: 'スキャンエラー' },
                    ].map(f => (
                        <button
                            key={f.value}
                            onClick={() => setFilter(f.value)}
                            className={`px-3 py-1 rounded-full text-sm font-bold transition-colors ${
                                filter === f.value
                                    ? 'bg-green-600 text-white'
                                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* ログ一覧 */}
                {loading ? (
                    <p className="text-center text-gray-500 py-8">読み込み中...</p>
                ) : logs.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">ログがありません</p>
                ) : (
                    <div className="bg-white rounded-xl shadow-lg divide-y divide-gray-100">
                        {logs.map(log => {
                            const action = ACTION_LABELS[log.action] || { label: log.action, color: 'bg-gray-100 text-gray-700' }
                            const details = formatDetails(log.details)
                            const treeName = log.tree
                                ? `${log.tree.management_number || ''} ${log.tree.species?.name || ''}`.trim()
                                : log.details?.management_number
                                    ? String(log.details.management_number)
                                    : null

                            return (
                                <div key={log.id} className="px-4 py-3 flex items-start gap-3">
                                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-bold mt-0.5 ${action.color}`}>
                                        {action.label}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {treeName && (
                                                log.tree_id ? (
                                                    <Link
                                                        href={`/trees/${log.tree_id}`}
                                                        className="font-bold text-green-700 hover:underline text-sm"
                                                    >
                                                        {treeName}
                                                    </Link>
                                                ) : (
                                                    <span className="font-bold text-gray-500 text-sm">{treeName}</span>
                                                )
                                            )}
                                            {log.actor && (
                                                <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                                    {log.actor}
                                                </span>
                                            )}
                                        </div>
                                        {details && (
                                            <p className="text-xs text-gray-500 mt-0.5 truncate">{details}</p>
                                        )}
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {new Date(log.created_at).toLocaleString('ja-JP')}
                                        </p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* もっと読み込む */}
                {logs.length >= limit && (
                    <div className="text-center py-4">
                        <button
                            onClick={() => setLimit(prev => prev + 50)}
                            className="text-green-600 hover:text-green-800 font-bold text-sm"
                        >
                            もっと読み込む
                        </button>
                    </div>
                )}
            </main>
        </div>
    )
}
