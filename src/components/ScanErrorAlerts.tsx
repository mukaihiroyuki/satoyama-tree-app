'use client'

import { useState, useEffect } from 'react'
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
            .limit(20)
            .then(({ data }) => {
                setAlerts((data as ScanErrorLog[]) || [])
                setLoading(false)
            })
    }, [])

    const handleResolve = async (id: string) => {
        const supabase = createClient()
        await supabase
            .from('activity_logs')
            .update({ resolved_at: new Date().toISOString() })
            .eq('id', id)

        setAlerts(prev => prev.filter(a => a.id !== id))
    }

    if (loading || alerts.length === 0) return null

    return (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 mb-8">
            <h2 className="text-lg font-bold text-red-800 mb-3">
                スキャンエラー ({alerts.length}件)
            </h2>
            <div className="space-y-2">
                {alerts.map(alert => (
                    <div
                        key={alert.id}
                        className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-red-200"
                    >
                        <div className="flex-1 min-w-0">
                            <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded mr-2 ${
                                alert.details.reason === 'not_in_db'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-yellow-500 text-white'
                            }`}>
                                {alert.details.reason === 'not_in_db' ? 'DB未登録' : '対象外'}
                            </span>
                            <span className="text-sm font-mono text-gray-800">
                                {alert.details.management_number || alert.details.scanned_id?.slice(0, 8) + '...'}
                            </span>
                            {alert.details.shipment_id && (
                                <Link
                                    href={`/shipments/${alert.details.shipment_id}`}
                                    className="ml-2 text-xs text-blue-600 hover:underline"
                                >
                                    出荷詳細
                                </Link>
                            )}
                            <span className="ml-2 text-xs text-gray-400">
                                {new Date(alert.created_at).toLocaleString('ja-JP')}
                                {alert.actor && ` / ${alert.actor}`}
                            </span>
                        </div>
                        <button
                            onClick={() => handleResolve(alert.id)}
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
