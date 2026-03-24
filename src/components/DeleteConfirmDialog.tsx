'use client'

import { useState } from 'react'

interface DeleteConfirmDialogProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    itemCount: number
    itemLabel: string
    clientName: string
    variant?: 'tree' | 'estimate'
}

const TREE_STEPS = [
    {
        title: '削除確認',
        getMessage: (label: string, _client: string, count: number) =>
            `${label}（${count}本）を削除します。`,
        subMessage: (client: string) =>
            `クライアント: ${client}`,
        note: '関連する見積明細・出荷明細も削除されます。',
        buttonLabel: '削除する',
        buttonClass: 'bg-red-600 hover:bg-red-700',
        countLabel: '削除本数',
    },
    {
        title: '本当に削除しますか？',
        getMessage: (_label: string, _client: string, count: number) =>
            `${count}本のデータが完全に消えます。`,
        subMessage: () => 'この操作は元に戻せません。',
        note: null,
        buttonLabel: 'それでも削除する',
        buttonClass: 'bg-red-700 hover:bg-red-800',
        countLabel: '削除本数',
    },
    {
        title: 'FINAL ANSWER',
        getMessage: (_label: string, _client: string, count: number) =>
            `${count}本を完全に削除します。`,
        subMessage: () => '最後のチャンスです。',
        note: null,
        buttonLabel: '完全に削除する',
        buttonClass: 'bg-red-900 hover:bg-black',
        countLabel: '削除本数',
    },
]

const ESTIMATE_STEPS = [
    {
        title: '見積を削除しますか？',
        getMessage: (label: string, _client: string, count: number) =>
            `見積 ${label}（明細${count}件）を削除します。`,
        subMessage: (client: string) =>
            `クライアント: ${client}`,
        note: '樹木データは削除されません。見積と明細のみ削除されます。',
        buttonLabel: '見積を削除する',
        buttonClass: 'bg-red-600 hover:bg-red-700',
        countLabel: '明細数',
    },
    {
        title: '本当に削除しますか？',
        getMessage: (label: string, _client: string, _count: number) =>
            `見積 ${label} を削除します。`,
        subMessage: () => 'この操作は元に戻せません。',
        note: null,
        buttonLabel: 'それでも削除する',
        buttonClass: 'bg-red-700 hover:bg-red-800',
        countLabel: '明細数',
    },
]

export default function DeleteConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    itemCount,
    itemLabel,
    clientName,
    variant = 'tree',
}: DeleteConfirmDialogProps) {
    const [step, setStep] = useState(0)

    if (!isOpen) return null

    const steps = variant === 'estimate' ? ESTIMATE_STEPS : TREE_STEPS
    const current = steps[step]

    function handleNext() {
        if (step < steps.length - 1) {
            setStep(step + 1)
        } else {
            setStep(0)
            onConfirm()
        }
    }

    function handleClose() {
        setStep(0)
        onClose()
    }

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 ${step >= 2 ? 'ring-4 ring-red-600' : ''}`}>
                {/* ヘッダー — ステップが進むほど赤く激しく */}
                <div className={`p-6 ${step === 0 ? 'bg-red-50' : step === 1 ? 'bg-red-100' : 'bg-red-600'}`}>
                    <div className="flex items-center gap-3">
                        <span className={`${step >= 2 ? 'text-4xl animate-pulse' : 'text-3xl'}`}>
                            {step === 0 ? '⚠️' : step === 1 ? '🚨' : '💀'}
                        </span>
                        <h2 className={`text-xl font-black ${step >= 2 ? 'text-white text-2xl' : 'text-red-800'}`}>
                            {current.title}
                        </h2>
                    </div>
                </div>

                {/* 本文 */}
                <div className="p-6 space-y-4">
                    <p className={`font-bold ${step >= 2 ? 'text-2xl text-red-700' : step === 1 ? 'text-xl text-red-700' : 'text-lg text-gray-800'}`}>
                        {current.getMessage(itemLabel, clientName, itemCount)}
                    </p>

                    <p className={`font-bold ${step >= 2 ? 'text-red-600 text-lg' : step === 1 ? 'text-red-600' : 'text-gray-600'}`}>
                        {current.subMessage(clientName)}
                    </p>

                    {current.note && (
                        <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                            {current.note}
                        </p>
                    )}

                    {/* 対象情報 */}
                    <div className={`rounded-xl p-4 border-2 ${step >= 2 ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-gray-500">クライアント</span>
                            <span className={`font-bold ${step >= 2 ? 'text-red-700 text-lg' : 'text-gray-800'}`}>{clientName}</span>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                            <span className="text-sm font-bold text-gray-500">{current.countLabel}</span>
                            <span className={`font-black ${step >= 2 ? 'text-red-700 text-2xl' : 'text-red-600 text-xl'}`}>{itemCount} 本</span>
                        </div>
                    </div>

                    {/* ステップインジケーター */}
                    <div className="flex justify-center gap-2 pt-2">
                        {steps.map((_, i) => (
                            <div
                                key={i}
                                className={`h-2 rounded-full transition-all ${
                                    i <= step ? 'bg-red-500 w-8' : 'bg-gray-200 w-4'
                                }`}
                            />
                        ))}
                    </div>
                </div>

                {/* ボタン */}
                <div className="p-6 bg-gray-50 flex gap-3">
                    <button
                        onClick={handleClose}
                        className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-white transition-colors"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleNext}
                        className={`flex-[2] text-white px-4 py-3 rounded-xl font-black shadow-lg transition-all active:scale-95 ${current.buttonClass} ${step >= 2 ? 'text-lg animate-none' : ''}`}
                    >
                        {current.buttonLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
