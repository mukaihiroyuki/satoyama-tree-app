'use client'

import Link from 'next/link'

export default function OfflineFallbackPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center px-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center space-y-4">
                <p className="text-4xl">⚡</p>
                <h1 className="text-xl font-bold text-gray-800">オフラインです</h1>
                <p className="text-gray-600 text-sm">
                    このページはまだキャッシュされていません。
                    電波のある場所で一度開くと、次回からオフラインでも表示できます。
                </p>
                <div className="pt-4 space-y-2">
                    <Link
                        href="/trees"
                        className="block bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold"
                    >
                        樹木一覧へ
                    </Link>
                    <button
                        onClick={() => window.location.reload()}
                        className="block w-full border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50"
                    >
                        再読み込み
                    </button>
                </div>
            </div>
        </div>
    )
}
