import Dexie, { type EntityTable } from 'dexie'

// キャッシュ済み樹木（Supabaseのjoin結果と同等の形）
export interface CachedTree {
    id: string
    species_id: string
    client_id: string | null
    height: number
    trunk_count: number
    price: number
    status: string
    notes: string | null
    shipped_at: string | null
    estimate_number: string | null
    photo_url: string | null
    location: string | null
    management_number: string | null
    arrived_at: string
    created_at: string
    updated_at: string
    species: {
        id: string
        name: string
    }
    client: {
        id: string
        name: string
    } | null
}

// 樹種マスタのキャッシュ
export interface CachedSpecies {
    id: string
    name: string
    name_kana: string | null
    code: string | null
}

// 未同期の編集キュー
export interface PendingEdit {
    id?: number  // auto-increment
    tree_id: string
    field: string
    value: string | number | null
    created_at: string
    synced: 0 | 1  // IndexedDBではbooleanの代わりに0/1
}

// 未同期の新規登録キュー
export interface PendingRegistration {
    id?: number  // auto-increment
    temp_id: string  // 仮ID（UUID）
    species_id: string
    species_name: string  // 表示用
    species_code: string | null  // 管理番号採番用
    height: number
    trunk_count: number
    price: number
    notes: string | null
    location: string | null
    created_at: string
    synced: 0 | 1
}

const db = new Dexie('SatoyamaOfflineDB') as Dexie & {
    trees: EntityTable<CachedTree, 'id'>
    species: EntityTable<CachedSpecies, 'id'>
    pendingEdits: EntityTable<PendingEdit, 'id'>
    pendingRegistrations: EntityTable<PendingRegistration, 'id'>
}

db.version(2).stores({
    trees: 'id, management_number, status, location',
    species: 'id, name',
    pendingEdits: '++id, tree_id, synced',
})

db.version(3).stores({
    trees: 'id, management_number, status, location',
    species: 'id, name',
    pendingEdits: '++id, tree_id, synced',
    pendingRegistrations: '++id, temp_id, synced',
})

export { db }
