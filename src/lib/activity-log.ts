import { createClient } from '@/lib/supabase/client'
import { getStaffName } from '@/hooks/useStaffPin'

export type ActionType =
    | 'create'
    | 'edit'
    | 'reserve'
    | 'cancel_reserve'
    | 'ship'
    | 'cancel_ship'
    | 'delete'
    | 'estimate'
    | 'scan_error'
    | 'unbind_client'
    | 'disable'
    | 'enable'

export async function logActivity(
    action: ActionType,
    treeId: string | null,
    details?: Record<string, unknown>
) {
    try {
        const supabase = createClient()
        const actor = getStaffName()

        await supabase.from('activity_logs').insert({
            tree_id: treeId,
            action,
            details: details || null,
            actor,
        })
    } catch (e) {
        // ログ記録の失敗で本体処理を止めない
        console.error('activity log error:', e)
    }
}

/** 複数tree_idに対して同じログを一括記録 */
export async function logActivityBulk(
    action: ActionType,
    treeIds: string[],
    details?: Record<string, unknown>
) {
    try {
        const supabase = createClient()
        const actor = getStaffName()

        const rows = treeIds.map(treeId => ({
            tree_id: treeId,
            action,
            details: details || null,
            actor,
        }))

        const { error } = await supabase.from('activity_logs').insert(rows)
        if (error) throw error
    } catch (e) {
        console.error('activity log error:', e)
    }
}
