'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Shipment {
    id: string
    shipped_at: string
    notes: string | null
    client: {
        name: string
    } | { name: string }[] | null
    shipment_items: {
        id: string
        unit_price: number
    }[]
}

export default function ShipmentsPage() {
    const [shipments, setShipments] = useState<Shipment[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchShipments = async () => {
            const supabase = createClient()
            const { data } = await supabase
                .from('shipments')
                .select(`
                    id,
                    shipped_at,
                    notes,
                    client:clients(name),
                    shipment_items(id, unit_price)
                `)
                .order('shipped_at', { ascending: false })
                .order('created_at', { ascending: false })

            setShipments(data || [])
            setLoading(false)
        }
        fetchShipments()
    }, [])

    if (loading) return <div className="p-8">読み込み中...</div>

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            <header className="bg-white border-b border-gray-200 px-4 py-6">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="text-blue-600">← 戻る</Link>
                        <h1 className="text-xl font-bold text-gray-800">📦 出荷履歴</h1>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-4 sm:p-8">
                {shipments.length === 0 ? (
                    <div className="bg-white rounded-xl shadow p-12 text-center text-gray-500">
                        出荷履歴はまだありません
                    </div>
                ) : (
                    <div className="space-y-4">
                        {shipments.map((s) => {
                            const itemCount = s.shipment_items?.length || 0
                            const totalPrice = s.shipment_items?.reduce((sum, item) => sum + (item.unit_price || 0), 0) || 0

                            return (
                                <div key={s.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                                    <div className="p-5 flex flex-wrap items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-sm font-bold">
                                                {s.shipped_at}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-800">
                                                    {Array.isArray(s.client) ? s.client[0]?.name : s.client?.name || '不明なクライアント'}
                                                </h3>
                                                <p className="text-xs text-gray-400 mt-0.5">{itemCount} 本の樹木</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-blue-700">¥{totalPrice.toLocaleString()}</p>
                                            <p className="text-[10px] text-gray-400 font-mono uppercase tracking-tighter">TOTAL AMOUNT</p>
                                        </div>
                                    </div>
                                    {s.notes && (
                                        <div className="px-5 pb-4">
                                            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 border border-gray-100">
                                                💬 {s.notes}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}

                <div className="mt-8 bg-blue-900 border border-blue-800 rounded-2xl p-6 text-white shadow-xl">
                    <h3 className="font-bold flex items-center gap-2 text-blue-300">
                        ✨ 社長へのアピールポイント
                    </h3>
                    <p className="text-sm mt-3 opacity-90 leading-relaxed">
                        一本ずつの在庫管理だけでなく、「いつ・誰に、まとまっていくらで売れたか」という**商売の流れ**が見えるようにしたぜ。<br />
                        これが「単なる記録アプリ」と「儲けるための管理アプリ」の境目なんだぜ、相棒！
                    </p>
                </div>
            </main>
        </div>
    )
}
