'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Client {
    id: string
    name: string
    tel: string | null
    address: string | null
    notes: string | null
    default_rate: number | null
}

export default function ClientsPage() {
    const [clients, setClients] = useState<Client[]>([])
    const [loading, setLoading] = useState(true)
    const [name, setName] = useState('')
    const [address, setAddress] = useState('')
    const [notes, setNotes] = useState('')
    const [defaultRate, setDefaultRate] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [editingRateId, setEditingRateId] = useState<string | null>(null)
    const [editingRateValue, setEditingRateValue] = useState('')

    const fetchClients = async () => {
        const supabase = createClient()
        const { data } = await supabase.from('clients').select('*').order('name')
        setClients(data || [])
    }

    useEffect(() => {
        const load = async () => {
            const supabase = createClient()
            const { data } = await supabase.from('clients').select('*').order('name')
            setClients(data || [])
            setLoading(false)
        }
        load()
    }, [])

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) return
        setSubmitting(true)

        const supabase = createClient()
        const parsedRate = defaultRate.trim() ? parseFloat(defaultRate) : null
        const { error } = await supabase
            .from('clients')
            .insert({
                name: name.trim(),
                address: address.trim() || null,
                notes: notes.trim() || null,
                default_rate: parsedRate,
            })

        if (error) {
            alert('登録に失敗しました: ' + error.message)
        } else {
            setName('')
            setAddress('')
            setNotes('')
            setDefaultRate('')
            await fetchClients()
        }
        setSubmitting(false)
    }

    const handleDelete = async (c: Client) => {
        if (!confirm(`「${c.name}」を削除しますか？`)) return

        setDeleting(c.id)
        const supabase = createClient()
        const { error } = await supabase
            .from('clients')
            .delete()
            .eq('id', c.id)

        if (error) {
            alert('削除に失敗しました: ' + error.message)
        } else {
            await fetchClients()
        }
        setDeleting(null)
    }

    const handleRateUpdate = async (clientId: string) => {
        const parsedRate = editingRateValue.trim() ? parseFloat(editingRateValue) : null
        const supabase = createClient()
        const { error } = await supabase
            .from('clients')
            .update({ default_rate: parsedRate })
            .eq('id', clientId)

        if (error) {
            alert('掛け率の更新に失敗しました: ' + error.message)
        } else {
            await fetchClients()
        }
        setEditingRateId(null)
    }

    const formatRate = (rate: number | null) => {
        if (rate === null || rate === 1) return '-'
        return `${Math.round(rate * 100)}%`
    }

    if (loading) return <div className="p-8">読み込み中...</div>

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-200 px-4 py-6">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="text-green-600">← 戻る</Link>
                        <h1 className="text-xl font-bold text-gray-800">👥 クライアントマスター</h1>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-4 sm:p-8">
                {/* 新規追加フォーム */}
                <form onSubmit={handleAdd} className="bg-white rounded-xl shadow p-6 mb-6">
                    <h2 className="text-sm font-bold text-gray-600 mb-4">新しいクライアントを追加</h2>
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="text"
                                placeholder="名前（必須）"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                required
                            />
                            <input
                                type="text"
                                placeholder="住所"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="text"
                                placeholder="備考"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                            <input
                                type="number"
                                placeholder="掛け率（例: 0.70）"
                                value={defaultRate}
                                onChange={(e) => setDefaultRate(e.target.value)}
                                step="0.01"
                                min="0"
                                max="1"
                                className="w-40 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                            <button
                                type="submit"
                                disabled={submitting || !name.trim()}
                                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-6 py-2 rounded-lg font-bold text-sm transition-colors whitespace-nowrap"
                            >
                                {submitting ? '登録中...' : '追加'}
                            </button>
                        </div>
                    </div>
                </form>

                {/* クライアント一覧 */}
                <div className="bg-white rounded-xl shadow overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-sm font-bold text-gray-600">名前</th>
                                <th className="px-6 py-4 text-sm font-bold text-gray-600">住所・備考</th>
                                <th className="px-6 py-4 text-sm font-bold text-gray-600">掛け率</th>
                                <th className="px-6 py-4 text-sm font-bold text-gray-600">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {clients.map((c) => (
                                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-bold text-gray-800">{c.name}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        <div>{c.address || '-'}</div>
                                        <div className="text-xs text-gray-400 mt-1">{c.notes}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        {editingRateId === c.id ? (
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    value={editingRateValue}
                                                    onChange={(e) => setEditingRateValue(e.target.value)}
                                                    step="0.01"
                                                    min="0"
                                                    max="1"
                                                    className="w-20 border border-green-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleRateUpdate(c.id)
                                                        if (e.key === 'Escape') setEditingRateId(null)
                                                    }}
                                                />
                                                <button
                                                    onClick={() => handleRateUpdate(c.id)}
                                                    className="text-green-600 hover:text-green-700 text-xs font-bold"
                                                >
                                                    保存
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setEditingRateId(c.id)
                                                    setEditingRateValue(c.default_rate !== null && c.default_rate !== 1 ? String(c.default_rate) : '')
                                                }}
                                                className="text-gray-600 hover:text-green-600 cursor-pointer"
                                                title="クリックして編集"
                                            >
                                                {formatRate(c.default_rate)}
                                            </button>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => handleDelete(c)}
                                            disabled={deleting === c.id}
                                            className="text-red-500 hover:text-red-700 text-xs font-bold"
                                        >
                                            {deleting === c.id ? '削除中...' : '削除'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {clients.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                                        まだ登録されていません
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    )
}
