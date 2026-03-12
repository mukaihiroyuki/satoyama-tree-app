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

// クライアント別出荷実績を取得
async function getClientSales() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('shipments')
    .select(`
      shipped_at,
      client:clients(id, name),
      shipment_items(unit_price)
    `)

  if (error) {
    console.error('Error fetching client sales:', error)
    return []
  }

  // クライアントごとに集計
  const map = new Map<string, {
    clientId: string
    clientName: string
    totalCount: number
    totalAmount: number
    lastShippedAt: string
  }>()

  for (const shipment of data || []) {
    const client = Array.isArray(shipment.client)
      ? shipment.client[0]
      : shipment.client
    if (!client) continue

    const existing = map.get(client.id) || {
      clientId: client.id,
      clientName: client.name,
      totalCount: 0,
      totalAmount: 0,
      lastShippedAt: '',
    }

    const items = shipment.shipment_items || []
    existing.totalCount += items.length
    existing.totalAmount += items.reduce(
      (sum: number, item: { unit_price: number }) => sum + (item.unit_price || 0),
      0
    )
    if (shipment.shipped_at > existing.lastShippedAt) {
      existing.lastShippedAt = shipment.shipped_at
    }

    map.set(client.id, existing)
  }

  // 売上金額の降順でソート
  return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount)
}

export default async function Home() {
  const stats = await getTreeStats()
  const species = await getSpecies()
  const clientSales = await getClientSales()

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
            title="出荷済み"
            value={stats.shipped}
            unit="本"
            color="purple"
          />
        </div>

        {/* スキャンエラーアラート */}
        <ScanErrorAlerts />

        {/* クライアント別 出荷実績 */}
        {clientSales.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              📊 クライアント別 出荷実績
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="px-4 py-2 text-left">クライアント</th>
                    <th className="px-4 py-2 text-right">本数</th>
                    <th className="px-4 py-2 text-right">売上金額</th>
                    <th className="px-4 py-2 text-right">直近出荷</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {clientSales.map((row) => (
                    <tr key={row.clientId}>
                      <td className="px-4 py-3 font-medium text-gray-800">{row.clientName}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.totalCount}本</td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold text-green-700">
                        ¥{row.totalAmount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-500">{row.lastShippedAt}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 font-bold text-gray-800">
                    <td className="px-4 py-3">合計</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {clientSales.reduce((s, r) => s + r.totalCount, 0)}本
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-green-700">
                      ¥{clientSales.reduce((s, r) => s + r.totalAmount, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

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
            href="/estimates"
            className="text-sm font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 opacity-70 hover:opacity-100 transition-all"
          >
            見積一覧 →
          </Link>
          <Link
            href="/shipments"
            className="text-sm font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 opacity-70 hover:opacity-100 transition-all"
          >
            出荷履歴 →
          </Link>
          <Link
            href="/species"
            className="text-sm font-bold text-green-700 hover:text-green-900 flex items-center gap-1 opacity-70 hover:opacity-100 transition-all"
          >
            🌲 樹種マスター →
          </Link>
          <Link
            href="/clients"
            className="text-sm font-bold text-green-700 hover:text-green-900 flex items-center gap-1 opacity-70 hover:opacity-100 transition-all"
          >
            👤 クライアント管理 →
          </Link>
          <Link
            href="/logs"
            className="text-sm font-bold text-gray-500 hover:text-gray-700 flex items-center gap-1 opacity-60 hover:opacity-100 transition-all"
          >
            操作ログ →
          </Link>
        </div>

        {/* 樹種マスター確認 */}
        <div className="bg-white rounded-xl shadow-lg p-6">
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
