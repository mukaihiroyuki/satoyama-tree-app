import { db, type CachedTree, type CachedSpecies, type PendingRegistration } from './db'
import { createClient } from './supabase/client'
import { PRIORITY_SPECIES } from './constants'

export type TreeUpdate = Record<string, string | number | null>

// ------------------------------------------------------------------
// 一覧取得（オフラインファースト）
// キャッシュを即座に返し、バックグラウンドでSupabase同期
// ------------------------------------------------------------------
export async function getAllTrees(
    onRefresh?: (trees: CachedTree[]) => void
): Promise<CachedTree[]> {
    // 1. キャッシュから即座に返す
    let cached: CachedTree[]
    try {
        cached = await db.trees.toArray()
        cached.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    } catch (dbErr) {
        console.error('[getAllTrees] IndexedDB read failed:', dbErr)
        cached = []
    }
    const withEdits = await applyPendingEditsToList(cached)
    const result = await mergePendingRegistrations(withEdits)

    // キャッシュが空の場合（初回起動・ストレージクリア後）はSupabaseを待つ
    if (result.length === 0) {
        try {
            const supabase = createClient()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let allData: any[] = []
            let from = 0
            const PAGE_SIZE = 1000
            while (true) {
                const { data: page, error: pageError } = await supabase
                    .from('trees')
                    .select('*, species:species_master(id, name), client:clients(id, name), shipment_items(shipments(shipped_at))')
                    .order('created_at', { ascending: false })
                    .range(from, from + PAGE_SIZE - 1)
                if (pageError) {
                    console.error('[getAllTrees] Supabase error:', pageError)
                    return result
                }
                if (page) allData = allData.concat(page)
                if (!page || page.length < PAGE_SIZE) break
                from += PAGE_SIZE
            }
            const data = allData

            if (data.length > 0) {
                const trees = flattenShippedAt(data)
                // キャッシュ保存（失敗してもデータは返す）
                try {
                    await db.trees.clear()
                    await db.trees.bulkPut(trees)
                } catch (cacheErr) {
                    console.error('[getAllTrees] Cache write failed:', cacheErr)
                }
                const withEdits2 = await applyPendingEditsToList(trees)
                return mergePendingRegistrations(withEdits2)
            }
        } catch (err) {
            console.error('[getAllTrees] Network error:', err)
        }
        return result
    }

    // 2. バックグラウンドでSupabaseフェッチ（awaitしない）
    if (onRefresh) {
        refreshTreesFromSupabase(onRefresh).catch(() => {/* 静かに失敗 */})
    }

    return result
}

async function refreshTreesFromSupabase(onRefresh: (trees: CachedTree[]) => void) {
    try {
        const supabase = createClient()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let allData: any[] = []
        let from = 0
        const PAGE_SIZE = 1000
        while (true) {
            const { data: page, error: pageError } = await supabase
                .from('trees')
                .select('*, species:species_master(id, name), client:clients(id, name), shipment_items(shipments(shipped_at))')
                .order('created_at', { ascending: false })
                .range(from, from + PAGE_SIZE - 1)
            if (pageError) {
                console.error('[refreshTrees] Supabase error:', pageError)
                return
            }
            if (page) allData = allData.concat(page)
            if (!page || page.length < PAGE_SIZE) break
            from += PAGE_SIZE
        }
        const data = allData
        if (data.length === 0) return

        const trees = flattenShippedAt(data)
        try {
            await db.trees.clear()
            await db.trees.bulkPut(trees)
        } catch (cacheErr) {
            console.error('[refreshTrees] Cache write failed:', cacheErr)
        }

        // 最新データにpendingEdits/Registrationsを適用して通知
        const withEdits = await applyPendingEditsToList(trees)
        const merged = await mergePendingRegistrations(withEdits)
        onRefresh(merged)
    } catch (err) {
        console.error('[refreshTrees] Network error:', err)
    }
}

