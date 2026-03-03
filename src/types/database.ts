// Database Types for Satoyama Tree App
// Generated from DBスキーマ設計書.md

export type TreeStatus = 'in_stock' | 'reserved' | 'shipped' | 'dead'

export interface SpeciesMaster {
    id: string
    name: string
    name_kana: string | null
    code: string | null  // 樹種コード（AO, MO, KY等）
    created_at: string
}

export interface Tree {
    id: string
    species_id: string
    height: number
    trunk_count: number
    price: number
    status: TreeStatus
    notes: string | null
    photo_url: string | null
    location: string | null
    management_number: string | null  // 管理番号（25-AO-0001形式）
    arrived_at: string
    created_at: string
    updated_at: string
}

export interface TreeWithSpecies extends Tree {
    species: SpeciesMaster
}

export interface Shipment {
    id: string
    shipped_at: string
    destination: string
    notes: string | null
    created_at: string
}

export interface ShipmentItem {
    id: string
    shipment_id: string
    tree_id: string
    created_at: string
}

export interface ShipmentWithItems extends Shipment {
    items: (ShipmentItem & { tree: TreeWithSpecies })[]
}

// Insert/Update types (without auto-generated fields)
export interface TreeInsert {
    species_id: string
    height: number
    trunk_count?: number
    price: number
    status?: TreeStatus
    notes?: string
    photo_url?: string
    location?: string
    management_number?: string  // 管理番号（25-AO-0001形式）
    arrived_at?: string
}

export interface TreeUpdate {
    species_id?: string
    height?: number
    trunk_count?: number
    price?: number
    status?: TreeStatus
    notes?: string
    photo_url?: string
    location?: string
}

export interface ShipmentInsert {
    shipped_at: string
    destination: string
    notes?: string
}

// Estimate types
export type EstimateStatus = '下書き' | '発行済' | '出荷済'

export interface Estimate {
    id: string
    estimate_number: string
    client_id: string | null
    rate: number | null
    status: EstimateStatus
    issued_at: string | null
    notes: string | null
    created_at: string
    updated_at: string
}

export interface EstimateItem {
    id: string
    estimate_id: string
    tree_id: string
    unit_price: number
    created_at: string
}

export interface EstimateWithItems extends Estimate {
    client: { name: string; address: string | null } | null
    estimate_items: (EstimateItem & {
        tree: {
            id: string
            management_number: string | null
            height: number
            trunk_count: number
            price: number
            species: { name: string } | null
        } | null
    })[]
}

// Statistics types
export interface TreeStats {
    total: number
    in_stock: number
    reserved: number
    shipped: number
    dead: number
    total_value: number
}
