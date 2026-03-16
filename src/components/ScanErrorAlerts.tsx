'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface ScanErrorLog {
    id: string
    tree_id: string | null
    details: {
        reason: string
        scanned_id?: string
        management_number?: string
        shipment_id?: string
    }
    actor: string
    created_at: string
}

interface GroupedError {
    key: string
    reason: string
    scanned_id?: string
    management_number?: string
    shipment_id?: string
    actor: string
    latest_at: string
    count: number
    ids: string[]
}

export default function ScanErrorAlerts() {
    const [alerts, setAlerts] = useState<ScanErrorLog[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const supabase = createClient()
        supabase
            .from('activity_logs')
            .select('id, tree_id, details, actor, created_at')
            .eq('action', 'scan_error')
            .is('resolved_at', null)
            .order('created_at', { ascending: false })
            .limit(100)
            .then(({ data }) => {
                setAlerts((data as ScanErrorLog[]) || [])
                setLoading(false)
            })
    }, [])

    const grouped = useMemo(() => {
        const map = new Map<string, GroupedError>()
        for (const alert of alerts) {
            const key = alert.details.scanned_id || alert.id
            const existing = map.get(key)
            if (existing) {
                existing.count++
                existing.ids.push(alert.id)
                if (alert.created_at > existing.latest_at) {
                    existing.latest_at = alert.created_at
                    existing.actor = alert.actor
                }
            } else {
                map.set(key, {
                    key,
                    reason: alert.details.reason,
                    scanned_id: alert.details.scanned_id,
                    management_number: alert.details.management_number,
                    shipment_id: alert.details.shipment_id,
                    actor: alert.actor,
                    latest_at: alert.created_at,
                    count: 1,
                    ids: [alert.id],
                })
            }
        }
        return Array.from(map.values()).sort((a, b) => b.latest_at.localeCompare(a.latest_at))
    }, [alerts])

    const handleResolve = async (group: GroupedError) => {
        const supabase = createClient()
        const now = new Date().toISOString()
        await supabase
            .from('activity_logs')
            .update({ resolved_at: now })
            .in('id', group.ids)

        setAlerts(prev => prev.filter(a => !group.ids.includes(a.id)))
    }

    if (loading || alerts.length === 0) return null

    return (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 mb-8">
            <h2 className="text-lg font-bold text-red-800 mb-3">
                スキャンエラー ({grouped.length}件{grouped.length !== alerts.length && `・計${alerts.length}回`})
            </h2>
            <div className="space-y-2">
                {grouped.map(group => (
                    <div
                        key={group.key}
                        className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-red-200"
                    >
                        <div className="flex-1 min-w-0">
                            <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded mr-2 ${
                                group.reason === 'not_in_db'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-yellow-500 text-white'
                            }`}>
                                {group.reason === 'not_in_db' ? 'DB未登録' : '対象外'}
                            </span>
                            <span className="text-sm font-mono text-gray-800">
                                {group.management_number || group.scanned_id?.slice(0, 8) + '...'}
                            </span>
                            {group.count > 1 && (
                                <span className="ml-1 text-xs text-red-600 font-bold">
                                    x{group.count}回
                                </span>
                            )}
                            {group.shipment_id && (
                                <Link
                                    href={`/shipments/${group.shipment_id}`}
                                    className="ml-2 text-xs text-blue-600 hover:underline"
                                >
                                    出荷詳細
                                </Link>
                            )}
                            <span className="ml-2 text-xs text-gray-400">
                                {new Date(group.latest_at).toLocaleString('ja-JP')}
                                {group.actor && ` / ${group.actor}`}
                            </span>
                        </div>
                        <button
                            onClick={() => handleResolve(group)}
                            className="ml-3 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-md whitespace-nowrap transition-colors"
                        >
                            処理済み
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}