// ------------------------------------------------------------------
// 単体取得（オフラインファースト）
// ------------------------------------------------------------------
export async function getTree(
    id: string,
    onRefresh?: (tree: CachedTree | null) => void
): Promise<CachedTree | null> {
    // 1. キャッシュから即座に返す
    const cached = await db.trees.get(id)
    const result = cached ? await applyPendingEdits(cached) : null

    // キャッシュにない場合（初回起動・ストレージクリア後）はSupabaseを待つ
    if (!result) {
        // pendingRegistrationsにある仮データかチェック
        const pendingReg = await db.pendingRegistrations.where('temp_id').equals(id).first()
        if (pendingReg) {
            return {
                id: pendingReg.temp_id,
                species_id: pendingReg.species_id,
                client_id: null,
                height: pendingReg.height,
                trunk_count: pendingReg.trunk_count,
                price: pendingReg.price,
                status: 'in_stock',
                notes: pendingReg.notes,
                shipped_at: null,
                estimate_number: null,
                photo_url: null,
                location: pendingReg.location,
                management_number: pendingReg.management_number,
                arrived_at: pendingReg.created_at.split('T')[0],
                created_at: pendingReg.created_at,
                updated_at: pendingReg.created_at,
                species: { id: pendingReg.species_id, name: pendingReg.species_name },
                client: null,
            } as CachedTree
        }

        try {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('trees')
                .select('*, species:species_master(id, name), client:clients(id, name), shipment_items(shipments(shipped_at))')
                .eq('id', id)
                .single()

            if (error) {
                console.error('[getTree] Supabase error:', error)
                return null
            }

            if (data) {
                const tree = flattenShippedAt([data])[0]
                try { await db.trees.put(tree) } catch { /* cache write optional */ }
                return applyPendingEdits(tree)
            }
        } catch (err) {
            console.error('[getTree] Network error:', err)
        }
        return null
    }

    // 2. バックグラウンドでSupabaseフェッチ
    if (onRefresh) {
        refreshTreeFromSupabase(id, onRefresh).catch(() => {/* 静かに失敗 */})
    }

    return result
}

async function refreshTreeFromSupabase(id: string, onRefresh: (tree: CachedTree | null) => void) {
    try {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('trees')
            .select('*, species:species_master(id, name), client:clients(id, name), shipment_items(shipments(shipped_at))')
            .eq('id', id)
            .single()

        if (error || !data) return

        const tree = flattenShippedAt([data])[0]
        await db.trees.put(tree)
        const withEdits = await applyPendingEdits(tree)
        onRefresh(withEdits)
    } catch {
        // 静かに無視
    }
}

// ------------------------------------------------------------------
// 樹種ソート: 優先樹種を上位に、残りはname_kana順
// ------------------------------------------------------------------
function sortSpecies(list: CachedSpecies[]): CachedSpecies[] {
    return [...list].sort((a, b) => {
        const ai = PRIORITY_SPECIES.indexOf(a.name as typeof PRIORITY_SPECIES[number])
        const bi = PRIORITY_SPECIES.indexOf(b.name as typeof PRIORITY_SPECIES[number])
        if (ai !== -1 && bi !== -1) return ai - bi
        if (ai !== -1) return -1
        if (bi !== -1) return 1
        return (a.name_kana || a.name).localeCompare(b.name_kana || b.name)
    })
}

// ------------------------------------------------------------------
// 樹種マスタ取得（オフラインファースト）
// ------------------------------------------------------------------
export async function getAllSpecies(
    onRefresh?: (species: CachedSpecies[]) => void
): Promise<CachedSpecies[]> {
    // 1. キャッシュから即座に返す
    const cached = await db.species.toArray()

    // キャッシュが空の場合（初回起動）はSupabaseを待つ
    if (cached.length === 0) {
        try {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('species_master')
                .select('id, name, name_kana, code')
                .order('name_kana')

            if (error) {
                console.error('[getAllSpecies] Supabase error:', error)
                return sortSpecies(cached)
            }

            if (data && data.length > 0) {
                try {
                    await db.species.clear()
                    await db.species.bulkPut(data as CachedSpecies[])
                } catch (cacheErr) {
                    console.error('[getAllSpecies] Cache write failed:', cacheErr)
                }
                return sortSpecies(data as CachedSpecies[])
            }
        } catch (err) {
            console.error('[getAllSpecies] Network error:', err)
        }
        return sortSpecies(cached)
    }

    // 2. キャッシュがある場合のみバックグラウンドで更新
    if (onRefresh) {
        refreshSpeciesFromSupabase(onRefresh).catch(() => {/* 静かに失敗 */})
    }

    return sortSpecies(cached)
}

