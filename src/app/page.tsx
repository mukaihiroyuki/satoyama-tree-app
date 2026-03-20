import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import OfflineCacheWarmer from '@/components/OfflineCacheWarmer'
import ScanErrorAlerts from '@/components/ScanErrorAlerts'

// 樹木の統計情報を取得
async function getTreeStats() {
  const supabase = await createClient()

  const { data: trees, error } = await supabase
    .from('trees')
    .select('status')

  if (error) {
    console.error('Error fetching trees:', error)
    return { total: 0, in_stock: 0, reserved: 0, shipped: 0 }
  }

  const stats = {
    total: trees?.length || 0,
    in_stock: trees?.filter(t => t.status === 'in_stock').length || 0,
    reserved: trees?.filter(t => t.status === 'reserved').length || 0,
    shipped: trees?.filter(t => t.status === 'shipped').length || 0,
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
        {/* オフラインキャッシュ準備 */}
        <OfflineCacheWarmer />

        {/* 統計カード（タップで遷移） */}
        <div className="mb-8">
          <StatCard
            title="総登録数"
            value={stats.total}
            unit="本"
            color="blue"
            href="/trees"
            large
          />
          <div className="grid grid-cols-3 gap-3 mt-3 pl-4">
            <StatCard
              title="販売可能"
              value={stats.in_stock}
              unit="本"
              color="green"
              href="/trees?status=in_stock"
            />
            <StatCard
              title="予約済み"
              value={stats.reserved}
              unit="本"
              color="yellow"
              href="/trees?status=reserved"
            />
            <StatCard
              title="出荷済み"
              value={stats.shipped}
              unit="本"
              color="purple"
              href="/shipments"
            />
          </div>
        </div>

        {/* スキャンエラーアラート */}
        <ScanErrorAlerts />

        {/* 現場メインアクション */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Link
            href="/shipments"
            className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-4 rounded-xl font-bold text-lg shadow-lg transition-all active:scale-95"
          >
            📦 ピッキング
          </Link>
          <Link
            href="/trees/new"
            className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-xl font-bold text-lg shadow-lg transition-all active:scale-95"
          >
            ➕ 樹木を登録
          </Link>
          <Link
            href="/trees"
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-xl font-bold text-lg shadow-lg transition-all active:scale-95"
          >
            📋 一覧を見る
          </Link>
          <Link
            href="/scan"
            className="flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-6 py-4 rounded-xl font-bold text-lg shadow-lg transition-all active:scale-95"
          >
            🔍 QRスキャン
          </Link>
        </div>

        {/* 樹種マスター確認 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">
              📌 登録済み樹種 ({species.length}種)
            </h2>
            <Link
              href="/species"
              className="text-sm font-bold text-green-600 hover:text-green-800 transition-colors"
            >
              管理画面 →
            </Link>
          </div>
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

        {/* 事務用メニュー */}
        <details>
          <summary className="cursor-pointer bg-white hover:bg-gray-50 border-2 border-gray-300 rounded-xl px-6 py-4 font-bold text-gray-600 text-lg text-center shadow transition-all select-none">
            🗂️ 管理メニュー（事務用）
          </summary>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3 pl-4">
            <Link
              href="/estimates"
              className="bg-white hover:bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm font-bold text-gray-700 text-center transition-all"
            >
              見積一覧
            </Link>
            <Link
              href="/shipments"
              className="bg-white hover:bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm font-bold text-gray-700 text-center transition-all"
            >
              出荷履歴
            </Link>
            <Link
              href="/species"
              className="bg-white hover:bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm font-bold text-gray-700 text-center transition-all"
            >
              樹種マスター
            </Link>
            <Link
              href="/clients"
              className="bg-white hover:bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm font-bold text-gray-700 text-center transition-all"
            >
              クライアント管理
            </Link>
            <Link
              href="/logs"
              className="bg-white hover:bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm font-bold text-gray-700 text-center transition-all"
            >
              操作ログ
            </Link>
          </div>
        </details>

      </main>
    </div>
  )
}

// 統計カードコンポーネント（タップで遷移）
function StatCard({
  title,
  value,
  unit,
  color,
  href,
  large
}: {
  title: string
  value: number | string
  unit: string
  color: 'blue' | 'green' | 'yellow' | 'purple'
  href: string
  large?: boolean
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100',
    green: 'bg-green-50 border-green-200 text-green-800 hover:bg-green-100',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800 hover:bg-yellow-100',
    purple: 'bg-purple-50 border-purple-200 text-purple-800 hover:bg-purple-100',
  }

  return (
    <Link href={href} className={`block rounded-xl border-2 transition-colors active:scale-95 ${colorClasses[color]} ${large ? 'p-6' : 'p-4'}`}>
      <p className={`font-medium opacity-80 ${large ? 'text-base' : 'text-sm'}`}>{title}</p>
      <p className={`font-bold mt-1 ${large ? 'text-3xl' : 'text-2xl'}`}>
        {value}<span className={`ml-1 ${large ? 'text-base' : 'text-sm'}`}>{unit}</span>
      </p>
    </Link>
  )
}
