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
    const activeIdRef = useRef(id)

    // 初回取得（キャッシュ即表示 + バックグラウンド同期）
    useEffect(() => {
        activeIdRef.current = id
        const token = ++fetchRef.current
        let cancelled = false
        const onRefresh = (freshTree: CachedTree | null) => {
            if (!cancelled && token === fetchRef.current) {
                setTree(freshTree)
            }
        }
        repo.getTree(id, onRefresh).then(data => {
            if (!cancelled && token === fetchRef.current) {
                setTree(data)
                setLoading(false)
            }
        })
        return () => { cancelled = true }
    }, [id])

    // オンライン復帰時: 同期 → 再取得（IDが変わったらURLとデータを差し替え）
    useEffect(() => {
        if (!isOnline) return
        let cancelled = false
        const sync = async () => {
            const count = await repo.getPendingEditCount()
            if (count > 0) {
                await repo.syncPendingEdits()
            }
            if (cancelled) return

            // 同期でIDが変わった場合（仮ID→Supabase正式ID）
            const currentId = activeIdRef.current
            const newId = repo.getSyncedNewId(currentId)
            if (newId) {
                // ページ遷移なしでURLだけ差し替え（チラつき防止）
                window.history.replaceState(null, '', `/trees/${newId}`)
                activeIdRef.current = newId
                // 新IDでデータを取得して差し替え
                const data = await repo.getTree(newId)
                if (!cancelled) {
                    setTree(data)
                }
                return
            }

            const data = await repo.getTree(currentId)
            if (!cancelled) {
                setTree(data)
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
