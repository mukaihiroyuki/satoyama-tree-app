'use client'

import { useEffect, useState } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db'

export default function ScanPage() {
    const router = useRouter()
    const [scanResult, setScanResult] = useState<string | null>(null)
    const [showNumberSearch, setShowNumberSearch] = useState(false)
    const [managementNumber, setManagementNumber] = useState('')
    const [searching, setSearching] = useState(false)
    const [searchError, setSearchError] = useState<string | null>(null)

    // 管理番号で検索（オンライン→Supabase、オフライン→IndexedDBキャッシュ）
    async function handleNumberSearch(e: React.FormEvent) {
        e.preventDefault()
        const query = managementNumber.trim().toUpperCase()
        if (!query) return

        setSearching(true)
        setSearchError(null)

        // まずオンラインでSupabase検索を試みる
        if (navigator.onLine) {
            try {
                const supabase = createClient()

                // 完全一致
                let { data } = await supabase
                    .from('trees')
                    .select('id')
                    .eq('management_number', query)
                    .maybeSingle()

                // 部分一致（末尾の番号部分のゼロ埋めなしでも検索可能に）
                if (!data) {
                    const { data: partialData } = await supabase
                        .from('trees')
                        .select('id')
                        .ilike('management_number', `%${query}%`)
                        .limit(1)
                        .maybeSingle()
                    data = partialData
                }

                // 数字のみ入力の場合はtree_numberでも検索
                if (!data && /^\d+$/.test(query)) {
                    const { data: numData } = await supabase
                        .from('trees')
                        .select('id')
                        .eq('tree_number', parseInt(query, 10))
                        .maybeSingle()
                    data = numData
                }

                if (data) {
                    router.push(`/trees/${data.id}`)
                    return
                }
            } catch {
                // ネットワークエラー → オフライン検索にフォールバック
            }
        }

        // オフライン or オンライン検索で見つからなかった場合 → IndexedDBキャッシュを検索
        const cached = await db.trees.toArray()
        if (cached.length > 0) {
            // 完全一致
            let found = cached.find(t =>
                t.management_number?.toUpperCase() === query
            )

            // 部分一致
            if (!found) {
                found = cached.find(t =>
                    t.management_number?.toUpperCase().includes(query)
                )
            }

            // 数字のみならtree_numberでも
            if (!found && /^\d+$/.test(query)) {
                found = cached.find(t => t.tree_number === parseInt(query, 10))
            }

            if (found) {
                router.push(`/trees/${found.id}`)
                return
            }
        }

        setSearchError(`「${managementNumber.trim()}」に該当する樹木が見つかりません`)
        setSearching(false)
    }

    useEffect(() => {
        const scanner = new Html5QrcodeScanner(
            "reader",
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            },
            /* verbose= */ false
        );

        scanner.render(onScanSuccess, onScanError);

        function onScanSuccess(decodedText: string) {
            // スキャン成功時
            setScanResult(decodedText)
            scanner.clear() // スキャナーを停止

            // UUID形式の検証用正規表現
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

            // URLがこのアプリのドメインを含んでいるか、または相対パスかチェック
            if (decodedText.includes('/trees/')) {
                const id = decodedText.split('/trees/').pop()
                // UUID形式を検証してからルーティング
                if (id && uuidRegex.test(id)) {
                    router.push(`/trees/${id}`)
                } else {
                    alert('無効なQRコードです。正しい樹木タグをスキャンしてください。')
                    window.location.reload()
                }
            } else {
                alert('このQRコードは里山アプリのタグではないようです')
                window.location.reload()
            }
        }

        function onScanError() {
            // スキャン失敗（読み取り中）は無視
        }

        return () => {
            scanner.clear().catch(error => console.error("Failed to clear scanner", error));
        }
    }, [router])

    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            <header className="p-4 flex items-center justify-between bg-zinc-900">
                <Link href="/" className="text-green-400">← 戻る</Link>
                <h1 className="text-lg font-bold">QRスキャン</h1>
                <div className="w-10"></div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-sm bg-white rounded-xl overflow-hidden shadow-2xl">
                    <div id="reader"></div>
                </div>

                <div className="mt-8 text-center space-y-4 px-6">
                    <p className="text-zinc-400">
                        樹木のラベルにあるQRコードを枠内に収めてください
                    </p>
                    {scanResult && (
                        <div className="bg-green-900 border border-green-700 p-4 rounded-lg">
                            <p className="text-sm">読み取り完了:</p>
                            <p className="font-mono text-xs break-all">{scanResult}</p>
                        </div>
                    )}

                    {/* 管理番号検索 */}
                    <div className="pt-6 border-t border-zinc-700">
                        <button
                            onClick={() => setShowNumberSearch(!showNumberSearch)}
                            className="text-green-400 font-bold"
                        >
                            {showNumberSearch ? '▲ 閉じる' : '▼ 番号で検索'}
                        </button>

                        {showNumberSearch && (
                            <form onSubmit={handleNumberSearch} className="mt-4 space-y-3">
                                <input
                                    type="text"
                                    value={managementNumber}
                                    onChange={(e) => setManagementNumber(e.target.value)}
                                    placeholder="例: 26-AO-0001 または 1"
                                    className="w-full px-4 py-3 rounded-lg text-black text-lg font-mono text-center"
                                />
                                <button
                                    type="submit"
                                    disabled={searching}
                                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-500 py-3 rounded-lg font-bold text-lg"
                                >
                                    {searching ? '検索中...' : '検索'}
                                </button>
                                <p className="text-zinc-500 text-xs">
                                    管理番号（26-AO-0001）または通し番号（1）で検索
                                </p>
                                {searchError && (
                                    <p className="text-red-400 font-bold">{searchError}</p>
                                )}
                            </form>
                        )}
                    </div>
                </div>
            </main>

            <footer className="p-8 text-center text-zinc-500 text-sm">
                里山プロジェクト 樹木管理システム
            </footer>
        </div>
    )
}
