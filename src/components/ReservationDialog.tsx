'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logActivityBulk } from '@/lib/activity-log'

interface Client {
    id: string
    name: string
}

interface ReservationDialogProps {
    isOpen: boolean
    onClose: () => void
    selectedIds: string[]
    selectedTrees: { id: string; management_number: string | null; species_name: string; price: number }[]
    onSuccess: () => void
    defaultClientId?: string
}

export default function ReservationDialog({ isOpen, onClose, selectedIds, selectedTrees, onSuccess, defaultClientId }: ReservationDialogProps) {
    const [clients, setClients] = useState<Client[]>([])
    const [selectedClientId, setSelectedClientId] = useState('')
    const [notes, setNotes] = useState('')
    const [estimateNumber, setEstimateNumber] = useState('')
    const [loading, setLoading] = useState(false)
    const [isAddingClient, setIsAddingClient] = useState(false)
    const [newClientName, setNewClientName] = useState('')
    const [addingClient, setAddingClient] = useState(false)

    useEffect(() => {
        async function fetchClients() {
            const supabase = createClient()
            const { data } = await supabase.from('clients').select('id, name').order('name')
            setClients(data || [])
            if (defaultClientId) {
                setSelectedClientId(defaultClientId)
            } else if (data && data.length > 0 && !selectedClientId) {
                setSelectedClientId(data[0].id)
            }
        }
        if (isOpen) {
            fetchClients()
        }
    }, [isOpen, selectedClientId, defaultClientId])

    async function handleAddClient() {
        if (!newClientName) return
        setAddingClient(true)
        try {
            const supabase = createClient()
            const { data, error } = await supabase.from('clients').insert({ name: newClientName }).select().single()
            if (error) {
                alert('クライアント登録に失敗しました')
                return
            }
            if (data) {
                setClients(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
                setSelectedClientId(data.id)
                setNewClientName('')
                setIsAddingClient(false)
            }
        } finally {
            setAddingClient(false)
        }
    }

    async function handleSubmit() {
        if (!selectedClientId) {
            alert('クライアントを選択してください')
            return
        }

        // 備考欄に入力がある場合、上書き警告
        if (notes.trim()) {
            const confirmed = confirm(
                `⚠️ 備考欄に入力があります。\n\n` +
                `選択した ${selectedIds.length} 本すべての備考が「${notes.trim()}」に上書きされます。\n` +
                `（既存の備考は消えます）\n\n` +
                `本当によろしいですか？`
            )
            if (!confirmed) return
        }

        setLoading(true)
        const supabase = createClient()

        try {
            // 樹木のステータスを予約済みに変更 + client_idを設定
            const updateData: Record<string, string> = {
                status: 'reserved',
                client_id: selectedClientId,
            }
            if (notes.trim()) {
                updateData.notes = notes.trim()
            }
            if (estimateNumber.trim()) {
                updateData.estimate_number = estimateNumber.trim()
            }

            const { error } = await supabase
                .from('trees')
                .update(updateData)
                .in('id', selectedIds)

            if (error) throw error

            await logActivityBulk('reserve', selectedIds)
            onSuccess()
            onClose()
        } catch (error) {
            console.error('予約登録エラー:', error)
            alert('予約登録に失敗しました')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-800">📋 予約登録</h2>
                    <p className="text-sm text-gray-500 mt-1">{selectedIds.length} 本の樹木を予約します</p>
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
                                    disabled={addingClient || !newClientName.trim()}
                                    className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold disabled:bg-gray-400"
                                >
                                    {addingClient ? '...' : '保存'}
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

                    {/* 見積り番号 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">見積り番号 (任意)</label>
                        <input
                            type="text"
                            value={estimateNumber}
                            onChange={(e) => setEstimateNumber(e.target.value)}
                            placeholder="例: EST-2026-001"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none"
                        />
                    </div>

                    {/* 備考 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">備考 (任意)</label>
                        <p className="text-xs text-orange-600 mb-1">⚠️ 入力すると選択した全樹木の備考が上書きされます</p>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 outline-none h-20"
                            placeholder="予約に関するメモなど"
                        />
                    </div>

                    {/* 選択ツリー確認 */}
                    <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">予約対象明細</p>
                        <ul className="text-sm space-y-1">
                            {selectedTrees.slice(0, 5).map(tree => (
                                <li key={tree.id} className="flex justify-between">
                                    <span className="text-gray-600">{tree.management_number || '-'} {tree.species_name}</span>
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
                        className="flex-[2] bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-3 rounded-xl font-bold shadow-lg shadow-yellow-200 transition-all active:scale-95 disabled:opacity-50"
                        disabled={loading || !selectedClientId}
                    >
                        {loading ? '登録中...' : '予約を確定する'}
                    </button>
                </div>
            </div>
        </div>
    )
}
