'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface ClientInfo {
    id: string
    name: string
    portal_password: string | null
}

interface ShipmentSummary {
    id: string
    shipped_at: string
    receipt_completed_at: string | null
    item_count: number
    received_count: number
}

export default function ClientPortalPage({ params }: { params: Promise<{ clientId: string }> }) {
    const { clientId } = React.use(params)
    const [client, setClient] = useState<ClientInfo | null>(null)
    const [shipments, setShipments] = useState<ShipmentSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)
    const [authenticated, setAuthenticated] = useState(false)
    const [pinInput, setPinInput] = useState('')
    const [pinError, setPinError] = useState(false)

    async function fetchData() {
        const supabase = createClient()

        // クライアント情報
        const { data: clientData } = await supabase
            .from('clients')
            .select('id, name, portal_password')
            .eq('id', clientId)
            .single()

        if (!clientData) {
            setNotFound(true)
            setLoading(false)
            return
        }
        setClient(clientData)

        // パスワード認証チェック
        if (clientData.portal_password) {
            const sessionKey = `portal_auth_${clientId}`
            if (sessionStorage.getItem(sessionKey) === 'true') {
                setAuthenticated(true)
            }
        } else {
            setAuthenticated(true)
        }

        // このクライアントの出荷を取得
        const { data: shipmentsData } = await supabase
            .from('shipments')
            .select(`
                id,
                shipped_at,
                receipt_completed_at,
                shipment_items(id)
            `)
            .eq('client_id', clientId)
            .order('shipped_at', { ascending: false })

        // 受入チェック済み件数を取得（1000行制限回避）
        let allReceipts: { shipment_item_id: string }[] = []
        let rFrom = 0
        const R_PAGE_SIZE = 1000
        while (true) {
            const { data: rPage } = await supabase
                .from('client_receipts')
                .select('shipment_item_id')
                .eq('client_id', clientId)
                .range(rFrom, rFrom + R_PAGE_SIZE - 1)
            if (rPage) allReceipts = allReceipts.concat(rPage)
            if (!rPage || rPage.length < R_PAGE_SIZE) break
            rFrom += R_PAGE_SIZE
        }
        const receivedSet = new Set(allReceipts.map(r => r.shipment_item_id))

        const summaries: ShipmentSummary[] = (shipmentsData || []).map(s => {
            const items = s.shipment_items || []
            return {
                id: s.id,
                shipped_at: s.shipped_at,
                receipt_completed_at: (s as unknown as { receipt_completed_at: string | null }).receipt_completed_at,
                item_count: items.length,
                received_count: items.filter((i: { id: string }) => receivedSet.has(i.id)).length,
            }
        })

        setShipments(summaries)
        setLoading(false)
    }

    useEffect(() => {
        fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientId])

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-500">読み込み中...</p>
            </div>
        )
    }

    if (notFound || !client) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-500">ページが見つかりません</p>
            </div>
        )
    }

    // パスワード認証画面
    if (!authenticated) {
        const handlePinSubmit = () => {
            if (pinInput === client.portal_password) {
                sessionStorage.setItem(`portal_auth_${clientId}`, 'true')
                setAuthenticated(true)
                setPinError(false)
            } else {
                setPinError(true)
                setPinInput('')
            }
        }
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="bg-white rounded-2xl shadow-lg p-8 w-80 text-center">
                    <div className="text-4xl mb-4">🔒</div>
                    <h1 className="text-lg font-bold text-gray-800 mb-1">{client.name}</h1>
                    <p className="text-sm text-gray-500 mb-6">アクセスコードを入力してください</p>
                    <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        value={pinInput}
                        onChange={(e) => {
                            setPinInput(e.target.value)
                            setPinError(false)
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handlePinSubmit()
                        }}
                        placeholder="----"
                        className={`w-full text-center text-2xl tracking-[0.5em] border-2 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                            pinError ? 'border-red-400 bg-red-50' : 'border-gray-300'
                        }`}
                        autoFocus
                    />
                    {pinError && (
                        <p className="text-red-500 text-sm mt-2 font-bold">コードが違います</p>
                    )}
                    <button
                        onClick={handlePinSubmit}
                        disabled={!pinInput}
                        className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white py-3 rounded-xl font-bold transition-colors"
                    >
                        開く
                    </button>
                </div>
            </div>
        )
    }

    const activeShipments = shipments.filter(s => !s.receipt_completed_at)
    const completedShipments = shipments.filter(s => s.receipt_completed_at)

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            <header className="bg-emerald-700 text-white px-4 py-6">
                <div className="max-w-3xl mx-auto">
                    <p className="text-emerald-200 text-xs font-bold uppercase tracking-wider">納品ポータル</p>
                    <h1 className="text-2xl font-black mt-1">{client.name}</h1>
                    <p className="text-emerald-200 text-sm mt-1">
                        {shipments.length} 件の出荷
                    </p>
                </div>
            </header>

            <main className="max-w-3xl mx-auto p-4 space-y-6">
                {/* アクティブな出荷 */}
                {activeShipments.length > 0 && (
                    <div>
                        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">受入待ち</h2>
                        <div className="space-y-3">
                            {activeShipments.map(s => (
                                <Link
                                    key={s.id}
                                    href={`/c/${clientId}/s/${s.id}`}
                                    className="block bg-white rounded-xl shadow-sm border-2 border-emerald-200 p-4 hover:bg-emerald-50 transition-colors"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-gray-800 text-lg">{s.shipped_at}</span>
                                        <span className="text-sm font-bold text-emerald-700">{s.item_count} 本</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                                        <div
                                            className="h-2 rounded-full bg-blue-500 transition-all"
                                            style={{ width: `${s.item_count > 0 ? (s.received_count / s.item_count) * 100 : 0}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        {s.received_count}/{s.item_count} 本チェック済み
                                    </p>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* 完了済み出荷 */}
                {completedShipments.length > 0 && (
                    <div>
                        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">受入済み</h2>
                        <div className="space-y-2">
                            {completedShipments.map(s => (
                                <Link
                                    key={s.id}
                                    href={`/c/${clientId}/s/${s.id}`}
                                    className="block bg-gray-50 rounded-xl border border-gray-200 p-3 hover:bg-gray-100 transition-colors opacity-60"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="font-bold text-gray-600">{s.shipped_at}</span>
                                            <span className="text-sm text-gray-400 ml-3">{s.item_count} 本</span>
                                        </div>
                                        <span className="text-xs text-emerald-600 font-bold">受入完了</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {shipments.length === 0 && (
                    <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
                        まだ出荷データがありません
                    </div>
                )}

                <p className="text-center text-xs text-gray-400">
                    Powered by 里山樹木管理システム
                </p>
            </main>
        </div>
    )
}
