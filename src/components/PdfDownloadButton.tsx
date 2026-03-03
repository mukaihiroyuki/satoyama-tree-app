'use client'

import { useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/client'
import DocumentPdf from './DocumentPdf'
import type { DocumentType, SpeciesLine } from './DocumentPdf'

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
    client: { name: string; address: string | null } | { name: string; address: string | null }[] | null
    estimate_items: {
        unit_price: number
        tree: {
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
    estimate: { estimate_number: string } | { estimate_number: string }[] | null
    shipment_items: {
        unit_price: number
        tree: {
            height: number
            species: { name: string } | null
        } | null
    }[]
}

function buildLines(
    items: { unit_price: number; tree: { height: number; species: { name: string } | null } | null }[]
): SpeciesLine[] {
    const groupMap = new Map<string, { heights: Set<string>; count: number; totalPrice: number; avgUnitPrice: number }>()

    for (const item of items) {
        const speciesName = item.tree?.species
            ? (Array.isArray(item.tree.species) ? item.tree.species[0]?.name : item.tree.species.name) || '不明'
            : '不明'
        const height = item.tree?.height ?? 0

        const existing = groupMap.get(speciesName) || { heights: new Set<string>(), count: 0, totalPrice: 0, avgUnitPrice: 0 }
        existing.heights.add(`${height}m`)
        existing.count += 1
        existing.totalPrice += item.unit_price
        groupMap.set(speciesName, existing)
    }

    return Array.from(groupMap.entries()).map(([speciesName, data]) => {
        const heights = Array.from(data.heights).sort()
        const heightStr = heights.length === 1 ? heights[0] : `${heights[0]}~${heights[heights.length - 1]}`
        return {
            speciesName,
            height: heightStr,
            count: data.count,
            unitPrice: data.count > 0 ? Math.round(data.totalPrice / data.count) : 0,
            amount: data.totalPrice,
        }
    })
}

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
    estimate: '見積書',
    delivery: '納品書',
    invoice: '請求書',
}

export default function PdfDownloadButton({ type, estimateId, shipmentId, label }: PdfDownloadButtonProps) {
    const [generating, setGenerating] = useState(false)

    async function handleDownload() {
        setGenerating(true)
        try {
            const supabase = createClient()
            let documentNumber = ''
            let issuedAt = ''
            let clientName = ''
            let clientAddress: string | null = null
            let lines: SpeciesLine[] = []
            let notes: string | null = null

            if (estimateId) {
                const { data, error } = await supabase
                    .from('estimates')
                    .select(`
                        estimate_number,
                        issued_at,
                        notes,
                        client:clients(name, address),
                        estimate_items(
                            unit_price,
                            tree:trees(
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
                lines = buildLines(est.estimate_items)
            } else if (shipmentId) {
                const { data, error } = await supabase
                    .from('shipments')
                    .select(`
                        id,
                        shipped_at,
                        notes,
                        client:clients(name, address),
                        estimate:estimates(estimate_number),
                        shipment_items(
                            unit_price,
                            tree:trees(
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
                lines = buildLines(ship.shipment_items)
            }

            const blob = await pdf(
                <DocumentPdf
                    type={type}
                    documentNumber={documentNumber}
                    issuedAt={issuedAt}
                    clientName={clientName}
                    clientAddress={clientAddress}
                    lines={lines}
                    notes={notes}
                />
            ).toBlob()

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
            setGenerating(false)
        }
    }

    const colorClasses: Record<DocumentType, string> = {
        estimate: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200',
        delivery: 'bg-amber-600 hover:bg-amber-700 shadow-amber-200',
        invoice: 'bg-purple-600 hover:bg-purple-700 shadow-purple-200',
    }

    return (
        <button
            onClick={handleDownload}
            disabled={generating}
            className={`text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50 ${colorClasses[type]}`}
        >
            {generating ? '生成中...' : label}
        </button>
    )
}
