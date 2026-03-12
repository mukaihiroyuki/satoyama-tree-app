'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { useStaffPin } from '@/hooks/useStaffPin'

interface StaffPinGuardProps {
    children: React.ReactNode
}

export default function StaffPinGuard({ children }: StaffPinGuardProps) {
    const pathname = usePathname()
    const { staffName, loaded, login, logout } = useStaffPin()
    const [pin, setPin] = useState('')
    const [error, setError] = useState(false)

    // クライアントポータルはスタッフPIN不要
    if (pathname.startsWith('/c/')) {
        return <>{children}</>
    }

    if (!loaded) return null

    // PIN入力画面
    if (!staffName) {
        function handleSubmit(e: React.FormEvent) {
            e.preventDefault()
            const result = login(pin)
            if (!result) {
                setError(true)
                setPin('')
            }
        }

        function handleDigit(d: string) {
            if (pin.length < 4) {
                const next = pin + d
                setPin(next)
                setError(false)
                if (next.length === 4) {
                    const result = login(next)
                    if (!result) {
                        setError(true)
                        setTimeout(() => setPin(''), 300)
                    }
                }
            }
        }

        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                    <div className="p-6 bg-green-600 text-white text-center">
                        <h1 className="text-2xl font-black">里山樹木管理</h1>
                        <p className="text-green-100 text-sm mt-1">スタッフPINを入力してください</p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {/* PIN表示 */}
                        <div className="flex justify-center gap-3">
                            {[0, 1, 2, 3].map(i => (
                                <div
                                    key={i}
                                    className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-black transition-all ${
                                        pin.length > i
                                            ? 'bg-green-100 border-green-500 text-green-700'
                                            : 'bg-gray-50 border-gray-200 text-gray-300'
                                    } ${error ? 'border-red-400 bg-red-50 animate-shake' : ''}`}
                                >
                                    {pin.length > i ? '*' : ''}
                                </div>
                            ))}
                        </div>

                        {error && (
                            <p className="text-center text-red-600 font-bold text-sm">PINが違います</p>
                        )}

                        {/* テンキー */}
                        <div className="grid grid-cols-3 gap-3">
                            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'DEL'].map(d => (
                                d === '' ? <div key="empty" /> :
                                d === 'DEL' ? (
                                    <button
                                        key="del"
                                        type="button"
                                        onClick={() => { setPin(prev => prev.slice(0, -1)); setError(false) }}
                                        className="py-4 rounded-xl bg-gray-100 hover:bg-gray-200 font-bold text-gray-600 text-lg transition-colors active:scale-95"
                                    >
                                        &larr;
                                    </button>
                                ) : (
                                    <button
                                        key={d}
                                        type="button"
                                        onClick={() => handleDigit(d)}
                                        className="py-4 rounded-xl bg-gray-50 hover:bg-green-50 border border-gray-200 font-bold text-gray-800 text-xl transition-colors active:scale-95 active:bg-green-100"
                                    >
                                        {d}
                                    </button>
                                )
                            ))}
                        </div>
                    </form>
                </div>
            </div>
        )
    }

    // ログイン済み：子コンポーネントを表示 + スタッフバー
    return (
        <div>
            <div className="bg-green-700 text-white text-sm py-2 px-4 flex justify-between items-center">
                <span className="font-black">{staffName} でログイン中</span>
                <button
                    onClick={logout}
                    className="text-green-200 hover:text-white font-bold bg-green-800 px-3 py-0.5 rounded"
                >
                    切替
                </button>
            </div>
            {children}
        </div>
    )
}