async function refreshSpeciesFromSupabase(onRefresh?: (species: CachedSpecies[]) => void) {
    try {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('species_master')
            .select('id, name, name_kana, code')
            .order('name_kana')

        if (error || !data) return

        await db.species.clear()
        await db.species.bulkPut(data as CachedSpecies[])
        onRefresh?.(sortSpecies(data as CachedSpecies[]))
    } catch {
        // 静かに無視
    }
}

// ------------------------------------------------------------------
// 編集保存（常にローカル優先 + バックグラウンド同期）
// ------------------------------------------------------------------
export async function saveEdit(
    treeId: string,
    updates: TreeUpdate
): Promise<{ offline: boolean }> {
    // 常にまずローカルに保存
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

    // バックグラウンドでSupabase送信を試みる
    let synced = false
    try {
        const supabase = createClient()
        const { error } = await supabase
            .from('trees')
            .update(updates)
            .eq('id', treeId)

        if (!error) {
            // 成功 → pendingEditsから該当レコード削除
            const pending = await db.pendingEdits
                .where('tree_id')
                .equals(treeId)
                .filter(e => e.synced === 0 && e.created_at === now)
                .toArray()
            const ids = pending.map(p => p.id).filter((id): id is number => id !== undefined)
            if (ids.length > 0) {
                await db.pendingEdits.bulkDelete(ids)
            }
            synced = true
        }
    } catch {
        // ネットワークエラー: pendingEditsに残る（次回同期で送信）
    }

    return { offline: !synced }
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
// オフライン新規登録（管理番号をローカル採番）
// ------------------------------------------------------------------
export async function registerTreeOffline(reg: Omit<PendingRegistration, 'id' | 'synced' | 'management_number'>): Promise<{ tempId: string; managementNumber: string | null }> {
    // ローカル管理番号採番
    let managementNumber: string | null = null
    if (reg.species_code) {
        const year = new Date(reg.created_at).getFullYear().toString().slice(-2)
        const prefix = `${year}-${reg.species_code}-`

        // IndexedDBから同prefixの最大番号を検索
        const existing = await db.trees
            .where('management_number')
            .startsWith(prefix)
            .toArray()

        // pendingRegistrationsの未同期分も確認（連番衝突防止）
        const pendingRegs = await db.pendingRegistrations
            .where('synced')
            .equals(0)
            .toArray()
        const pendingNumbers = pendingRegs
            .map(p => p.management_number)
            .filter((n): n is string => !!n && n.startsWith(prefix))

        const allNumbers = [
            ...existing.map(t => t.management_number).filter((n): n is string => !!n),
            ...pendingNumbers,
        ]

        const maxNum = allNumbers.reduce((max, n) => {
            const num = parseInt(n.split('-')[2])
            return isNaN(num) ? max : Math.max(max, num)
        }, 0)

        managementNumber = `${prefix}${(maxNum + 1).toString().padStart(4, '0')}`
    }

    // pendingRegistrationsに保存
    await db.pendingRegistrations.add({ ...reg, management_number: managementNumber, synced: 0 })

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
        management_number: managementNumber,
        arrived_at: now.split('T')[0],
        created_at: now,
        updated_at: now,
        species: { id: reg.species_id, name: reg.species_name },
        client: null,
    }
    await db.trees.put(cachedTree)

    return { tempId: reg.temp_id, managementNumber }
}

// ------------------------------------------------------------------
// 未同期の新規登録を同期
// ------------------------------------------------------------------
// temp_id → 新IDのマッピング（同期後のリダイレクトに使用）
const syncedIdMap = new Map<string, string>()

export function getSyncedNewId(tempId: string): string | undefined {
    return syncedIdMap.get(tempId)
}

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
            // サーバー側で正式な管理番号を採番（衝突安全）
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
                syncedIdMap.set(reg.temp_id, newTree.id)
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
            management_number: reg.management_number,
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
