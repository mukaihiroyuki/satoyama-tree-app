'use client'

import { useState, useCallback, useSyncExternalStore } from 'react'
import { STAFF } from '@/lib/constants'

const STORAGE_KEY = 'satoyama_staff_name'

function getSnapshot(): string | null {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && STAFF.some(s => s.name === saved)) return saved
    return null
}

function getServerSnapshot(): string | null {
    return null
}

function subscribe(callback: () => void) {
    window.addEventListener('storage', callback)
    return () => window.removeEventListener('storage', callback)
}

export function useStaffPin() {
    const staffName = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
    const [, setTick] = useState(0)

    const login = useCallback((pin: string): string | null => {
        const found = STAFF.find(s => s.pin === pin)
        if (found) {
            localStorage.setItem(STORAGE_KEY, found.name)
            setTick(t => t + 1)
            return found.name
        }
        return null
    }, [])

    const logout = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY)
        setTick(t => t + 1)
    }, [])

    return { staffName, loaded: true, login, logout }
}

/** localStorage から直接スタッフ名を取得（非React用） */
export function getStaffName(): string | null {
    if (typeof window === 'undefined') return null
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && STAFF.some(s => s.name === saved)) return saved
    return null
}
