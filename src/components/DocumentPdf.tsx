"use client";

import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Font,
    Image,
} from "@react-pdf/renderer";
import { COMPANY_INFO } from "@/lib/constants";

Font.register({
    family: "NotoSansJP",
    fonts: [
        { src: "/fonts/NotoSansJP-Regular.ttf", fontWeight: "normal" },
        { src: "/fonts/NotoSansJP-Bold.ttf", fontWeight: "bold" },
    ],
});

const styles = StyleSheet.create({
    page: {
        fontFamily: "NotoSansJP",
        fontSize: 9,
        padding: 40,
        paddingBottom: 60,
        color: "#1e293b",
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 20,
    },
    headerLeft: {
        flex: 1,
        marginRight: 16,
    },
    headerRight: {
        width: 200,
        alignItems: "flex-end",
    },
    docTitle: {
        fontSize: 20,
        fontWeight: "bold",
        textAlign: "center",
        marginBottom: 16,
        letterSpacing: 6,
    },
    issueInfo: {
        fontSize: 8,
        color: "#64748b",
        textAlign: "right",
        marginBottom: 2,
    },
    customerName: {
        fontSize: 14,
        fontWeight: "bold",
        marginBottom: 4,
        borderBottom: "1.5pt solid #1e293b",
        paddingBottom: 4,
    },
    customerSuffix: {
        fontSize: 10,
        fontWeight: "normal",
    },
    customerAddress: {
        fontSize: 8,
        marginBottom: 2,
    },
    amountBox: {
        backgroundColor: "#f8fafc",
        border: "1pt solid #e2e8f0",
        borderRadius: 4,
        padding: 16,
        paddingVertical: 10,
        marginVertical: 12,
        alignItems: "center",
        justifyContent: "center",
        flexGrow: 1,
    },
    amountLabel: {
        fontSize: 11,
        color: "#64748b",
        marginBottom: 6,
    },
    amountValue: {
        fontSize: 24,
        fontWeight: "bold",
    },
    amountSub: {
        fontSize: 9,
        color: "#64748b",
        marginTop: 6,
    },
    logoImage: {
        width: 150,
        height: 48,
        objectFit: "contain",
        marginBottom: 8,
    },
    companyBlock: {
        marginTop: 4,
    },
    companyName: {
        fontSize: 11,
        fontWeight: "bold",
        marginBottom: 3,
    },
    companyDetail: {
        fontSize: 8,
        color: "#475569",
        marginBottom: 1.5,
    },
    assigneeText: {
        fontSize: 7,
        color: "#475569",
        marginTop: 2,
    },
    table: {
        marginBottom: 4,
    },
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#e2e8f0",
        borderTop: "1pt solid #94a3b8",
        paddingVertical: 4,
        paddingHorizontal: 6,
        marginTop: 6,
    },
    sectionTitle: {
        fontSize: 9,
        fontWeight: "bold",
        color: "#1e293b",
    },
    sectionCount: {
        fontSize: 7,
        color: "#64748b",
        marginLeft: 6,
    },
    tableHeader: {
        flexDirection: "row",
        backgroundColor: "#f1f5f9",
        borderBottom: "0.5pt solid #cbd5e1",
        paddingVertical: 3,
    },
    tableRow: {
        flexDirection: "row",
        borderBottom: "0.5pt solid #e2e8f0",
        paddingVertical: 3,
        minHeight: 16,
    },
    tableRowAlt: {
        flexDirection: "row",
        borderBottom: "0.5pt solid #e2e8f0",
        paddingVertical: 3,
        minHeight: 16,
        backgroundColor: "#fafbfc",
    },
    sectionSubtotal: {
        flexDirection: "row",
        justifyContent: "flex-end",
        borderTop: "0.5pt solid #cbd5e1",
        paddingVertical: 3,
        paddingHorizontal: 6,
        backgroundColor: "#f8fafc",
    },
    sectionSubtotalLabel: {
        fontSize: 8,
        color: "#475569",
        marginRight: 8,
    },
    sectionSubtotalValue: {
        fontSize: 8,
        fontWeight: "bold",
        width: 80,
        textAlign: "right",
    },
    colNo: { width: 22, textAlign: "center", paddingHorizontal: 2 },
    colTreeNo: { width: 55, paddingHorizontal: 4 },
    colHeight: { width: 35, textAlign: "center", paddingHorizontal: 3 },
    colTrunk: { width: 30, textAlign: "center", paddingHorizontal: 3 },
    colManagement: { flex: 1, paddingHorizontal: 4 },
    colOriginalPrice: { width: 60, textAlign: "right", paddingHorizontal: 4 },
    colUnitPrice: { width: 60, textAlign: "right", paddingHorizontal: 4 },
    headerText: {
        fontSize: 7,
        fontWeight: "bold",
        color: "#475569",
    },
    cellText: {
        fontSize: 8,
    },
    totalSection: {
        marginTop: 8,
        borderTop: "1pt solid #cbd5e1",
        paddingTop: 6,
    },
    totalRow: {
        flexDirection: "row",
        justifyContent: "flex-end",
        marginBottom: 3,
    },
    totalLabel: {
        fontSize: 9,
        color: "#475569",
        width: 100,
        textAlign: "right",
        marginRight: 8,
    },
    totalValue: {
        fontSize: 9,
        width: 90,
        textAlign: "right",
    },
    grandTotalValue: {
        fontSize: 12,
        fontWeight: "bold",
        width: 90,
        textAlign: "right",
    },
    notesBox: {
        marginTop: 12,
        padding: 10,
        border: "1pt solid #e2e8f0",
        borderRadius: 4,
    },
    notesTitle: {
        fontSize: 8,
        fontWeight: "bold",
        color: "#64748b",
        marginBottom: 4,
    },
    notesText: {
        fontSize: 8,
        lineHeight: 1.5,
    },
    pageFooter: {
        position: "absolute",
        bottom: 30,
        left: 40,
        right: 40,
        textAlign: "center",
        fontSize: 7,
        color: "#94a3b8",
    },
});

