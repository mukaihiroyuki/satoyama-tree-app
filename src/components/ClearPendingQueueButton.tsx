'use client'

import { useEffect, useState, useCallback } from 'react'
import { clearPendingQueue, getPendingEditCount } from '@/lib/tree-repository'

export default function ClearPendingQueueButton() {
    const [count, setCount] = useState<number | null>(null)
    const [busy, setBusy] = useState(false)

    const refresh = useCallback(async () => {
        try {
            setCount(await getPendingEditCount())
        } catch {
            setCount(null)
        }
    }, [])

    useEffect(() => { refresh() }, [refresh])

    const handleClick = async () => {
        if (count === null || count === 0) return
        if (!confirm(`未同期の ${count} 件を破棄します。\n\nこれらの編集・登録内容は失われ、\n手動で再入力が必要になります。\n\n本当に続行しますか？`)) return
        setBusy(true)
        try {
            await clearPendingQueue()
            await refresh()
            alert('未同期キューをクリアしました')
        } catch (err) {
            alert(`クリアに失敗しました: ${String(err)}`)
        } finally {
            setBusy(false)
        }
    }

    const disabled = busy || count === null || count === 0
    const label = count === null
        ? '⚠️ 同期キュー確認中...'
        : count === 0
            ? '✅ 同期キューは空です'
            : `⚠️ 同期キューをクリア (${count}件)`

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={disabled}
            className={`border rounded-lg px-4 py-3 text-sm font-bold text-center transition-all ${disabled
                    ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-red-50 hover:bg-red-100 border-red-300 text-red-700'
                }`}
        >
            {label}
        </button>
    )
}
