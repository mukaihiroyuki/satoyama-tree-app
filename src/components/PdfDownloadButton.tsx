'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DocumentType, SpeciesLine } from './document-pdf-types'

interface PdfDownloadButtonProps {
    type: DocumentType
    estimateId?: string
    shipmentId?: string
    label: string
}

interface FetchedEstimate {
    estimate_number: string
    issued_at: string | null
    notes: string | null
    assignee: string | null
    client: { name: string; address: string | null } | { name: string; address: string | null }[] | null
    estimate_items: {
        unit_price: number
        tree: {
            management_number: string | null
            height: number
            species: { name: string } | null
        } | null
    }[]
}

interface FetchedShipment {
    id: string
    shipped_at: string
    notes: string | null
    client: { name: string; address: string | null } | { name: string; address: string | null }[] | null
    estimate: { estimate_number: string; assignee: string | null } | { estimate_number: string; assignee: string | null }[] | null
    shipment_items: {
        unit_price: number
        tree: {
            management_number: string | null
            height: number
            species: { name: string } | null
        } | null
    }[]
}

function buildLines(
    items: { unit_price: number; tree: { management_number: string | null; height: number; species: { name: string } | null } | null }[]
): SpeciesLine[] {
    return items.map(item => {
        const speciesName = item.tree?.species
            ? (Array.isArray(item.tree.species) ? item.tree.species[0]?.name : item.tree.species.name) || '不明'
            : '不明'
        return {
            managementNumber: item.tree?.management_number || '-',
            speciesName,
            height: `${item.tree?.height ?? 0}m`,
            unitPrice: item.unit_price,
        }
    })
}

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
    estimate: '見積書',
    delivery: '納品書',
    invoice: '請求書',
}

export default function PdfDownloadButton({ type, estimateId, shipmentId, label }: PdfDownloadButtonProps) {
    const [busy, setBusy] = useState<'download' | 'preview' | null>(null)

    async function generateBlob(): Promise<{ blob: Blob; documentNumber: string }> {
        const supabase = createClient()
        let documentNumber = ''
        let issuedAt = ''
        let clientName = ''
        let clientAddress: string | null = null
        let lines: SpeciesLine[] = []
        let notes: string | null = null
        let assignee: string | null = null

        if (estimateId) {
            const { data, error } = await supabase
                .from('estimates')
                .select(`
                    estimate_number,
                    issued_at,
                    notes,
                    assignee,
                    client:clients(name, address),
                    estimate_items(
                        unit_price,
                        tree:trees(
                            management_number,
                            height,
                            species:species_master(name)
                        )
                    )
                `)
                .eq('id', estimateId)
                .single()

            if (error) throw error
            const est = data as unknown as FetchedEstimate
            const client = Array.isArray(est.client) ? est.client[0] : est.client
            documentNumber = est.estimate_number
            issuedAt = est.issued_at || new Date().toISOString().split('T')[0]
            clientName = client?.name || '不明'
            clientAddress = client?.address || null
            notes = est.notes
            assignee = est.assignee
            lines = buildLines(est.estimate_items)
        } else if (shipmentId) {
            const { data, error } = await supabase
                .from('shipments')
                .select(`
                    id,
                    shipped_at,
                    notes,
                    client:clients(name, address),
                    estimate:estimates(estimate_number, assignee),
                    shipment_items(
                        unit_price,
                        tree:trees(
                            management_number,
                            height,
                            species:species_master(name)
                        )
                    )
                `)
                .eq('id', shipmentId)
                .single()

            if (error) throw error
            const ship = data as unknown as FetchedShipment
            const client = Array.isArray(ship.client) ? ship.client[0] : ship.client
            const estimate = Array.isArray(ship.estimate) ? ship.estimate[0] : ship.estimate
            documentNumber = estimate?.estimate_number || `S-${ship.id.slice(0, 8)}`
            issuedAt = ship.shipped_at
            clientName = client?.name || '不明'
            clientAddress = client?.address || null
            notes = ship.notes
            assignee = estimate?.assignee || null
            lines = buildLines(ship.shipment_items)
        }

        const { pdf } = await import('@react-pdf/renderer')
        const { default: DocumentPdf } = await import('./DocumentPdf')

        const blob = await pdf(
            <DocumentPdf
                type={type}
                documentNumber={documentNumber}
                issuedAt={issuedAt}
                clientName={clientName}
                clientAddress={clientAddress}
                lines={lines}
                notes={notes}
                assignee={assignee}
            />
        ).toBlob()

        return { blob, documentNumber }
    }

    async function handleDownload() {
        setBusy('download')
        try {
            const { blob, documentNumber } = await generateBlob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${DOC_TYPE_LABELS[type]}_${documentNumber}.pdf`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        } catch (err) {
            console.error('PDF生成エラー:', err)
            alert('PDF生成に失敗しました')
        } finally {
            setBusy(null)
        }
    }

    async function handlePreview() {
        setBusy('preview')
        try {
            const { blob } = await generateBlob()
            const url = URL.createObjectURL(blob)
            window.open(url, '_blank')
        } catch (err) {
            console.error('PDFプレビューエラー:', err)
            alert('PDFプレビューに失敗しました')
        } finally {
            setBusy(null)
        }
    }

    const colorClasses: Record<DocumentType, string> = {
        estimate: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200',
        delivery: 'bg-amber-600 hover:bg-amber-700 shadow-amber-200',
        invoice: 'bg-purple-600 hover:bg-purple-700 shadow-purple-200',
    }

    const previewColorClasses: Record<DocumentType, string> = {
        estimate: 'border-emerald-300 text-emerald-700 hover:bg-emerald-50',
        delivery: 'border-amber-300 text-amber-700 hover:bg-amber-50',
        invoice: 'border-purple-300 text-purple-700 hover:bg-purple-50',
    }

    return (
        <div className="flex gap-2">
            <button
                onClick={handlePreview}
                disabled={busy !== null}
                className={`px-4 py-3 rounded-xl font-bold border-2 transition-all active:scale-95 disabled:opacity-50 ${previewColorClasses[type]}`}
            >
                {busy === 'preview' ? '生成中...' : 'プレビュー'}
            </button>
            <button
                onClick={handleDownload}
                disabled={busy !== null}
                className={`text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50 ${colorClasses[type]}`}
            >
                {busy === 'download' ? '生成中...' : label}
            </button>
        </div>
    )
}
