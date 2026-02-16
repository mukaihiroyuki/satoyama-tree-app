import { useState, useEffect, useCallback, useMemo } from 'react'
import { type CachedTree, type CachedSpecies } from '@/lib/db'
import * as repo from '@/lib/tree-repository'
import { useOnlineStatus } from './useOnlineStatus'

export function useTrees() {
    const [trees, setTrees] = useState<CachedTree[]>([])
    const [species, setSpecies] = useState<CachedSpecies[]>([])
    const [loading, setLoading] = useState(true)
    const [pendingCount, setPendingCount] = useState(0)
    const isOnline = useOnlineStatus()

    // 初回取得
    useEffect(() => {
        let cancelled = false
        Promise.all([
            repo.getAllTrees(),
            repo.getAllSpecies(),
            repo.getPendingEditCount(),
        ]).then(([treesData, speciesData, count]) => {
            if (!cancelled) {
                setTrees(treesData)
                setSpecies(speciesData)
                setPendingCount(count)
                setLoading(false)
            }
        })
        return () => { cancelled = true }
    }, [])

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
                const [treesData, speciesData, newCount] = await Promise.all([
                    repo.getAllTrees(),
                    repo.getAllSpecies(),
                    repo.getPendingEditCount(),
                ])
                if (!cancelled) {
                    setTrees(treesData)
                    setSpecies(speciesData)
                    setPendingCount(newCount)
                }
            }
        }
        sync()
        return () => { cancelled = true }
    }, [isOnline])

    // 場所一覧をmemoize
    const locations = useMemo(() => {
        return [...new Set(
            trees.map(t => t.location).filter(Boolean)
        )] as string[]
    }, [trees])

    const refreshData = useCallback(async () => {
        const [treesData, speciesData, count] = await Promise.all([
            repo.getAllTrees(),
            repo.getAllSpecies(),
            repo.getPendingEditCount(),
        ])
        setTrees(treesData)
        setSpecies(speciesData)
        setPendingCount(count)
    }, [])

    return { trees, species, locations, loading, isOnline, pendingCount, refreshData }
}
