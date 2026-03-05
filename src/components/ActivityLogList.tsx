'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ActivityLog {
    id: string
    action: string
    details: Record<string, unknown> | null
    actor: string | null
    created_at: string
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

export default function ActivityLogList({ treeId }: { treeId: string }) {
    const [logs, setLogs] = useState<ActivityLog[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchLogs() {
            const supabase = createClient()
            const { data } = await supabase
                .from('activity_logs')
                .select('id, action, details, actor, created_at')
                .eq('tree_id', treeId)
                .order('created_at', { ascending: false })
                .limit(20)
            setLogs(data || [])
            setLoading(false)
        }
        fetchLogs()
    }, [treeId])

    if (loading) return null
    if (logs.length === 0) return null

    return (
        <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">操作履歴</h2>
            <div className="space-y-3">
                {logs.map(log => {
                    const action = ACTION_LABELS[log.action] || { label: log.action, color: 'bg-gray-100 text-gray-700' }
                    const details = formatDetails(log.details)
                    return (
                        <div key={log.id} className="flex items-start gap-3 text-sm">
                            <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-bold ${action.color}`}>
                                {action.label}
                            </span>
                            <div className="flex-1 min-w-0">
                                {details && (
                                    <p className="text-gray-600 truncate">{details}</p>
                                )}
                                <p className="text-gray-400 text-xs">
                                    {new Date(log.created_at).toLocaleString('ja-JP')}
                                    {log.actor && <span className="ml-2 font-bold text-gray-500">{log.actor}</span>}
                                </p>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
