import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

// 樹木の統計情報を取得
async function getTreeStats() {
  const supabase = await createClient()

  const { data: trees, error } = await supabase
    .from('trees')
    .select('status, price')

  if (error) {
    console.error('Error fetching trees:', error)
    return { total: 0, in_stock: 0, reserved: 0, shipped: 0, total_value: 0 }
  }

  const stats = {
    total: trees?.length || 0,
    in_stock: trees?.filter(t => t.status === 'in_stock').length || 0,
    reserved: trees?.filter(t => t.status === 'reserved').length || 0,
    shipped: trees?.filter(t => t.status === 'shipped').length || 0,
    total_value: trees?.reduce((sum, t) => sum + (t.price || 0), 0) || 0,
  }

  return stats
}

// 樹種一覧を取得
async function getSpecies() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('species_master')
    .select('*')
    .order('name_kana')

  if (error) {
    console.error('Error fetching species:', error)
    return []
  }

  return data || []
}

export default async function Home() {
  const stats = await getTreeStats()
  const species = await getSpecies()

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-green-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-green-800">
            🌳 里山プロジェクト 樹木管理
          </h1>
          <p className="text-green-600 mt-1">Satoyama Tree Management System</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* 統計カード */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="総在庫数"
            value={stats.total}
            unit="本"
            color="blue"
          />
          <StatCard
            title="販売可能"
            value={stats.in_stock}
            unit="本"
            color="green"
          />
          <StatCard
            title="予約済み"
            value={stats.reserved}
            unit="本"
            color="yellow"
          />
          <StatCard
            title="在庫総額"
            value={stats.total_value.toLocaleString()}
            unit="円"
            color="purple"
          />
        </div>

        {/* アクションボタン */}
        <div className="flex flex-wrap gap-4 mb-2">
          <Link
            href="/scan"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold shadow-lg transition-all"
          >
            🔍 QRスキャン
          </Link>
          <Link
            href="/trees/new"
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold shadow-lg transition-all"
          >
            ➕ 樹木を登録
          </Link>
          <Link
            href="/trees"
            className="flex items-center gap-2 bg-white hover:bg-gray-50 text-green-700 px-6 py-3 rounded-lg font-semibold shadow border border-green-300 transition-all"
          >
            📋 一覧を見る
          </Link>
        </div>
        <div className="mb-8 flex justify-between items-center">
          <Link
            href="/shipments"
            className="text-sm font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 opacity-70 hover:opacity-100 transition-all"
          >
            📦 出荷履歴を見る →
          </Link>
          <Link
            href="/clients"
            className="text-sm font-bold text-green-700 hover:text-green-900 flex items-center gap-1 opacity-70 hover:opacity-100 transition-all"
          >
            👤 クライアント管理 →
          </Link>
        </div>

        {/* 樹種マスター確認 */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            📌 登録済み樹種 ({species.length}種)
          </h2>
          <div className="flex flex-wrap gap-2">
            {species.map((s) => (
              <span
                key={s.id}
                className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm"
              >
                {s.name}
              </span>
            ))}
          </div>
          {species.length === 0 && (
            <p className="text-gray-500">樹種が登録されていません</p>
          )}
        </div>

        {/* 接続確認 */}
        <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700">
            ✅ Supabase接続確認: {species.length > 0 ? '成功！' : 'データなし'}
          </p>
        </div>
      </main>
    </div>
  )
}

// 統計カードコンポーネント
function StatCard({
  title,
  value,
  unit,
  color
}: {
  title: string
  value: number | string
  unit: string
  color: 'blue' | 'green' | 'yellow' | 'purple'
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    purple: 'bg-purple-50 border-purple-200 text-purple-800',
  }

  return (
    <div className={`rounded-xl border-2 p-4 ${colorClasses[color]}`}>
      <p className="text-sm font-medium opacity-80">{title}</p>
      <p className="text-2xl font-bold mt-1">
        {value}<span className="text-sm ml-1">{unit}</span>
      </p>
    </div>
  )
}
