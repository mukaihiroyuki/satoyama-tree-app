'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Species {
    id: string
    name: string
    code: string | null
}

export default function NewTreePage() {
    const router = useRouter()
    const [species, setSpecies] = useState<Species[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isNewSpecies, setIsNewSpecies] = useState(false)
    const [newSpeciesName, setNewSpeciesName] = useState('')

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
                .select('id, name, code')
                .order('name_kana')

            if (error) {
                console.error('Error:', error)
                return
            }
            setSpecies(data || [])
        }
        fetchSpecies()
    }, [])

    // クイック選択のヘルパー
    const QuickButton = ({ label, value, field }: { label: string, value: string, field: string }) => (
        <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, [field]: value }))}
            className={`px-4 py-2 rounded-lg border-2 font-bold transition-all ${formData[field as keyof typeof formData] === value
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-green-700 border-green-200 hover:border-green-400'
                }`}
        >
            {label}
        </button>
    )

    // フォーム送信
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const supabase = createClient()
        let finalSpeciesId = formData.species_id

        // 新規樹種の場合：まずマスターに追加
        if (isNewSpecies && newSpeciesName) {
            const { data: newSpecies, error: speciesError } = await supabase
                .from('species_master')
                .insert({ name: newSpeciesName })
                .select()
                .single()

            if (speciesError) {
                setError('樹種の登録に失敗しました: ' + speciesError.message)
                setLoading(false)
                return
            }
            finalSpeciesId = newSpecies.id
        }

        if (!finalSpeciesId) {
            setError('樹種を選択、または新規入力してください')
            setLoading(false)
            return
        }

        // 管理番号を自動生成
        let managementNumber: string | null = null
        const selectedSpecies = isNewSpecies
            ? null
            : species.find(s => s.id === finalSpeciesId)
        const speciesCode = selectedSpecies?.code

        if (speciesCode) {
            const year = new Date().getFullYear().toString().slice(-2) // "26"
            const prefix = `${year}-${speciesCode}-`

            // 今年のこの樹種の最大番号を取得
            const { data: maxTree } = await supabase
                .from('trees')
                .select('management_number')
                .like('management_number', `${prefix}%`)
                .order('management_number', { ascending: false })
                .limit(1)
                .single()

            // 次の番号を計算
            const nextNumber = maxTree?.management_number
                ? parseInt(maxTree.management_number.split('-')[2]) + 1
                : 1

            managementNumber = `${prefix}${nextNumber.toString().padStart(4, '0')}`
        }

        const { data: newTree, error } = await supabase
            .from('trees')
            .insert({
                species_id: finalSpeciesId,
                height: parseFloat(formData.height),
                trunk_count: parseInt(formData.trunk_count),
                price: parseInt(formData.price),
                notes: formData.notes || null,
                location: formData.location || null,
                management_number: managementNumber,
            })
            .select()
            .single()

        if (error) {
            console.error('Error:', error)
            setError('登録に失敗しました: ' + error.message)
            setLoading(false)
            return
        }

        // 成功したらその樹木の詳細ページへ（即印刷できるように）
        router.push(`/trees/${newTree.id}`)
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
                <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-6 space-y-8">

                    {/* 樹種選択 */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="block text-sm font-bold text-gray-700">
                                樹種 <span className="text-red-500">*</span>
                            </label>
                            <button
                                type="button"
                                onClick={() => setIsNewSpecies(!isNewSpecies)}
                                className="text-sm font-bold text-blue-600 hover:underline"
                            >
                                {isNewSpecies ? '既にある樹種から選ぶ' : '+ 新しい樹種を追加'}
                            </button>
                        </div>

                        {isNewSpecies ? (
                            <input
                                type="text"
                                required
                                value={newSpeciesName}
                                onChange={(e) => setNewSpeciesName(e.target.value)}
                                placeholder="例: ヤマブキ"
                                className="w-full border-2 border-blue-300 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        ) : (
                            <select
                                required
                                value={formData.species_id}
                                onChange={(e) => setFormData({ ...formData, species_id: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                            >
                                <option value="">選択してください</option>
                                {species.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* 樹高 */}
                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-gray-700">
                            樹高 (m) <span className="text-red-500">*</span>
                        </label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {['1.5', '2.0', '2.5', '3.0', '3.5', '4.0'].map(v => (
                                <QuickButton key={v} label={v} value={v} field="height" />
                            ))}
                        </div>
                        <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="20"
                            required
                            value={formData.height}
                            onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                            placeholder="または数値を入力"
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                    </div>

                    {/* 本立ち */}
                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-gray-700">
                            本立ち（株立ち本数）
                        </label>
                        <div className="flex gap-2">
                            {['1', '2', '3', '5'].map(v => (
                                <QuickButton key={v} label={v} value={v} field="trunk_count" />
                            ))}
                        </div>
                    </div>

                    {/* 上代（価格）*/}
                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-gray-700">
                            上代（円）<span className="text-red-500">*</span>
                        </label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {[
                                { l: '1万', v: '10000' },
                                { l: '2万', v: '20000' },
                                { l: '3万', v: '30000' },
                                { l: '5万', v: '50000' },
                                { l: '8万', v: '80000' },
                                { l: '10万', v: '100000' },
                            ].map(btn => (
                                <QuickButton key={btn.v} label={btn.l} value={btn.v} field="price" />
                            ))}
                        </div>
                        <input
                            type="number"
                            min="0"
                            step="1000"
                            required
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                            placeholder="または価格を入力"
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                    </div>

                    {/* 場所 */}
                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-gray-700">
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
                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-gray-700">
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
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg font-bold">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* 送信ボタン */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-black py-5 px-6 rounded-xl text-xl shadow-xl transition-all transform active:scale-95"
                    >
                        {loading ? '登録中...' : '✅ 登録してラベルを出す'}
                    </button>
                </form>
            </main>
        </div>
    )
}
