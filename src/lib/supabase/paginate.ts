// PostgREST/Supabase の max-rows=1000 頭打ちを回避して、子テーブルの行を全件取得するヘルパー。
//
// 背景: ネスト埋め込み（例 `estimates?select=...,estimate_items(...)`）は、
// 親1件あたりの子リソースが最大1000行までしか返らない。見積明細が1000本を超えると
// 見積書PDF・一覧・詳細が全て「1000本ぶん」で切れて金額まで過少になる事故が起きた
// （2026-07-01 発覚: 3010本の見積が1000本表示）。
// 対策として、子テーブルを埋め込みではなく直接クエリし、`.range()` で1000件ずつ回して全件連結する。
//
// build(from, to) には range を除いた select/filter/order 済みのクエリを渡す。
// range の安定性のため、呼び出し側で必ず一意に定まる order を指定すること。

export const SUPABASE_PAGE_SIZE = 1000

// build は Supabase のクエリビルダー（.select().eq().order().range() 済み）をそのまま返せばよい。
// ネストジョインの型はビルダー推論とアプリ側の型がズレるため（species が配列推論になる等）、
// ここで data を T[] として受け取り直す（直接ジェネリック指定だとビルド失敗する既知の罠の回避）。
export async function fetchAllRows<T>(
    build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>
): Promise<T[]> {
    const all: T[] = []
    let from = 0
    // 無限ループ保険（1000ページ=100万行で打ち切り。通常あり得ない）
    for (let guard = 0; guard < 1000; guard++) {
        const { data, error } = await build(from, from + SUPABASE_PAGE_SIZE - 1)
        if (error) throw error
        const rows = (data as T[] | null) ?? []
        if (rows.length > 0) all.push(...rows)
        if (rows.length < SUPABASE_PAGE_SIZE) break
        from += SUPABASE_PAGE_SIZE
    }
    return all
}
