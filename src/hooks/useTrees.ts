import { useState, useEffect, useCallback, useMemo } from 'react'
import { type CachedTree, type CachedSpecies } from '@/lib/db'
import * as repo from '@/lib/tree-repository'
import { useOnlineStatus } from './useOnlineStatus'

export function useTrees() {
    const [trees, setTrees] = useState<CachedTree[]>([])
    const [species, setSpecies] = useState<CachedSpecies[]>([])
    const [loading, setLoading] = useState(true)
    const [pendingCount, setPendingCount] = useState(0)
    const [error, setError] = useState<string | null>(null)
    const isOnline = useOnlineStatus()

    // 初回取得（キャッシュ即表示 + バックグラウンド同期）
    useEffect(() => {
        let cancelled = false
        const onTreesRefresh = (freshTrees: CachedTree[]) => {
            if (!cancelled) setTrees(freshTrees)
        }
        const onSpeciesRefresh = (freshSpecies: CachedSpecies[]) => {
            if (!cancelled) setSpecies(freshSpecies)
        }
        Promise.all([
            repo.getAllTrees(onTreesRefresh),
            repo.getAllSpecies(onSpeciesRefresh),
            repo.getPendingEditCount(),
        ]).then(([treesData, speciesData, count]) => {
            if (!cancelled) {
                console.log(`[useTrees] loaded: ${treesData.length} trees, ${speciesData.length} species`)
                setTrees(treesData)
                setSpecies(speciesData)
                setPendingCount(count)
                setLoading(false)
            }
        }).catch((err) => {
            console.error('データ取得エラー:', err)
            if (!cancelled) {
                setError(String(err))
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
            try {
                const count = await repo.getPendingEditCount()
                if (count > 0) {
                    await repo.syncPendingEdits()
                }
                if (!cancelled) {
                    const onRefresh = (freshTrees: CachedTree[]) => {
                        if (!cancelled) setTrees(freshTrees)
                    }
                    const onSpeciesRefresh2 = (freshSpecies: CachedSpecies[]) => {
                        if (!cancelled) setSpecies(freshSpecies)
                    }
                    const [treesData, speciesData, newCount] = await Promise.all([
                        repo.getAllTrees(onRefresh),
                        repo.getAllSpecies(onSpeciesRefresh2),
                        repo.getPendingEditCount(),
                    ])
                    if (!cancelled) {
                        setTrees(treesData)
                        setSpecies(speciesData)
                        setPendingCount(newCount)
                    }
                }
            } catch (err) {
                console.error('同期エラー:', err)
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
        const onRefresh = (freshTrees: CachedTree[]) => {
            setTrees(freshTrees)
        }
        const onSpeciesRefresh3 = (freshSpecies: CachedSpecies[]) => {
            setSpecies(freshSpecies)
        }
        const [treesData, speciesData, count] = await Promise.all([
            repo.getAllTrees(onRefresh),
            repo.getAllSpecies(onSpeciesRefresh3),
            repo.getPendingEditCount(),
        ])
        setTrees(treesData)
        setSpecies(speciesData)
        setPendingCount(count)
    }, [])

    return { trees, species, locations, loading, isOnline, pendingCount, refreshData, error }
}