function formatCurrency(amount: number): string {
    return `¥${amount.toLocaleString("ja-JP")}`;
}

import type { DocumentType, DocumentPdfProps } from './document-pdf-types';
export type { DocumentType, SpeciesLine, DocumentPdfProps } from './document-pdf-types';

const DOC_TITLES: Record<DocumentType, string> = {
    estimate: "御 見 積 書",
    delivery: "納　品　書",
    invoice: "請　求　書",
};

const DOC_AMOUNT_LABELS: Record<DocumentType, string> = {
    estimate: "御見積金額",
    delivery: "納品金額",
    invoice: "ご請求金額",
};

export default function DocumentPdf({
    type,
    documentNumber,
    issuedAt,
    clientName,
    clientAddress,
    lines,
    notes,
    assignee,
}: DocumentPdfProps) {
    const subtotal = lines.reduce((sum, l) => sum + l.unitPrice, 0);
    const tax = Math.floor(subtotal * 0.1);
    const total = subtotal + tax;

    // 樹種別にグループ化（順序を保持）
    const speciesGroups: { speciesName: string; items: typeof lines }[] = [];
    const groupMap = new Map<string, typeof lines>();
    for (const line of lines) {
        const existing = groupMap.get(line.speciesName);
        if (existing) {
            existing.push(line);
        } else {
            const arr = [line];
            groupMap.set(line.speciesName, arr);
            speciesGroups.push({ speciesName: line.speciesName, items: arr });
        }
    }
    // 本数の多い順にソート
    speciesGroups.sort((a, b) => b.items.length - a.items.length);
    // グループ内を管理番号の昇順にソート
    for (const group of speciesGroups) {
        group.items.sort((a, b) => a.managementNumber.localeCompare(b.managementNumber));
    }
    let runningNo = 0;

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* 発行情報 */}
                <View style={{ alignItems: "flex-end", marginBottom: 4 }}>
                    <Text style={styles.issueInfo}>発行日: {issuedAt}</Text>
                    <Text style={styles.issueInfo}>No. {documentNumber}</Text>
                </View>

                {/* タイトル */}
                <Text style={styles.docTitle}>{DOC_TITLES[type]}</Text>

                {/* クライアント名（全幅） */}
                <View style={{ marginBottom: 8 }}>
                    {clientAddress && (
                        <Text style={styles.customerAddress}>{clientAddress}</Text>
                    )}
                    <Text style={styles.customerName}>
                        {clientName} <Text style={styles.customerSuffix}>御中</Text>
                    </Text>
                </View>

                {/* 金額ボックス ｜ 会社情報（横並びフル幅） */}
                <View style={styles.headerRow}>
                    <View style={[styles.amountBox, { flex: 1, marginVertical: 0, marginRight: 0 }]}>
                        <Text style={styles.amountLabel}>{DOC_AMOUNT_LABELS[type]}</Text>
                        <Text style={styles.amountValue}>
                            {formatCurrency(total)}（税込）
                        </Text>
                        <Text style={styles.amountSub}>
                            本体 {formatCurrency(subtotal)} ／ 消費税{" "}
                            {formatCurrency(tax)} ／ {lines.length} 本
                        </Text>
                    </View>

                    <View style={styles.headerRight}>
                        <Image src="/logo.jpg" style={styles.logoImage} />
                        <View style={styles.companyBlock}>
                            <Text style={styles.companyName}>{COMPANY_INFO.name}</Text>
                            <Text style={styles.companyDetail}>
                                {COMPANY_INFO.representative}
                            </Text>
                            <Text style={styles.companyDetail}>
                                {COMPANY_INFO.postalCode}
                            </Text>
                            <Text style={styles.companyDetail}>
                                {COMPANY_INFO.address}
                            </Text>
                            <Text style={styles.companyDetail}>
                                TEL {COMPANY_INFO.tel}  FAX {COMPANY_INFO.fax}
                            </Text>
                            {assignee && (
                                <Text style={styles.assigneeText}>
                                    担当者：{assignee}
                                </Text>
                            )}
                        </View>
                    </View>
                </View>

                {/* 明細テーブル（樹種別セクション） */}
                <View style={styles.table}>
                    {speciesGroups.map((group) => {
                        const groupSubtotal = group.items.reduce((s, l) => s + l.unitPrice, 0);
                        const groupOriginalSubtotal = group.items.reduce((s, l) => s + (l.originalPrice ?? l.unitPrice), 0);
                        return (
                            <View key={group.speciesName}>
                                {/* セクション見出し */}
                                <View style={styles.sectionHeader}>
                                    <Text style={styles.sectionTitle}>
                                        {group.speciesName}
                                    </Text>
                                    <Text style={styles.sectionCount}>
                                        {group.items.length} 本
                                    </Text>
                                </View>
                                {/* 列ヘッダー */}
                                <View style={styles.tableHeader}>
                                    <Text style={[styles.headerText, styles.colNo]}>No.</Text>
                                    <Text style={[styles.headerText, styles.colTreeNo]}>樹木番号</Text>
                                    <Text style={[styles.headerText, styles.colHeight]}>樹高</Text>
                                    <Text style={[styles.headerText, styles.colTrunk]}>株立</Text>
                                    <Text style={[styles.headerText, styles.colManagement]}>管理番号</Text>
                                    <Text style={[styles.headerText, styles.colOriginalPrice]}>定価</Text>
                                    <Text style={[styles.headerText, styles.colUnitPrice]}>単価</Text>
                                </View>
                                {/* 個別行 */}
                                {group.items.map((line, idx) => {
                                    runningNo++;
                                    return (
                                        <View
                                            key={runningNo}
                                            style={idx % 2 === 1 ? styles.tableRowAlt : styles.tableRow}
                                        >
                                            <Text style={[styles.cellText, styles.colNo]}>
                                                {runningNo}
                                            </Text>
                                            <Text style={[styles.cellText, styles.colTreeNo]}>
                                                {line.treeNo}
                                            </Text>
                                            <Text style={[styles.cellText, styles.colHeight]}>
                                                {line.height}
                                            </Text>
                                            <Text style={[styles.cellText, styles.colTrunk]}>
                                                {line.trunkCount > 1 ? line.trunkCount : ''}
                                            </Text>
                                            <Text style={[styles.cellText, styles.colManagement, { fontSize: 7 }]}>
                                                {line.managementNumber}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.cellText,
                                                    styles.colOriginalPrice,
                                                    { color: "#64748b" },
                                                ]}
                                            >
                                                {line.originalPrice != null ? formatCurrency(line.originalPrice) : ''}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.cellText,
                                                    styles.colUnitPrice,
                                                    { fontWeight: "bold" },
                                                ]}
                                            >
                                                {formatCurrency(line.unitPrice)}
                                            </Text>
                                        </View>
                                    );
                                })}
                                {/* セクション小計 */}
                                <View style={styles.sectionSubtotal}>
                                    <Text style={styles.sectionSubtotalLabel}>
                                        {group.speciesName} 小計（{group.items.length} 本）
                                    </Text>
                                    <Text style={[styles.sectionSubtotalValue, { color: "#64748b" }]}>
                                        {formatCurrency(groupOriginalSubtotal)}
                                    </Text>
                                    <Text style={styles.sectionSubtotalValue}>
                                        {formatCurrency(groupSubtotal)}
                                    </Text>
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* 合計セクション */}
                <View style={styles.totalSection}>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>小計</Text>
                        <Text style={styles.totalValue}>
                            {formatCurrency(subtotal)}
                        </Text>
                    </View>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>消費税（10%）</Text>
                        <Text style={styles.totalValue}>{formatCurrency(tax)}</Text>
                    </View>
                    <View
                        style={[
                            styles.totalRow,
                            {
                                borderTop: "1pt solid #334155",
                                paddingTop: 4,
                                marginTop: 2,
                            },
                        ]}
                    >
                        <Text
                            style={[
                                styles.totalLabel,
                                { fontWeight: "bold", color: "#1e293b" },
                            ]}
                        >
                            合計（税込）
                        </Text>
                        <Text style={styles.grandTotalValue}>
                            {formatCurrency(total)}
                        </Text>
                    </View>
                </View>

                {/* 備考 */}
                {notes && (
                    <View style={styles.notesBox}>
                        <Text style={styles.notesTitle}>備考</Text>
                        <Text style={styles.notesText}>{notes}</Text>
                    </View>
                )}

                {/* ページ番号 */}
                <Text
                    style={styles.pageFooter}
                    render={({ pageNumber, totalPages }) =>
                        `${pageNumber} / ${totalPages}`
                    }
                    fixed
                />
            </Page>
        </Document>
    );
}
