// 出荷日などの日付(YYYY-MM-DD)から「年度」を求める共通ユーティリティ。
// 年度は4月〜翌3月。令和N年度 = 西暦(2018+N)年4/1〜翌年3/31。
// 例: 2025-04-01〜2026-03-31 → 令和7年度(R7)

export interface FiscalYear {
    reiwa: number    // 令和の年（R7なら7）
    startYear: number // 年度の開始年（西暦。R7なら2025）
}

export function getFiscalYear(dateStr: string | null | undefined): FiscalYear | null {
    if (!dateStr) return null
    const year = parseInt(dateStr.slice(0, 4), 10)
    const month = parseInt(dateStr.slice(5, 7), 10)
    if (!year || !month) return null
    const startYear = month >= 4 ? year : year - 1 // 年度の開始年（西暦）
    return { reiwa: startYear - 2018, startYear }
}

// ドロップダウン等の表示用ラベル。例: 「R7年度（2025/4〜2026/3）」
export function fiscalYearLabel(fy: FiscalYear): string {
    return `R${fy.reiwa}年度（${fy.startYear}/4〜${fy.startYear + 1}/3）`
}
