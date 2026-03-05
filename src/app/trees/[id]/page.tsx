'use client'

import React, { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import PrintLabel from '@/components/PrintLabel'
import TreeEditForm from '@/components/TreeEditForm'
import { buildSmoothPrintUrl, type TreeLabelData } from '@/lib/smoothprint'
import ShipmentDialog from '@/components/ShipmentDialog'
import ReservationDialog from '@/components/ReservationDialog'
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog'
import ActivityLogList from '@/components/ActivityLogList'
import { useTree } from '@/hooks/useTree'
import { logActivity } from '@/lib/activity-log'

const statusLabels: Record<string, { label: string; color: string }> = {
    in_stock: { label: '在庫あり', color: 'bg-green-100 text-green-800 border-green-300' },
    reserved: { label: '予約済み', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    shipped: { label: '出荷済み', color: 'bg-blue-100 text-blue-800 border-blue-300' },
    dead: { label: '枯死', color: 'bg-gray-100 text-gray-800 border-gray-300' },
}

export default function TreeDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params)
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { tree, loading, isOnline, saveEdit, saveMessage, refreshData } = useTree(id)
    const [uploading, setUploading] = useState(false)
    const [isShipmentDialogOpen, setIsShipmentDialogOpen] = useState(false)
    const [isReservationDialogOpen, setIsReservationDialogOpen] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [printLayout, setPrintLayout] = useState<'RJ-100' | 'PT-36' | 'PT-24'>('PT-36')
    const [printMode, setPrintMode] = useState<'airprint' | 'bluetooth'>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('printMode') as 'airprint' | 'bluetooth') || 'airprint'
        }
        return 'airprint'
    })

    // 印刷モード切替時に localStorage に保存
    function handlePrintModeChange(mode: 'airprint' | 'bluetooth') {
        setPrintMode(mode)
        localStorage.setItem('printMode', mode)
    }

    // 印刷実行
    function handlePrint() {
        if (!tree) return

        if (printMode === 'airprint') {
            window.print()
            return
        }

        // Bluetooth (Smooth Print) 印刷
        const labelData: TreeLabelData = {
            species: tree.species?.name || '',
            price: tree.price,
            managementNumber: tree.management_number,
            treeId: tree.id,
        }
        const baseUrl = window.location.origin
        const url = buildSmoothPrintUrl(labelData, baseUrl)

        if (confirm('Smooth Print が開きます。印刷後はホーム画面からアプリに戻ってください。')) {
            window.location.href = url
        }
    }

    // 写真アップロード（オンライン専用）
    async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file || !tree) return

        // ファイル検証
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp']

        if (!allowedMimeTypes.includes(file.type)) {
            alert('PNG, JPEG, WebP形式の画像のみ対応しています')
            return
        }

        setUploading(true)
        const supabase = createClient()

        // 安全なファイル拡張子を決定
        const extMap: Record<string, string> = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp'
        }
        const fileExt = extMap[file.type] || 'jpg'
        const fileName = `${tree.id}-${Date.now()}.${fileExt}`

        // 画像を圧縮（最大幅1200px）
        const compressedFile = await compressImage(file, 1200, 0.8)

        // Storageにアップロード
        const { error: uploadError } = await supabase.storage
            .from('tree-photos')
            .upload(fileName, compressedFile)

        if (uploadError) {
            console.error('Upload error:', uploadError)
            alert('アップロードに失敗しました')
            setUploading(false)
            return
        }

        // 公開URLを取得
        const { data: urlData } = supabase.storage
            .from('tree-photos')
            .getPublicUrl(fileName)

        // DBを更新
        const { error: updateError } = await supabase
            .from('trees')
            .update({ photo_url: urlData.publicUrl })
            .eq('id', tree.id)

        if (updateError) {
            console.error('Update error:', updateError)
            alert('保存に失敗しました')
            setUploading(false)
            return
        }

        // 再読み込み
        refreshData()
        setUploading(false)
    }

    // 状態変更（useTree.saveEditを経由）
    // 「出荷済み」は出荷ダイアログ経由で処理（出荷レコード作成のため）
    async function handleStatusChange(newStatus: string) {
        if (!tree) return
        if (newStatus === 'shipped') {
            setIsShipmentDialogOpen(true)
            return
        }
        if (newStatus === 'reserved') {
            setIsReservationDialogOpen(true)
            return
        }
        // 予約済み → 在庫に戻す場合、client_idもクリア
        if (tree.status === 'reserved' && newStatus === 'in_stock') {
            if (!confirm('予約を取り消して在庫に戻しますか？')) return
            await saveEdit({ status: 'in_stock', client_id: null })
            await logActivity('cancel_reserve', tree.id)
            return
        }
        await saveEdit({ status: newStatus })
    }

    // 削除（オンライン専用・3段階確認ダイアログ経由）
    async function executeDelete() {
        if (!tree) return
        const supabase = createClient()
        const { error } = await supabase
            .from('trees')
            .delete()
            .eq('id', tree.id)

        if (error) {
            console.error('Error:', error)
            alert('削除に失敗しました')
            return
        }

        await logActivity('delete', tree.id, { management_number: tree.management_number })
        setIsDeleteDialogOpen(false)
        router.back()
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
                <p className="text-green-700">読み込み中...</p>
            </div>
        )
    }

    if (!tree) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-500 mb-4">樹木が見つかりません</p>
                    <Link href="/trees" className="text-green-600 hover:underline">一覧に戻る</Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 print:bg-white print:min-h-0">
            {/* ヘッダー */}
            <header className="bg-white shadow-sm border-b border-green-200 print:hidden">
                <div className="max-w-3xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/trees" className="text-green-600 hover:text-green-800">
                                ← 戻る
                            </Link>
                            <h1 className="text-2xl font-bold text-green-800">
                                {tree.management_number || ''} {tree.species?.name}
                            </h1>
                        </div>
                        <div className="flex items-center gap-2">
                            {printMode === 'airprint' && (
                                <select
                                    value={printLayout}
                                    onChange={(e) => setPrintLayout(e.target.value as 'RJ-100' | 'PT-36' | 'PT-24')}
                                    className="text-sm border-green-300 rounded-md py-2 px-1 text-green-700 font-bold bg-green-50"
                                >
                                    <option value="PT-36">PT-36 (36mm)</option>
                                    <option value="PT-24">PT-24 (24mm)</option>
                                    <option value="RJ-100">RJ-100 (100mm)</option>
                                </select>
                            )}
                            <select
                                value={printMode}
                                onChange={(e) => handlePrintModeChange(e.target.value as 'airprint' | 'bluetooth')}
                                className="text-sm border-blue-300 rounded-md py-2 px-1 text-blue-700 font-bold bg-blue-50"
                            >
                                <option value="airprint">AirPrint</option>
                                <option value="bluetooth">Bluetooth</option>
                            </select>
                            <button
                                onClick={handlePrint}
                                className={`text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm ${
                                    printMode === 'bluetooth'
                                        ? 'bg-blue-600 hover:bg-blue-700'
                                        : 'bg-green-600 hover:bg-green-700'
                                }`}
                            >
                                {printMode === 'bluetooth' ? '📱 Bluetooth印刷' : '🖨️ 印刷'}
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-8 space-y-6 print:hidden">
                {/* オフラインインジケーター */}
                {!isOnline && (
                    <div className="bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-3 flex items-center gap-3">
                        <span className="text-yellow-600 text-lg">⚡</span>
                        <div>
                            <p className="text-sm font-bold text-yellow-800">オフラインモード</p>
                            <p className="text-xs text-yellow-600">キャッシュデータを表示中。編集はローカルに保存されます。</p>
                        </div>
                    </div>
                )}

                {/* 写真セクション */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4">写真</h2>

                    {tree.photo_url ? (
                        <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100">
                            <Image
                                src={tree.photo_url}
                                alt={`${tree.species?.name}の写真`}
                                fill
                                className="object-cover"
                            />
                        </div>
                    ) : (
                        <div className="aspect-video rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                            写真なし
                        </div>
                    )}

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoUpload}
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading || !isOnline}
                        className="mt-4 w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-semibold"
                    >
                        {!isOnline ? '写真変更はオンライン時のみ' : uploading ? 'アップロード中...' : tree.photo_url ? '写真を変更' : '写真を追加'}
                    </button>
                </div>

                {/* 管理番号（大きく表示） */}
                {tree.management_number && (
                    <div className="bg-green-50 border-2 border-green-300 rounded-xl p-6 text-center">
                        <p className="text-sm text-green-600 font-bold mb-1">管理番号</p>
                        <p className="text-4xl font-mono font-black text-green-800">{tree.management_number}</p>
                        <p className="text-xs text-green-500 mt-2">※ この番号を木に手書きしてください</p>
                    </div>
                )}

                {/* 基本情報（編集フォーム） */}
                <TreeEditForm
                    tree={tree}
                    isOnline={isOnline}
                    saveMessage={saveMessage}
                    onSave={saveEdit}
                />

                {/* 状態変更 */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4">状態</h2>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(statusLabels).map(([key, { label, color }]) => (
                            <button
                                key={key}
                                onClick={() => handleStatusChange(key)}
                                className={`px-4 py-2 rounded-lg border-2 font-medium transition-all ${tree.status === key
                                    ? `${color} border-current`
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* システム情報 */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <h2 className="text-lg font-bold text-gray-800 mb-4">システム情報</h2>
                    <dl className="grid grid-cols-1 gap-2 text-sm">
                        <div className="flex justify-between">
                            <dt className="text-gray-500">UUID</dt>
                            <dd className="font-mono text-gray-600 text-xs">{tree.id}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-gray-500">入荷日</dt>
                            <dd>{tree.arrived_at}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-gray-500">登録日時</dt>
                            <dd>{new Date(tree.created_at).toLocaleString('ja-JP')}</dd>
                        </div>
                    </dl>
                </div>

                {/* 操作履歴 */}
                <ActivityLogList treeId={tree.id} />

                {/* 削除ボタン（出荷済みは出荷履歴を保護するため削除不可） */}
                {tree.status !== 'shipped' && (
                    <button
                        onClick={() => {
                            if (!isOnline) {
                                alert('削除はオンライン時のみ可能です')
                                return
                            }
                            setIsDeleteDialogOpen(true)
                        }}
                        disabled={!isOnline}
                        className="w-full bg-red-50 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed text-red-600 py-3 rounded-lg font-semibold border border-red-200"
                    >
                        {isOnline ? 'この樹木を削除' : '削除はオンライン時のみ'}
                    </button>
                )}
            </main>

            {/* 予約ダイアログ（詳細ページから1本予約する場合） */}
            <ReservationDialog
                isOpen={isReservationDialogOpen}
                onClose={() => setIsReservationDialogOpen(false)}
                selectedIds={[tree.id]}
                selectedTrees={[{
                    id: tree.id,
                    management_number: tree.management_number,
                    species_name: tree.species?.name || '不明',
                    price: tree.price,
                }]}
                onSuccess={refreshData}
            />

            {/* 出荷ダイアログ（詳細ページから1本出荷する場合） */}
            <ShipmentDialog
                isOpen={isShipmentDialogOpen}
                onClose={() => setIsShipmentDialogOpen(false)}
                selectedIds={[tree.id]}
                selectedTrees={[{
                    id: tree.id,
                    management_number: tree.management_number,
                    species_name: tree.species?.name || '不明',
                    price: tree.price,
                }]}
                onSuccess={refreshData}
            />

            {/* 削除確認ダイアログ（3段階） */}
            <DeleteConfirmDialog
                isOpen={isDeleteDialogOpen}
                onClose={() => setIsDeleteDialogOpen(false)}
                onConfirm={executeDelete}
                itemCount={1}
                itemLabel={`${tree.management_number || ''} ${tree.species?.name || ''}`}
                clientName={tree.client?.name || '未設定'}
            />

            {/* 印刷用ラベル（画面上は隠れ、印刷時だけ見える） */}
            <PrintLabel
                treeId={tree.id}
                speciesName={tree.species?.name}
                price={tree.price}
                managementNumber={tree.management_number}
                url={`${typeof window !== 'undefined' ? window.location.origin : ''}/trees/${tree.id}`}
                layout={printLayout}
            />
        </div>
    )
}

// 画像圧縮関数
async function compressImage(file: File, maxWidth: number, quality: number): Promise<Blob> {
    return new Promise((resolve) => {
        const img = document.createElement('img')
        img.onload = () => {
            const canvas = document.createElement('canvas')
            let width = img.width
            let height = img.height

            if (width > maxWidth) {
                height = (height * maxWidth) / width
                width = maxWidth
            }

            canvas.width = width
            canvas.height = height

            const ctx = canvas.getContext('2d')!
            ctx.drawImage(img, 0, 0, width, height)

            canvas.toBlob(
                (blob) => resolve(blob!),
                'image/jpeg',
                quality
            )
        }
        img.src = URL.createObjectURL(file)
    })
}
