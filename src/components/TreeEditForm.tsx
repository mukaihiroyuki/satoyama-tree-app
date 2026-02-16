'use client'

import { useState } from 'react'
import type { CachedTree } from '@/lib/db'

interface TreeEditFormProps {
    tree: CachedTree
    isOnline: boolean
    saveMessage: string | null
    onSave: (updates: Record<string, string | number | null>) => Promise<void>
}

export default function TreeEditForm({ tree, isOnline, saveMessage, onSave }: TreeEditFormProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [saving, setSaving] = useState(false)

    // 編集用ローカル状態
    const [height, setHeight] = useState(String(tree.height))
    const [trunkCount, setTrunkCount] = useState(String(tree.trunk_count))
    const [price, setPrice] = useState(String(tree.price))
    const [location, setLocation] = useState(tree.location || '')
    const [notes, setNotes] = useState(tree.notes || '')

    // tree propが変わったら編集状態をリセット
    const [lastTreeId, setLastTreeId] = useState(tree.id)
    if (tree.id !== lastTreeId) {
        setLastTreeId(tree.id)
        setHeight(String(tree.height))
        setTrunkCount(String(tree.trunk_count))
        setPrice(String(tree.price))
        setLocation(tree.location || '')
        setNotes(tree.notes || '')
        setIsEditing(false)
    }

    function handleCancel() {
        // 元の値に戻す
        setHeight(String(tree.height))
        setTrunkCount(String(tree.trunk_count))
        setPrice(String(tree.price))
        setLocation(tree.location || '')
        setNotes(tree.notes || '')
        setIsEditing(false)
    }

    async function handleSave() {
        setSaving(true)

        const updates: Record<string, string | number | null> = {}
        const newHeight = parseFloat(height)
        const newTrunkCount = parseInt(trunkCount, 10)
        const newPrice = parseInt(price, 10)

        if (!isNaN(newHeight) && newHeight !== tree.height) updates.height = newHeight
        if (!isNaN(newTrunkCount) && newTrunkCount !== tree.trunk_count) updates.trunk_count = newTrunkCount
        if (!isNaN(newPrice) && newPrice !== tree.price) updates.price = newPrice
        if (location !== (tree.location || '')) updates.location = location || null
        if (notes !== (tree.notes || '')) updates.notes = notes || null

        if (Object.keys(updates).length > 0) {
            await onSave(updates)
        }

        setSaving(false)
        setIsEditing(false)
    }

    // 表示モード
    if (!isEditing) {
        return (
            <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-800">基本情報</h2>
                    <button
                        onClick={() => setIsEditing(true)}
                        className="text-sm font-bold text-green-700 hover:text-green-900 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200"
                    >
                        編集
                    </button>
                </div>
                <dl className="grid grid-cols-2 gap-4">
                    <div>
                        <dt className="text-sm text-gray-500">樹種</dt>
                        <dd className="text-lg font-medium">{tree.species?.name}</dd>
                    </div>
                    <div>
                        <dt className="text-sm text-gray-500">管理番号</dt>
                        <dd className="text-lg font-mono">{tree.management_number || '-'}</dd>
                    </div>
                    <div>
                        <dt className="text-sm text-gray-500">樹高</dt>
                        <dd className="text-lg font-medium">{tree.height}m</dd>
                    </div>
                    <div>
                        <dt className="text-sm text-gray-500">本立ち</dt>
                        <dd className="text-lg font-medium">{tree.trunk_count}本</dd>
                    </div>
                    <div>
                        <dt className="text-sm text-gray-500">上代</dt>
                        <dd className="text-xl font-bold text-green-700">&yen;{tree.price.toLocaleString()}</dd>
                    </div>
                    <div>
                        <dt className="text-sm text-gray-500">場所</dt>
                        <dd className="text-lg">{tree.location || '-'}</dd>
                    </div>
                </dl>
                {tree.notes && (
                    <div className="mt-4 pt-4 border-t">
                        <dt className="text-sm text-gray-500">備考</dt>
                        <dd className="mt-1 text-gray-700 whitespace-pre-wrap">{tree.notes}</dd>
                    </div>
                )}
                {saveMessage && (
                    <div className={`mt-3 text-sm font-medium px-3 py-2 rounded-lg ${
                        saveMessage.includes('ローカル')
                            ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                            : 'bg-green-50 text-green-700 border border-green-200'
                    }`}>
                        {saveMessage}
                    </div>
                )}
            </div>
        )
    }

    // 編集モード
    return (
        <div className="bg-white rounded-xl shadow-lg p-6 ring-2 ring-green-300">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">基本情報（編集中）</h2>
                {!isOnline && (
                    <span className="text-xs font-bold text-yellow-700 bg-yellow-50 px-2 py-1 rounded-lg border border-yellow-200">
                        オフライン
                    </span>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm text-gray-500 mb-1">樹種</label>
                    <p className="text-lg font-medium text-gray-400">{tree.species?.name}</p>
                    <p className="text-xs text-gray-400">（変更不可）</p>
                </div>
                <div>
                    <label className="block text-sm text-gray-500 mb-1">管理番号</label>
                    <p className="text-lg font-mono text-gray-400">{tree.management_number || '-'}</p>
                    <p className="text-xs text-gray-400">（変更不可）</p>
                </div>
                <div>
                    <label className="block text-sm text-gray-500 mb-1">樹高 (m)</label>
                    <input
                        type="number"
                        step="0.1"
                        value={height}
                        onChange={(e) => setHeight(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg"
                    />
                </div>
                <div>
                    <label className="block text-sm text-gray-500 mb-1">本立ち</label>
                    <input
                        type="number"
                        step="1"
                        value={trunkCount}
                        onChange={(e) => setTrunkCount(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg"
                    />
                </div>
                <div>
                    <label className="block text-sm text-gray-500 mb-1">上代 (円)</label>
                    <input
                        type="number"
                        step="1000"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg"
                    />
                </div>
                <div>
                    <label className="block text-sm text-gray-500 mb-1">場所</label>
                    <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg"
                    />
                </div>
            </div>

            <div className="mt-4">
                <label className="block text-sm text-gray-500 mb-1">備考</label>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
            </div>

            <div className="mt-4 flex gap-3">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-bold"
                >
                    {saving ? '保存中...' : '保存'}
                </button>
                <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                >
                    キャンセル
                </button>
            </div>
        </div>
    )
}
