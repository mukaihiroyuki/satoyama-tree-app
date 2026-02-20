'use client'

import { useEffect, useState } from 'react'
import { getAllTrees, getAllSpecies } from '@/lib/tree-repository'

function getInitialStatus(): 'caching' | 'offline' {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline'
    return 'caching'
}

export default function OfflineCacheWarmer() {
    const [status, setStatus] = useState<'caching' | 'done' | 'offline'>(getInitialStatus)
    const [counts, setCounts] = useState({ trees: 0, species: 0 })

    useEffect(() => {
        if (status !== 'caching') return

        let cancelled = false

        Promise.all([
            getAllTrees(),
            getAllSpecies(),
        ]).then(([trees, species]) => {
            if (!cancelled) {
                setCounts({ trees: trees.length, species: species.length })
                setStatus('done')
            }
        }).catch(() => {
            if (!cancelled) setStatus('offline')
        })

        return () => { cancelled = true }
    }, [status])

    if (status === 'caching') {
        return (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
                <span className="text-lg animate-spin">🔄</span>
                <p className="text-sm font-bold text-blue-800">オフライン用データを準備中...</p>
            </div>
        )
    }

    if (status === 'done') {
        return (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
                <span className="text-lg">✅</span>
                <p className="text-sm font-bold text-green-800">
                    オフライン準備OK（樹木 {counts.trees}本・樹種 {counts.species}種をキャッシュ済み）
                </p>
            </div>
        )
    }

    return (
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
            <span className="text-lg">⚡</span>
            <div>
                <p className="text-sm font-bold text-yellow-800">オフラインモード</p>
                <p className="text-xs text-yellow-600">Wi-Fi接続時にアプリを開くとデータが自動キャッシュされます</p>
            </div>
        </div>
    )
}
