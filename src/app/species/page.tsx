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
    const [usageCounts, setUsageCounts] = useState<Record<string, number>>({})
    const [deleting, setDeleting] = useState<string | null>(null)
    const [editingField, setEditingField] = useState<{ id: string; field: 'name' | 'name_kana' | 'code' } | null>(null)
    const [editingValue, setEditingValue] = useState('')
    const [savingField, setSavingField] = useState(false)
    // 各樹種で管理番号が採番済みの本数
    const [managedCounts, setManagedCounts] = useState<Record<string, number>>({})

    const fetchSpecies = async () => {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('species_master')
            .select('*')
            .order('name_kana')
        if (error) { console.error('species fetch error:', error); return }
        setSpecies(data || [])
    }

    useEffect(() => {
        const load = async () => {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('species_master')
                .select('*')
                .order('name_kana')
            if (error) console.error('species load error:', error)
            setSpecies(data || [])

            // 各樹種の使用本数を取得（1000行制限回避のためページング）
            let allTrees: { species_id: string; management_number: string | null }[] = []
            let from = 0
            const PAGE_SIZE = 1000
            while (true) {
                const { data: page } = await supabase
                    .from('trees')
                    .select('species_id, management_number')
                    .range(from, from + PAGE_SIZE - 1)
                if (page) allTrees = allTrees.concat(page)
                if (!page || page.length < PAGE_SIZE) break
                from += PAGE_SIZE
            }
            const counts: Record<string, number> = {}
            const managed: Record<string, number> = {}
            allTrees.forEach(t => {
                counts[t.species_id] = (counts[t.species_id] || 0) + 1
                if (t.management_number) {
                    managed[t.species_id] = (managed[t.species_id] || 0) + 1
                }
            })
            setUsageCounts(counts)
            setManagedCounts(managed)

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

    const handleFieldSave = async (s: Species) => {
        if (!editingField) return
        const { field } = editingField
        const trimmed = editingValue.trim()
        const newValue = field === 'code'
            ? (trimmed.toUpperCase() || null)
            : field === 'name'
                ? trimmed
                : (trimmed || null)

        if (newValue === s[field]) {
            setEditingField(null)
            return
        }
        if (field === 'name' && !trimmed) {
            alert('樹種名は空にできません')
            return
        }
        setSavingField(true)
        const supabase = createClient()
        const { error } = await supabase
            .from('species_master')
            .update({ [field]: newValue })
            .eq('id', s.id)

        if (error) {
            alert('保存に失敗しました: ' + error.message)
        } else {
            await fetchSpecies()
        }
        setSavingField(false)
        setEditingField(null)
    }

    const startEditing = (s: Species, field: 'name' | 'name_kana' | 'code') => {
        if (field === 'code' && managedCounts[s.id] > 0 && s.code) {
            alert(`「${s.name}」は ${managedCounts[s.id]}本の管理番号で使用中のため、コードを変更できません`)
            return
        }
        setEditingField({ id: s.id, field })
        setEditingValue(s[field] || '')
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
                            placeholder="コード (AO, SKY等)"
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
                                    {/* 樹種名 */}
                                    <td className="px-6 py-4">
                                        {editingField?.id === s.id && editingField.field === 'name' ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={editingValue}
                                                    onChange={(e) => setEditingValue(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleFieldSave(s)
                                                        if (e.key === 'Escape') setEditingField(null)
                                                    }}
                                                    autoFocus
                                                    className="w-40 border border-green-400 rounded px-2 py-1 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-green-500"
                                                    disabled={savingField}
                                                />
                                                <button onClick={() => handleFieldSave(s)} disabled={savingField} className="text-green-600 hover:text-green-800 text-xs font-bold">{savingField ? '...' : '保存'}</button>
                                                <button onClick={() => setEditingField(null)} className="text-gray-400 hover:text-gray-600 text-xs">取消</button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => startEditing(s, 'name')}
                                                className="font-bold text-gray-800 hover:text-green-700 text-sm"
                                                title="クリックして編集"
                                            >
                                                {s.name}
                                            </button>
                                        )}
                                    </td>
                                    {/* 読み仮名 */}
                                    <td className="px-6 py-4">
                                        {editingField?.id === s.id && editingField.field === 'name_kana' ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={editingValue}
                                                    onChange={(e) => setEditingValue(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleFieldSave(s)
                                                        if (e.key === 'Escape') setEditingField(null)
                                                    }}
                                                    autoFocus
                                                    placeholder="フリガナを入力"
                                                    className="w-40 border border-green-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                                    disabled={savingField}
                                                />
                                                <button onClick={() => handleFieldSave(s)} disabled={savingField} className="text-green-600 hover:text-green-800 text-xs font-bold">{savingField ? '...' : '保存'}</button>
                                                <button onClick={() => setEditingField(null)} className="text-gray-400 hover:text-gray-600 text-xs">取消</button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => startEditing(s, 'name_kana')}
                                                className={`text-sm ${s.name_kana ? 'text-gray-500 hover:text-green-700' : 'text-gray-300 hover:text-green-700'}`}
                                                title="クリックして編集"
                                            >
                                                {s.name_kana || '未設定'}
                                            </button>
                                        )}
                                    </td>
                                    {/* コード */}
                                    <td className="px-6 py-4">
                                        {editingField?.id === s.id && editingField.field === 'code' ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={editingValue}
                                                    onChange={(e) => setEditingValue(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleFieldSave(s)
                                                        if (e.key === 'Escape') setEditingField(null)
                                                    }}
                                                    autoFocus
                                                    placeholder="AO, SKY等"
                                                    className="w-20 border border-green-400 rounded px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                                                    disabled={savingField}
                                                />
                                                <button onClick={() => handleFieldSave(s)} disabled={savingField} className="text-green-600 hover:text-green-800 text-xs font-bold">{savingField ? '...' : '保存'}</button>
                                                <button onClick={() => setEditingField(null)} className="text-gray-400 hover:text-gray-600 text-xs">取消</button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => startEditing(s, 'code')}
                                                className={`text-sm flex items-center gap-1.5 ${
                                                    s.code
                                                        ? 'font-mono font-bold text-gray-800 hover:text-green-700'
                                                        : 'text-orange-500 font-bold hover:text-orange-700'
                                                }`}
                                                title="クリックして編集"
                                            >
                                                {s.code || '未設定'}
                                                {!s.code && (usageCounts[s.id] || 0) > 0 && (
                                                    <span className="inline-block bg-orange-100 text-orange-600 text-[10px] px-1.5 py-0.5 rounded-full">
                                                        要設定
                                                    </span>
                                                )}
                                            </button>
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
