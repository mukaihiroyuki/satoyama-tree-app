import { db, type CachedTree, type CachedSpecies } from './db'
import { createClient } from './supabase/client'

export type TreeUpdate = Record<string, string | number | null>

// ------------------------------------------------------------------
// 一覧取得
// ------------------------------------------------------------------
export async function getAllTrees(): Promise<CachedTree[]> {
    if (navigator.onLine) {
        try {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('trees')
                .select('*, species:species_master(id, name), client:clients(id, name)')
                .order('created_at', { ascending: false })

            if (!error && data) {
                // IndexedDBを全入れ替え
                await db.trees.clear()
                await db.trees.bulkPut(data as CachedTree[])
                return data as CachedTree[]
            }
        } catch {
            // ネットワークエラー → フォールバック
        }
    }

    // オフラインまたはエラー時: キャッシュから返却
    const cached = await db.trees.orderBy('created_at').reverse().toArray()
    // 未同期の編集を反映
    return applyPendingEditsToList(cached)
}

// ------------------------------------------------------------------
// 単体取得
// ------------------------------------------------------------------
export async function getTree(id: string): Promise<CachedTree | null> {
    if (navigator.onLine) {
        try {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('trees')
                .select('*, species:species_master(id, name), client:clients(id, name)')
                .eq('id', id)
                .single()

            if (!error && data) {
                await db.trees.put(data as CachedTree)
                // 未同期の編集があれば上書き適用して返す
                return applyPendingEdits(data as CachedTree)
            }
        } catch {
            // フォールバック
        }
    }

    const cached = await db.trees.get(id)
    if (!cached) return null
    return applyPendingEdits(cached)
}

// ------------------------------------------------------------------
// 樹種マスタ取得
// ------------------------------------------------------------------
export async function getAllSpecies(): Promise<CachedSpecies[]> {
    if (navigator.onLine) {
        try {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('species_master')
                .select('id, name, name_kana, code')
                .order('name_kana')

            if (!error && data) {
                await db.species.clear()
                await db.species.bulkPut(data as CachedSpecies[])
                return data as CachedSpecies[]
            }
        } catch {
            // フォールバック
        }
    }

    return db.species.toArray()
}

// ------------------------------------------------------------------
// 編集保存（オンライン→即送信、オフライン→キュー）
// ------------------------------------------------------------------
export async function saveEdit(
    treeId: string,
    updates: TreeUpdate
): Promise<{ offline: boolean }> {
    if (navigator.onLine) {
        try {
            const supabase = createClient()
            const { error } = await supabase
                .from('trees')
                .update(updates)
                .eq('id', treeId)

            if (!error) {
                // キャッシュも更新
                const cached = await db.trees.get(treeId)
                if (cached) {
                    await db.trees.put({ ...cached, ...updates } as CachedTree)
                }
                return { offline: false }
            }
        } catch {
            // ネットワークエラー → オフラインキューへ
        }
    }

    // オフライン: pendingEditsに個別フィールドとして保存
    const now = new Date().toISOString()
    const entries = Object.entries(updates).map(([field, value]) => ({
        tree_id: treeId,
        field,
        value: value as string | number | null,
        created_at: now,
        synced: 0 as const,
    }))
    await db.pendingEdits.bulkAdd(entries)

    // ローカルキャッシュにも即時反映（UI用）
    const cached = await db.trees.get(treeId)
    if (cached) {
        await db.trees.put({ ...cached, ...updates } as CachedTree)
    }

    return { offline: true }
}

// ------------------------------------------------------------------
// 未同期編集の同期
// ------------------------------------------------------------------
export async function syncPendingEdits(): Promise<number> {
    const pending = await db.pendingEdits
        .where('synced')
        .equals(0)
        .toArray()

    if (pending.length === 0) return 0

    // tree_idごとにまとめる
    const grouped = new Map<string, TreeUpdate>()
    const editIds: number[] = []

    for (const edit of pending) {
        const current = grouped.get(edit.tree_id) || {}
        current[edit.field] = edit.value
        grouped.set(edit.tree_id, current)
        if (edit.id !== undefined) editIds.push(edit.id)
    }

    const supabase = createClient()
    let syncedCount = 0

    for (const [treeId, updates] of grouped) {
        const { error } = await supabase
            .from('trees')
            .update(updates)
            .eq('id', treeId)

        if (!error) {
            syncedCount++
        } else {
            console.error(`Sync failed for tree ${treeId}:`, error)
        }
    }

    // 同期済みの編集を削除
    if (syncedCount === grouped.size) {
        // 全部成功 → 全削除
        await db.pendingEdits.where('synced').equals(0).delete()
    }

    return syncedCount
}

// ------------------------------------------------------------------
// 未同期件数
// ------------------------------------------------------------------
export async function getPendingEditCount(): Promise<number> {
    return db.pendingEdits.where('synced').equals(0).count()
}

// ------------------------------------------------------------------
// ヘルパー: 未同期の編集をキャッシュデータに上書き適用
// ------------------------------------------------------------------
async function applyPendingEdits(tree: CachedTree): Promise<CachedTree> {
    const pending = await db.pendingEdits
        .where('tree_id')
        .equals(tree.id)
        .filter(e => e.synced === 0)
        .toArray()

    if (pending.length === 0) return tree

    const patched = { ...tree }
    for (const edit of pending) {
        ;(patched as Record<string, unknown>)[edit.field] = edit.value
    }
    return patched
}

async function applyPendingEditsToList(trees: CachedTree[]): Promise<CachedTree[]> {
    const allPending = await db.pendingEdits
        .where('synced')
        .equals(0)
        .toArray()

    if (allPending.length === 0) return trees

    const pendingMap = new Map<string, Record<string, unknown>>()
    for (const edit of allPending) {
        const current = pendingMap.get(edit.tree_id) || {}
        current[edit.field] = edit.value
        pendingMap.set(edit.tree_id, current)
    }

    return trees.map(tree => {
        const patches = pendingMap.get(tree.id)
        if (!patches) return tree
        return { ...tree, ...patches } as CachedTree
    })
}
