'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Species {
    id: string
    name: string
    name_kana: string | null
    code: string | null
    created_at: string
}

export default function SpeciesPage() {
    const [species, setSpecies] = useState<Species[]>([])
    const [loading, setLoading] = useState(true)
    const [name, setName] = useState('')
    const [nameKana, setNameKana] = useState('')
    const [code, setCode] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editCode, setEditCode] = useState('')
    const [savingCode, setSavingCode] = useState(false)
    const [usageCounts, setUsageCounts] = useState<Record<string, number>>({})
    const [deleting, setDeleting] = useState<string | null>(null)

    const fetchSpecies = async () => {
        const supabase = createClient()
        const { data } = await supabase
            .from('species_master')
            .select('*')
            .order('name_kana')
        setSpecies(data || [])
    }

    useEffect(() => {
        const load = async () => {
            const supabase = createClient()
            const { data } = await supabase
                .from('species_master')
                .select('*')
                .order('name_kana')
            setSpecies(data || [])

            // 各樹種の使用本数を取得
            const { data: trees } = await supabase
                .from('trees')
                .select('species_id')
            const counts: Record<string, number> = {}
            trees?.forEach(t => {
                counts[t.species_id] = (counts[t.species_id] || 0) + 1
            })
            setUsageCounts(counts)

            setLoading(false)
        }
        load()
    }, [])

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) return
        setSubmitting(true)

        const supabase = createClient()
        const { error } = await supabase
            .from('species_master')
            .insert({
                name: name.trim(),
                name_kana: nameKana.trim() || null,
                code: code.trim().toUpperCase() || null,
            })

        if (error) {
            alert('登録に失敗しました: ' + error.message)
        } else {
            setName('')
            setNameKana('')
            setCode('')
            await fetchSpecies()
        }
        setSubmitting(false)
    }

    const handleCodeSave = async (id: string) => {
        setSavingCode(true)
        const supabase = createClient()
        const { error } = await supabase
            .from('species_master')
            .update({ code: editCode.trim().toUpperCase() || null })
            .eq('id', id)

        if (error) {
            alert('コード更新に失敗しました: ' + error.message)
        } else {
            setEditingId(null)
            setEditCode('')
            await fetchSpecies()
        }
        setSavingCode(false)
    }

    const handleDelete = async (s: Species) => {
        const count = usageCounts[s.id] || 0
        if (count > 0) {
            alert(`「${s.name}」は ${count}本の樹木で使用中のため削除できません`)
            return
        }
        if (!confirm(`「${s.name}」を削除しますか？`)) return

        setDeleting(s.id)
        const supabase = createClient()
        const { error } = await supabase
            .from('species_master')
            .delete()
            .eq('id', s.id)

        if (error) {
            alert('削除に失敗しました: ' + error.message)
        } else {
            await fetchSpecies()
        }
        setDeleting(null)
    }

    if (loading) return <div className="p-8">読み込み中...</div>

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-200 px-4 py-6">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="text-green-600">← 戻る</Link>
                        <h1 className="text-xl font-bold text-gray-800">🌲 樹種マスター</h1>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-4 sm:p-8">
                {/* 新規追加フォーム */}
                <form onSubmit={handleAdd} className="bg-white rounded-xl shadow p-6 mb-6">
                    <h2 className="text-sm font-bold text-gray-600 mb-4">新しい樹種を追加</h2>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <input
                            type="text"
                            placeholder="樹種名（必須）"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            required
                        />
                        <input
                            type="text"
                            placeholder="読み仮名"
                            value={nameKana}
                            onChange={(e) => setNameKana(e.target.value)}
                            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        <input
                            type="text"
                            placeholder="コード (AO等)"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            className="w-full sm:w-28 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        <button
                            type="submit"
                            disabled={submitting || !name.trim()}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-6 py-2 rounded-lg font-bold text-sm transition-colors whitespace-nowrap"
                        >
                            {submitting ? '登録中...' : '追加'}
                        </button>
                    </div>
                </form>

                {/* 樹種一覧テーブル */}
                <div className="bg-white rounded-xl shadow overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-sm font-bold text-gray-600">樹種名</th>
                                <th className="px-6 py-4 text-sm font-bold text-gray-600">読み仮名</th>
                                <th className="px-6 py-4 text-sm font-bold text-gray-600">コード</th>
                                <th className="px-6 py-4 text-sm font-bold text-gray-600">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {species.map((s) => (
                                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-bold text-gray-800">{s.name}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{s.name_kana || '-'}</td>
                                    <td className="px-6 py-4">
                                        {editingId === s.id ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={editCode}
                                                    onChange={(e) => setEditCode(e.target.value)}
                                                    className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleCodeSave(s.id)
                                                        if (e.key === 'Escape') setEditingId(null)
                                                    }}
                                                />
                                                <button
                                                    onClick={() => handleCodeSave(s.id)}
                                                    disabled={savingCode}
                                                    className="text-green-600 hover:text-green-800 text-sm font-bold"
                                                >
                                                    保存
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="text-gray-400 hover:text-gray-600 text-sm"
                                                >
                                                    取消
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm ${s.code ? 'font-mono font-bold text-gray-800' : 'text-gray-400'}`}>
                                                    {s.code || '未設定'}
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        setEditingId(s.id)
                                                        setEditCode(s.code || '')
                                                    }}
                                                    className="text-blue-600 hover:text-blue-800 text-xs font-bold"
                                                >
                                                    編集
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {(usageCounts[s.id] || 0) > 0 ? (
                                            <span className="text-xs text-gray-400">{usageCounts[s.id]}本で使用中</span>
                                        ) : (
                                            <button
                                                onClick={() => handleDelete(s)}
                                                disabled={deleting === s.id}
                                                className="text-red-500 hover:text-red-700 text-xs font-bold"
                                            >
                                                {deleting === s.id ? '削除中...' : '削除'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {species.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                                        まだ樹種が登録されていません
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
