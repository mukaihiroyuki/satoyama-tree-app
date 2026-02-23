import { db, type CachedTree, type CachedSpecies, type PendingRegistration } from './db'
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
                .select('*, species:species_master(id, name), client:clients(id, name), shipment_items(shipments(shipped_at))')
                .order('created_at', { ascending: false })

            if (!error && data) {
                // shipment_items→shipmentsからshipped_atをフラット化
                const trees = flattenShippedAt(data)
                // IndexedDBを全入れ替え
                await db.trees.clear()
                await db.trees.bulkPut(trees)
                return trees
            }
        } catch {
            // ネットワークエラー → フォールバック
        }
    }

    // オフラインまたはエラー時: キャッシュから返却
    const cached = await db.trees.orderBy('created_at').reverse().toArray()
    // 未同期の編集を反映
    const withEdits = await applyPendingEditsToList(cached)
    // 未同期の新規登録も一覧に含める
    return mergePendingRegistrations(withEdits)
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
                .select('*, species:species_master(id, name), client:clients(id, name), shipment_items(shipments(shipped_at))')
                .eq('id', id)
                .single()

            if (!error && data) {
                const tree = flattenShippedAt([data])[0]
                await db.trees.put(tree)
                // 未同期の編集があれば上書き適用して返す
                return applyPendingEdits(tree)
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
    let totalSynced = 0

    // 1. 未同期の新規登録を先に同期
    totalSynced += await syncPendingRegistrations()

    // 2. 未同期の編集を同期
    const pending = await db.pendingEdits
        .where('synced')
        .equals(0)
        .toArray()

    if (pending.length === 0) return totalSynced

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

    return totalSynced + syncedCount
}

// ------------------------------------------------------------------
// 未同期件数（編集 + 新規登録）
// ------------------------------------------------------------------
export async function getPendingEditCount(): Promise<number> {
    const edits = await db.pendingEdits.where('synced').equals(0).count()
    const regs = await db.pendingRegistrations.where('synced').equals(0).count()
    return edits + regs
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

// ------------------------------------------------------------------
// オフライン新規登録
// ------------------------------------------------------------------
export async function registerTreeOffline(reg: Omit<PendingRegistration, 'id' | 'synced'>): Promise<string> {
    // pendingRegistrationsに保存
    await db.pendingRegistrations.add({ ...reg, synced: 0 })

    // 一覧表示用にキャッシュにも仮データを入れる
    const now = new Date().toISOString()
    const cachedTree: CachedTree = {
        id: reg.temp_id,
        species_id: reg.species_id,
        client_id: null,
        height: reg.height,
        trunk_count: reg.trunk_count,
        price: reg.price,
        status: 'in_stock',
        notes: reg.notes,
        shipped_at: null,
        estimate_number: null,
        photo_url: null,
        location: reg.location,
        management_number: null,  // 電波復帰後に採番
        arrived_at: now.split('T')[0],
        created_at: now,
        updated_at: now,
        species: { id: reg.species_id, name: reg.species_name },
        client: null,
    }
    await db.trees.put(cachedTree)

    return reg.temp_id
}

// ------------------------------------------------------------------
// 未同期の新規登録を同期
// ------------------------------------------------------------------
async function syncPendingRegistrations(): Promise<number> {
    const pending = await db.pendingRegistrations
        .where('synced')
        .equals(0)
        .toArray()

    if (pending.length === 0) return 0

    const supabase = createClient()
    let syncedCount = 0

    for (const reg of pending) {
        try {
            // 管理番号を採番
            let managementNumber: string | null = null
            if (reg.species_code) {
                const year = new Date(reg.created_at).getFullYear().toString().slice(-2)
                const prefix = `${year}-${reg.species_code}-`

                const { data: maxTree } = await supabase
                    .from('trees')
                    .select('management_number')
                    .like('management_number', `${prefix}%`)
                    .order('management_number', { ascending: false })
                    .limit(1)
                    .single()

                const nextNumber = maxTree?.management_number
                    ? parseInt(maxTree.management_number.split('-')[2]) + 1
                    : 1
                managementNumber = `${prefix}${nextNumber.toString().padStart(4, '0')}`
            }

            // Supabaseにinsert
            const { data: newTree, error } = await supabase
                .from('trees')
                .insert({
                    species_id: reg.species_id,
                    height: reg.height,
                    trunk_count: reg.trunk_count,
                    price: reg.price,
                    notes: reg.notes,
                    location: reg.location,
                    management_number: managementNumber,
                })
                .select()
                .single()

            if (error) {
                console.error(`Sync registration failed:`, error)
                continue
            }

            // キャッシュの仮データを本物のIDで差し替え
            await db.trees.delete(reg.temp_id)
            if (newTree) {
                const species = await db.species.get(reg.species_id)
                await db.trees.put({
                    ...newTree,
                    shipped_at: null,
                    species: species ? { id: species.id, name: species.name } : { id: reg.species_id, name: reg.species_name },
                    client: null,
                } as CachedTree)
            }

            // 同期済みとしてマーク
            if (reg.id !== undefined) {
                await db.pendingRegistrations.update(reg.id, { synced: 1 })
            }
            syncedCount++
        } catch (err) {
            console.error(`Sync registration error:`, err)
        }
    }

    // 全部成功したら削除
    if (syncedCount === pending.length) {
        await db.pendingRegistrations.where('synced').equals(1).delete()
    }

    return syncedCount
}

// ------------------------------------------------------------------
// ヘルパー: 未同期の新規登録を一覧に含める
// ------------------------------------------------------------------
async function mergePendingRegistrations(trees: CachedTree[]): Promise<CachedTree[]> {
    const pending = await db.pendingRegistrations
        .where('synced')
        .equals(0)
        .toArray()

    if (pending.length === 0) return trees

    // 既にキャッシュに入っている仮IDは除外（重複防止）
    const existingIds = new Set(trees.map(t => t.id))
    const newTrees: CachedTree[] = []

    for (const reg of pending) {
        if (existingIds.has(reg.temp_id)) continue
        newTrees.push({
            id: reg.temp_id,
            species_id: reg.species_id,
            client_id: null,
            height: reg.height,
            trunk_count: reg.trunk_count,
            price: reg.price,
            status: 'in_stock',
            notes: reg.notes,
            shipped_at: null,
            estimate_number: null,
            photo_url: null,
            location: reg.location,
            management_number: null,
            arrived_at: reg.created_at.split('T')[0],
            created_at: reg.created_at,
            updated_at: reg.created_at,
            species: { id: reg.species_id, name: reg.species_name },
            client: null,
        })
    }

    return [...newTrees, ...trees]
}

// ------------------------------------------------------------------
// ヘルパー: shipment_items→shipmentsのネストからshipped_atをフラット化
// ------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flattenShippedAt(rows: any[]): CachedTree[] {
    return rows.map(row => {
        const shippedAt = row.shipment_items?.[0]?.shipments?.shipped_at || null
        const { shipment_items: _, ...rest } = row
        return { ...rest, shipped_at: shippedAt } as CachedTree
    })
}
