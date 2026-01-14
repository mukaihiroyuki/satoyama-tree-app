'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Species {
    id: string
    name: string
}

export default function NewTreePage() {
    const router = useRouter()
    const [species, setSpecies] = useState<Species[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // フォームの状態
    const [formData, setFormData] = useState({
        species_id: '',
        height: '',
        trunk_count: '1',
        price: '',
        notes: '',
        location: '',
    })

    // 樹種一覧を取得
    useEffect(() => {
        async function fetchSpecies() {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('species_master')
                .select('id, name')
                .order('name_kana')

            if (error) {
                console.error('Error:', error)
                return
            }
            setSpecies(data || [])
        }
        fetchSpecies()
    }, [])

    // フォーム送信
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const supabase = createClient()

        const { error } = await supabase.from('trees').insert({
            species_id: formData.species_id,
            height: parseFloat(formData.height),
            trunk_count: parseInt(formData.trunk_count),
            price: parseInt(formData.price),
            notes: formData.notes || null,
            location: formData.location || null,
        })

        if (error) {
            console.error('Error:', error)
            setError('登録に失敗しました: ' + error.message)
            setLoading(false)
            return
        }

        // 成功したらトップページに戻る
        router.push('/')
        router.refresh()
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
            {/* ヘッダー */}
            <header className="bg-white shadow-sm border-b border-green-200">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/"
                            className="text-green-600 hover:text-green-800"
                        >
                            ← 戻る
                        </Link>
                        <h1 className="text-2xl font-bold text-green-800">
                            🌱 樹木を登録
                        </h1>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-8">
                <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-6 space-y-6">

                    {/* 樹種選択 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            樹種 <span className="text-red-500">*</span>
                        </label>
                        <select
                            required
                            value={formData.species_id}
                            onChange={(e) => setFormData({ ...formData, species_id: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        >
                            <option value="">選択してください</option>
                            {species.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* 樹高 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            樹高 (m) <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="20"
                            required
                            value={formData.height}
                            onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                            placeholder="例: 3.5"
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                    </div>

                    {/* 本立ち */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            本立ち（株立ち本数）
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="10"
                            value={formData.trunk_count}
                            onChange={(e) => setFormData({ ...formData, trunk_count: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                    </div>

                    {/* 上代（価格）*/}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            上代（円）<span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            min="0"
                            step="1000"
                            required
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                            placeholder="例: 50000"
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                    </div>

                    {/* 場所 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            圃場内の場所
                        </label>
                        <input
                            type="text"
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            placeholder="例: A区画 北側"
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                    </div>

                    {/* 備考 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            備考
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={3}
                            placeholder="特記事項があれば入力"
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                    </div>

                    {/* エラー表示 */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* 送信ボタン */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-lg text-lg transition-all"
                    >
                        {loading ? '登録中...' : '✅ 登録する'}
                    </button>
                </form>
            </main>
        </div>
    )
}
