import { useState, useEffect, useCallback, useRef } from 'react'
import { type CachedTree } from '@/lib/db'
import * as repo from '@/lib/tree-repository'
import { useOnlineStatus } from './useOnlineStatus'

export function useTree(id: string) {
    const [tree, setTree] = useState<CachedTree | null>(null)
    const [loading, setLoading] = useState(true)
    const [saveMessage, setSaveMessage] = useState<string | null>(null)
    const isOnline = useOnlineStatus()
    const fetchRef = useRef(0)

    // 初回取得 + id変更時
    useEffect(() => {
        const token = ++fetchRef.current
        let cancelled = false
        repo.getTree(id).then(data => {
            if (!cancelled && token === fetchRef.current) {
                setTree(data)
                setLoading(false)
            }
        })
        return () => { cancelled = true }
    }, [id])

    // オンライン復帰時: 同期 → 再取得
    useEffect(() => {
        if (!isOnline) return
        let cancelled = false
        const sync = async () => {
            const count = await repo.getPendingEditCount()
            if (count > 0) {
                await repo.syncPendingEdits()
            }
            if (!cancelled) {
                const data = await repo.getTree(id)
                if (!cancelled) {
                    setTree(data)
                }
            }
        }
        sync()
        return () => { cancelled = true }
    }, [isOnline, id])

    const saveEdit = useCallback(async (updates: repo.TreeUpdate) => {
        const { offline } = await repo.saveEdit(id, updates)

        if (offline) {
            setSaveMessage('ローカルに保存しました（オンライン復帰時に同期します）')
        } else {
            setSaveMessage('保存しました')
        }

        // UI即時反映
        const data = await repo.getTree(id)
        setTree(data)

        // メッセージを3秒後にクリア
        setTimeout(() => setSaveMessage(null), 3000)
    }, [id])

    const refreshData = useCallback(async () => {
        const data = await repo.getTree(id)
        setTree(data)
    }, [id])

    return { tree, loading, isOnline, saveEdit, saveMessage, refreshData }
}
