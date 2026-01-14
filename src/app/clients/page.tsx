'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Client {
    id: string
    name: string
    tel: string | null
    address: string | null
    notes: string | null
}

export default function ClientsPage() {
    const [clients, setClients] = useState<Client[]>([])
    const [loading, setLoading] = useState(true)

    const fetchClients = useCallback(async () => {
        const supabase = createClient()
        const { data } = await supabase.from('clients').select('*').order('name')
        setClients(data || [])
        setLoading(false)
    }, [])

    useEffect(() => {
        fetchClients()
    }, [fetchClients])

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
                <div className="bg-white rounded-xl shadow overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-sm font-bold text-gray-600">名前</th>
                                <th className="px-6 py-4 text-sm font-bold text-gray-600">住所・備考</th>
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
                                    <td className="px-6 py-4">
                                        <button className="text-blue-600 hover:text-blue-800 text-sm font-bold">編集</button>
                                    </td>
                                </tr>
                            ))}
                            {clients.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-6 py-12 text-center text-gray-400">
                                        まだ登録されていません
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-8 bg-blue-50 border border-blue-100 rounded-xl p-6 text-blue-800">
                    <h3 className="font-bold flex items-center gap-2">
                        💡 相棒へのアドバイス（デモ用）
                    </h3>
                    <p className="text-sm mt-2 opacity-90 leading-relaxed">
                        ここで企業名を統一しておけば、現場で「誰かが間違えて登録した変な名前」も後から修正できるぜ。<br />
                        社長には「現場はスピード重視で入力させて、事務所でしっかりクレンジングする」と伝えれば100点だ！
                    </p>
                </div>
            </main>
        </div>
    )
}
