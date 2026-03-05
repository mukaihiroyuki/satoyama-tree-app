'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logActivityBulk } from '@/lib/activity-log'

interface Client {
    id: string
    name: string
    default_rate: number | null
}

interface ShipmentDialogProps {
    isOpen: boolean
    onClose: () => void
    selectedIds: string[]
    selectedTrees: { id: string; management_number: string | null; species_name: string; price: number }[]
    onSuccess: () => void
    estimateId?: string
    defaultClientId?: string
    defaultRate?: number
}

export default function ShipmentDialog({ isOpen, onClose, selectedIds, selectedTrees, onSuccess, estimateId, defaultClientId, defaultRate }: ShipmentDialogProps) {
    const [clients, setClients] = useState<Client[]>([])
    const [selectedClientId, setSelectedClientId] = useState('')
    const [shippedAt, setShippedAt] = useState(new Date().toISOString().split('T')[0])
    const [notes, setNotes] = useState('')
    const [rate, setRate] = useState(1)
    const [loading, setLoading] = useState(false)
    const [isAddingClient, setIsAddingClient] = useState(false)
    const [newClientName, setNewClientName] = useState('')

    useEffect(() => {
        async function fetchClients() {
            const supabase = createClient()
            const { data } = await supabase.from('clients').select('id, name, default_rate').order('name')
            setClients(data || [])
            if (defaultClientId) {
                setSelectedClientId(defaultClientId)
                if (defaultRate !== undefined) setRate(defaultRate)
            } else if (data && data.length > 0 && !selectedClientId) {
                setSelectedClientId(data[0].id)
                setRate(data[0].default_rate ?? 1)
            }
        }
        if (isOpen) {
            fetchClients()
        }
    }, [isOpen, selectedClientId, defaultClientId, defaultRate])

    async function handleAddClient() {
        if (!newClientName) return
        const supabase = createClient()
        const { data } = await supabase.from('clients').insert({ name: newClientName }).select().single()
        if (data) {
            setClients(prev => [...prev, { ...data, default_rate: null }].sort((a, b) => a.name.localeCompare(b.name)))
            setSelectedClientId(data.id)
            setRate(1)
            setNewClientName('')
            setIsAddingClient(false)
        }
    }

    async function handleSubmit() {
        if (!selectedClientId) {
            alert('クライアントを選択してください')
            return
        }

        setLoading(true)
        const supabase = createClient()

        try {
            // 1. 出荷ヘッダーの作成
            const insertData: Record<string, unknown> = {
                client_id: selectedClientId,
                shipped_at: shippedAt,
                notes: notes,
                destination: clients.find(c => c.id === selectedClientId)?.name || '',
            }
            if (estimateId) insertData.estimate_id = estimateId

            const { data: shipment, error: shipmentError } = await supabase
                .from('shipments')
                .insert(insertData)
                .select()
                .single()

            if (shipmentError) throw shipmentError

            // 2. 出荷明細の作成
            const items = selectedTrees.map(tree => ({
                shipment_id: shipment.id,
                tree_id: tree.id,
                unit_price: Math.round(tree.price * rate), // 上代 × 掛け率 = 出荷単価
                original_price: tree.price,
            }))

            const { error: itemsError } = await supabase.from('shipment_items').insert(items)
            if (itemsError) throw itemsError

            // 3. 樹木のステータス更新（出荷日はshipmentsテーブルから参照）
            const { error: updateError } = await supabase
                .from('trees')
                .update({ status: 'shipped' })
                .in('id', selectedIds)

            if (updateError) throw updateError

            // 4. 見積ステータスを「出荷済」に更新（見積経由の場合）
            if (estimateId) {
                await supabase
                    .from('estimates')
                    .update({ status: '出荷済', updated_at: new Date().toISOString() })
                    .eq('id', estimateId)
            }

            await logActivityBulk('ship', selectedIds)
            onSuccess()
            onClose()
        } catch (error) {
            console.error('出荷登録エラー:', error)
            alert('出荷登録に失敗しました')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-800">📦 出荷登録</h2>
                    <p className="text-sm text-gray-500 mt-1">{selectedIds.length} 本の樹木を出荷します</p>
                </div>

                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                    {/* クライアント選択 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between">
                            クライアント
                            <button
                                onClick={() => setIsAddingClient(!isAddingClient)}
                                className="text-green-600 hover:text-green-700 text-xs font-bold"
                            >
                                {isAddingClient ? 'キャンセル' : '＋ 新規登録'}
                            </button>
                        </label>

                        {isAddingClient ? (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newClientName}
                                    onChange={(e) => setNewClientName(e.target.value)}
                                    placeholder="会社名・氏名"
                                    className="flex-1 border border-green-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none"
                                    autoFocus
                                />
                                <button
                                    onClick={handleAddClient}
                                    className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold"
                                >
                                    保存
                                </button>
                            </div>
                        ) : (
                            <select
                                value={selectedClientId}
                                onChange={(e) => {
                                    setSelectedClientId(e.target.value)
                                    const selected = clients.find(c => c.id === e.target.value)
                                    setRate(selected?.default_rate ?? 1)
                                }}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none"
                            >
                                <option value="" disabled>選択してください</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* 掛け率 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">掛け率</label>
                        <input
                            type="number"
                            value={rate}
                            onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
                            step="0.01"
                            min="0"
                            max="1"
                            className="w-32 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none"
                        />
                        <span className="ml-2 text-sm text-gray-500">
                            {rate < 1 ? `${Math.round(rate * 100)}%（${Math.round(rate * 10)}掛け）` : '掛け率なし（上代そのまま）'}
                        </span>
                    </div>

                    {/* 出荷日 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">出荷日</label>
                        <input
                            type="date"
                            value={shippedAt}
                            onChange={(e) => setShippedAt(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none"
                        />
                    </div>

                    {/* 備考 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">備考 (任意)</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none h-20"
                            placeholder="配送指示や現場名など"
                        />
                    </div>

                    {/* 選択ツリー確認 */}
                    <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">出荷対象明細</p>
                        <ul className="text-sm space-y-1">
                            {selectedTrees.slice(0, 5).map(tree => {
                                const unitPrice = Math.round(tree.price * rate)
                                return (
                                    <li key={tree.id} className="flex justify-between items-center">
                                        <span className="text-gray-600">{tree.management_number || '-'} {tree.species_name}</span>
                                        {rate < 1 ? (
                                            <span className="font-mono text-right">
                                                <span className="text-gray-400 line-through text-xs mr-1">¥{tree.price.toLocaleString()}</span>
                                                <span>¥{unitPrice.toLocaleString()}</span>
                                            </span>
                                        ) : (
                                            <span className="font-mono">¥{tree.price.toLocaleString()}</span>
                                        )}
                                    </li>
                                )
                            })}
                            {selectedTrees.length > 5 && (
                                <li className="text-center text-gray-400 text-xs pt-1">他 {selectedTrees.length - 5} 本...</li>
                            )}
                        </ul>
                        <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-bold text-gray-800">
                            <span>合計金額</span>
                            <span>¥{selectedTrees.reduce((sum, t) => sum + Math.round(t.price * rate), 0).toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-gray-50 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-white transition-colors"
                        disabled={loading}
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-50"
                        disabled={loading || !selectedClientId}
                    >
                        {loading ? '登録中...' : '出荷を確定する'}
                    </button>
                </div>
            </div>
        </div>
    )
}
