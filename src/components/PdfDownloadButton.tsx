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

interface TreeFields {
    management_number: string | null
    height: number
    trunk_count: number
    notes: string | null
    species: { name: string } | null
}

interface FetchedEstimate {
    estimate_number: string
    issued_at: string | null
    notes: string | null
    assignee: string | null
    client: { name: string; address: string | null } | { name: string; address: string | null }[] | null
    estimate_items: {
        unit_price: number
        original_price: number | null
        tree: TreeFields | null
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
        original_price: number | null
        tree: TreeFields | null
    }[]
}

function buildLines(
    items: { unit_price: number; original_price: number | null; tree: TreeFields | null }[]
): SpeciesLine[] {
    return items.map(item => {
        const speciesName = item.tree?.species
            ? (Array.isArray(item.tree.species) ? item.tree.species[0]?.name : item.tree.species.name) || '不明'
            : '不明'
        return {
            treeNo: item.tree?.notes || '',
            speciesName,
            height: `${item.tree?.height ?? 0}m`,
            trunkCount: item.tree?.trunk_count ?? 1,
            managementNumber: item.tree?.management_number || '-',
            originalPrice: item.original_price ?? item.unit_price,
            unitPrice: item.unit_price,
        }
    })
}

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
    estimate: '見積書',
    delivery: '納品書',
    invoice: '請求書',
}

interface FetchedData {
    documentNumber: string
    issuedAt: string
    clientName: string
    clientAddress: string | null
    lines: SpeciesLine[]
    notes: string | null
    assignee: string | null
}

async function fetchDocumentData(estimateId?: string, shipmentId?: string): Promise<FetchedData> {
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
                    original_price,
                    tree:trees(
                        management_number,
                        height,
                        trunk_count,
                        notes,
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
                    original_price,
                    tree:trees(
                        management_number,
                        height,
                        trunk_count,
                        notes,
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

    return { documentNumber, issuedAt, clientName, clientAddress, lines, notes, assignee }
}

function generateCsvContent(docType: DocumentType, data: FetchedData): string {
    const typeLabel = DOC_TYPE_LABELS[docType]
    const priceLabel = docType === 'estimate' ? '御見積金額' : docType === 'delivery' ? '納品金額' : 'ご請求金額'

    // 樹種別にグループ化（PDFと同じ順序）
    const speciesGroups = new Map<string, SpeciesLine[]>()
    for (const line of data.lines) {
        const group = speciesGroups.get(line.speciesName) || []
        group.push(line)
        speciesGroups.set(line.speciesName, group)
    }
    // 本数順でソート
    const sortedGroups = [...speciesGroups.entries()].sort((a, b) => b[1].length - a[1].length)

    const rows: string[] = []

    // ヘッダー情報
    rows.push(`${typeLabel}`)
    rows.push(`帳票番号,${data.documentNumber}`)
    rows.push(`発行日,${data.issuedAt}`)
    rows.push(`クライアント,${data.clientName}`)
    if (data.assignee) rows.push(`担当者,${data.assignee}`)
    rows.push('')

    // 明細ヘッダー
    rows.push('No.,樹木番号,樹種,樹高,株立,管理番号,定価,単価')

    let no = 1
    let grandTotal = 0

    for (const [speciesName, items] of sortedGroups) {
        // 樹種見出し
        rows.push(`--- ${speciesName} (${items.length}本) ---`)

        let subtotal = 0
        for (const item of items) {
            const trunk = item.trunkCount > 1 ? String(item.trunkCount) : ''
            const csvLine = [
                no,
                csvEscape(item.treeNo),
                csvEscape(speciesName),
                item.height,
                trunk,
                csvEscape(item.managementNumber),
                item.originalPrice ?? '',
                item.unitPrice,
            ].join(',')
            rows.push(csvLine)
            subtotal += item.unitPrice
            no++
        }
        rows.push(`${speciesName} 小計,,,,,,,${subtotal}`)
        grandTotal += subtotal
    }

    rows.push('')
    rows.push(`小計,,,,,,,${grandTotal}`)
    const tax = Math.floor(grandTotal * 0.1)
    rows.push(`消費税(10%),,,,,,,${tax}`)
    rows.push(`${priceLabel},,,,,,,${grandTotal + tax}`)

    if (data.notes) {
        rows.push('')
        rows.push(`備考,${csvEscape(data.notes)}`)
    }

    return '\uFEFF' + rows.join('\n')
}

function csvEscape(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`
    }
    return value
}

export default function PdfDownloadButton({ type, estimateId, shipmentId, label }: PdfDownloadButtonProps) {
    const [busy, setBusy] = useState<'download' | 'preview' | 'csv' | null>(null)

    async function generateBlob(): Promise<{ blob: Blob; documentNumber: string }> {
        const data = await fetchDocumentData(estimateId, shipmentId)

        const { pdf } = await import('@react-pdf/renderer')
        const { default: DocumentPdf } = await import('./DocumentPdf')

        const blob = await pdf(
            <DocumentPdf
                type={type}
                documentNumber={data.documentNumber}
                issuedAt={data.issuedAt}
                clientName={data.clientName}
                clientAddress={data.clientAddress}
                lines={data.lines}
                notes={data.notes}
                assignee={data.assignee}
            />
        ).toBlob()

        return { blob, documentNumber: data.documentNumber }
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

    async function handleCsvDownload() {
        setBusy('csv')
        try {
            const data = await fetchDocumentData(estimateId, shipmentId)
            const csv = generateCsvContent(type, data)
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${DOC_TYPE_LABELS[type]}_${data.documentNumber}.csv`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        } catch (err) {
            console.error('CSV生成エラー:', err)
            alert('CSV生成に失敗しました')
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
            <button
                onClick={handleCsvDownload}
                disabled={busy !== null}
                className="px-4 py-3 rounded-xl font-bold border-2 border-gray-300 text-gray-700 hover:bg-gray-50 transition-all active:scale-95 disabled:opacity-50"
            >
                {busy === 'csv' ? '生成中...' : 'CSV'}
            </button>
        </div>
    )
}
