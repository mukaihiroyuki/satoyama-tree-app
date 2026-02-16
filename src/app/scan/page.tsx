'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ScanPage() {
    const router = useRouter()
    const [scanResult, setScanResult] = useState<string | null>(null)
    const [scannerReady, setScannerReady] = useState(false)
    const [showNumberSearch, setShowNumberSearch] = useState(false)
    const [managementNumber, setManagementNumber] = useState('')
    const [searching, setSearching] = useState(false)
    const [searchError, setSearchError] = useState<string | null>(null)

    // 管理番号で検索
    async function handleSearch() {
        const query = managementNumber.trim()
        if (!query) {
            setSearchError('検索キーワードを入力してください')
            return
        }

        setSearching(true)
        setSearchError(null)

        try {
            // オンラインでSupabase検索
            if (navigator.onLine) {
                const supabase = createClient()

                // 部分一致（大文字小文字無視）
                const { data: trees, error } = await supabase
                    .from('trees')
                    .select('id, management_number, tree_number')
                    .ilike('management_number', `%${query}%`)
                    .limit(5)

                if (error) {
                    setSearchError(`検索エラー: ${error.message}`)
                    setSearching(false)
                    return
                }

                if (trees && trees.length > 0) {
                    router.push(`/trees/${trees[0].id}`)
                    return
                }

                // 数字のみならtree_numberでも検索
                if (/^\d+$/.test(query)) {
                    const { data: numData } = await supabase
                        .from('trees')
                        .select('id')
                        .eq('tree_number', parseInt(query, 10))
                        .maybeSingle()

                    if (numData) {
                        router.push(`/trees/${numData.id}`)
                        return
                    }
                }
            }

            // オフライン時: IndexedDBキャッシュから検索（動的import）
            try {
                const { db } = await import('@/lib/db')
                const cached = await db.trees.toArray()
                const upperQuery = query.toUpperCase()

                let found = cached.find(t =>
                    t.management_number?.toUpperCase().includes(upperQuery)
                )
                if (!found && /^\d+$/.test(query)) {
                    found = cached.find(t => t.tree_number === parseInt(query, 10))
                }
                if (found) {
                    router.push(`/trees/${found.id}`)
                    return
                }
            } catch {
                // IndexedDBが使えない場合は無視
            }

            setSearchError(`「${query}」に該当する樹木が見つかりません`)
        } catch (err) {
            setSearchError(`検索エラー: ${err instanceof Error ? err.message : '不明なエラー'}`)
        }
        setSearching(false)
    }

    // QRスキャナー初期化
    useEffect(() => {
        let scanner: import('html5-qrcode').Html5QrcodeScanner | null = null

        async function initScanner() {
            try {
                const { Html5QrcodeScanner } = await import('html5-qrcode')
                scanner = new Html5QrcodeScanner(
                    "reader",
                    { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
                    false
                )

                scanner.render(
                    (decodedText: string) => {
                        setScanResult(decodedText)
                        scanner?.clear()

                        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
                        if (decodedText.includes('/trees/')) {
                            const id = decodedText.split('/trees/').pop()
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
                    },
                    () => {} // スキャン中のエラーは無視
                )
                setScannerReady(true)
            } catch (err) {
                console.error('QRスキャナー初期化エラー:', err)
                setScannerReady(false)
            }
        }

        initScanner()
        return () => {
            scanner?.clear().catch(() => {})
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
                    {!scannerReady && (
                        <div className="p-8 text-center text-gray-500">
                            カメラを起動中...
                        </div>
                    )}
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
                            <div className="mt-4 space-y-3">
                                <input
                                    type="text"
                                    value={managementNumber}
                                    onChange={(e) => setManagementNumber(e.target.value)}
                                    placeholder="例: 26-AO-0001 または 1"
                                    className="w-full px-4 py-3 rounded-lg bg-white text-black text-lg font-mono text-center border-2 border-green-400"
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
                                />
                                <button
                                    type="button"
                                    onClick={handleSearch}
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
                            </div>
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
