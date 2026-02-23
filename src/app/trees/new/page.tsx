'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getAllSpecies, registerTreeOffline } from '@/lib/tree-repository'

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

    // 樹種一覧を取得（オフライン時はIndexedDBキャッシュから）
    useEffect(() => {
        getAllSpecies().then(data => {
            setSpecies(data.map(s => ({ id: s.id, name: s.name, code: s.code })))
        }).catch(err => {
            console.error('Error fetching species:', err)
        })
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

        let finalSpeciesId = formData.species_id
        const selectedSpecies = isNewSpecies
            ? null
            : species.find(s => s.id === finalSpeciesId)

        // オンライン時：従来通りSupabaseに直接登録
        try {
            // まず実際にネットワークが使えるか確認（3秒タイムアウト）
            const controller = new AbortController()
            const timer = setTimeout(() => controller.abort(), 3000)
            await fetch('https://www.gstatic.com/generate_204', {
                method: 'HEAD',
                mode: 'no-cors',
                signal: controller.signal,
            })
            clearTimeout(timer)

            const supabase = createClient()

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
            const speciesCode = selectedSpecies?.code

            if (speciesCode) {
                const year = new Date().getFullYear().toString().slice(-2)
                const prefix = `${year}-${speciesCode}-`

                const { data: maxTree } = await supabase
                    .from('trees')
                    .select('management_number')
                    .like('management_number', `${prefix}%`)
                    .order('management_number', { ascending: false })
                    .limit(1)
                    .single()

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

            router.replace(`/trees/${newTree.id}`)
            return
        } catch {
            // ネットワークエラーまたはタイムアウト → オフライン登録へフォールスルー
        }

        // オフライン時：IndexedDBに仮保存
        if (!finalSpeciesId) {
            setError('樹種を選択してください（オフライン時は新規樹種を追加できません）')
            setLoading(false)
            return
        }

        if (isNewSpecies) {
            setError('オフライン時は新規樹種を追加できません。既存の樹種から選んでください。')
            setLoading(false)
            return
        }

        const tempId = crypto.randomUUID()
        await registerTreeOffline({
            temp_id: tempId,
            species_id: finalSpeciesId,
            species_name: selectedSpecies?.name || '不明',
            species_code: selectedSpecies?.code || null,
            height: parseFloat(formData.height),
            trunk_count: parseInt(formData.trunk_count),
            price: parseInt(formData.price),
            notes: formData.notes || null,
            location: formData.location || null,
            created_at: new Date().toISOString(),
        })

        // 詳細ページへ（管理番号は電波復帰後に採番されるが、ラベル印刷は可能）
        router.replace(`/trees/${tempId}`)
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
                        <div className="flex flex-wrap gap-2 mb-2">
                            {['1', '2', '3', '4', '5'].map(v => (
                                <QuickButton key={v} label={v} value={v} field="trunk_count" />
                            ))}
                        </div>
                        <input
                            type="number"
                            min="1"
                            max="30"
                            value={formData.trunk_count}
                            onChange={(e) => setFormData({ ...formData, trunk_count: e.target.value })}
                            placeholder="6本以上はここに入力"
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
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
                                { l: '4万', v: '40000' },
                                { l: '5万', v: '50000' },
                                { l: '6万', v: '60000' },
                                { l: '7万', v: '70000' },
                                { l: '8万', v: '80000' },
                                { l: '9万', v: '90000' },
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
                            placeholder="10万超はここに入力（例: 120000）"
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                        {formData.price && parseInt(formData.price) > 0 && (
                            <p className="text-sm font-bold text-green-700">
                                &yen;{parseInt(formData.price).toLocaleString()}
                            </p>
                        )}
                    </div>

                    {/* 圃場選択 */}
                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-gray-700">
                            圃場
                        </label>
                        <select
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                        >
                            <option value="">選択してください</option>
                            <option value="第1圃場（倉石1）">第1圃場（倉石1）</option>
                            <option value="第2圃場（倉石2）">第2圃場（倉石2）</option>
                            <option value="第3圃場（岡堀土場）">第3圃場（岡堀土場）</option>
                            <option value="第4圃場（南郷）">第4圃場（南郷）</option>
                            <option value="第5圃場（蛇沢）">第5圃場（蛇沢）</option>
                            <option value="第6圃場（大タルミ）">第6圃場（大タルミ）</option>
                        </select>
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
                    {!navigator.onLine && (
                        <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-center font-bold">
                            ⚡ オフライン中 — 登録データは端末に保存され、電波復帰後に自動同期されます
                        </p>
                    )}
                </form>
            </main>
        </div>
    )
}
