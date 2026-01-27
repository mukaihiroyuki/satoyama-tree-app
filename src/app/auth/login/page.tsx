'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')
    const [isSuccess, setIsSuccess] = useState(false)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage('')
        setIsSuccess(false)

        const supabase = createClient()

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        })

        if (error) {
            setMessage('ログインに失敗しました。メールアドレスを確認してください。')
            setIsSuccess(false)
        } else {
            setMessage('確認メールを送信しました。メール内のリンクをクリックしてログインしてください。')
            setIsSuccess(true)
        }
        setLoading(false)
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="text-5xl mb-4">🌲</div>
                    <h1 className="text-2xl font-bold text-green-800">
                        里山プロジェクト
                    </h1>
                    <p className="text-gray-500 mt-2">樹木管理システム</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                            メールアドレス
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your-email@example.com"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                            required
                            disabled={loading}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !email}
                        className="w-full py-3 px-4 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? '送信中...' : 'ログインリンクを送信'}
                    </button>
                </form>

                {message && (
                    <div className={`mt-6 p-4 rounded-lg text-sm ${
                        isSuccess
                            ? 'bg-green-50 text-green-800 border border-green-200'
                            : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                        {message}
                    </div>
                )}

                <div className="mt-8 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
                    <p>登録済みのメールアドレスでログインしてください</p>
                    <p className="mt-1">アカウントがない場合は管理者に連絡してください</p>
                </div>
            </div>
        </div>
    )
}
