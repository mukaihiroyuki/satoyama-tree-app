'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Client {
    id: string
    name: string
}

interface ShipmentDialogProps {
    isOpen: boolean
    onClose: () => void
    selectedIds: string[]
    selectedTrees: { id: string; tree_number: number; species_name: string; price: number }[]
    onSuccess: () => void
}

export default function ShipmentDialog({ isOpen, onClose, selectedIds, selectedTrees, onSuccess }: ShipmentDialogProps) {
    const [clients, setClients] = useState<Client[]>([])
    const [selectedClientId, setSelectedClientId] = useState('')
    const [shippedAt, setShippedAt] = useState(new Date().toISOString().split('T')[0])
    const [notes, setNotes] = useState('')
    const [loading, setLoading] = useState(false)
    const [isAddingClient, setIsAddingClient] = useState(false)
    const [newClientName, setNewClientName] = useState('')

    useEffect(() => {
        if (isOpen) {
            fetchClients()
        }
    }, [isOpen])

    async function fetchClients() {
        const supabase = createClient()
        const { data } = await supabase.from('clients').select('id, name').order('name')
        setClients(data || [])
        if (data && data.length > 0 && !selectedClientId) {
            setSelectedClientId(data[0].id)
        }
    }

    async function handleAddClient() {
        if (!newClientName) return
        const supabase = createClient()
        const { data, error } = await supabase.from('clients').insert({ name: newClientName }).select().single()
        if (data) {
            setClients(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
            setSelectedClientId(data.id)
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
            const { data: shipment, error: shipmentError } = await supabase
                .from('shipments')
                .insert({
                    client_id: selectedClientId,
                    shipped_at: shippedAt,
                    notes: notes,
                    destination: clients.find(c => c.id === selectedClientId)?.name || ''
                })
                .select()
                .single()

            if (shipmentError) throw shipmentError

            // 2. 出荷明細の作成
            const items = selectedTrees.map(tree => ({
                shipment_id: shipment.id,
                tree_id: tree.id,
                unit_price: tree.price // 現在の価格を出荷時の単価として記録
            }))

            const { error: itemsError } = await supabase.from('shipment_items').insert(items)
            if (itemsError) throw itemsError

            // 3. 樹木のステータス更新
            const { error: updateError } = await supabase
                .from('trees')
                .update({ status: 'shipped' })
                .in('id', selectedIds)

            if (updateError) throw updateError

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
                                onChange={(e) => setSelectedClientId(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none"
                            >
                                <option value="" disabled>選択してください</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        )}
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
                            {selectedTrees.slice(0, 5).map(tree => (
                                <li key={tree.id} className="flex justify-between">
                                    <span className="text-gray-600">#{tree.tree_number} {tree.species_name}</span>
                                    <span className="font-mono">¥{tree.price.toLocaleString()}</span>
                                </li>
                            ))}
                            {selectedTrees.length > 5 && (
                                <li className="text-center text-gray-400 text-xs pt-1">他 {selectedTrees.length - 5} 本...</li>
                            )}
                        </ul>
                        <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-bold text-gray-800">
                            <span>合計金額</span>
                            <span>¥{selectedTrees.reduce((sum, t) => sum + t.price, 0).toLocaleString()}</span>
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
