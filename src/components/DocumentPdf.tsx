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
        padding: 12,
        marginVertical: 12,
        alignItems: "center",
    },
    amountLabel: {
        fontSize: 10,
        color: "#64748b",
        marginBottom: 4,
    },
    amountValue: {
        fontSize: 22,
        fontWeight: "bold",
    },
    amountSub: {
        fontSize: 8,
        color: "#64748b",
        marginTop: 4,
    },
    logoImage: {
        width: 130,
        height: 42,
        objectFit: "contain",
        marginBottom: 6,
    },
    companyBlock: {
        marginTop: 4,
    },
    companyName: {
        fontSize: 10,
        fontWeight: "bold",
        marginBottom: 2,
    },
    companyDetail: {
        fontSize: 7,
        color: "#475569",
        marginBottom: 1,
    },
    assigneeText: {
        fontSize: 7,
        color: "#475569",
        marginTop: 2,
    },
    table: {
        marginBottom: 4,
    },
    tableHeader: {
        flexDirection: "row",
        backgroundColor: "#f1f5f9",
        borderTop: "1pt solid #cbd5e1",
        borderBottom: "1pt solid #cbd5e1",
        paddingVertical: 4,
    },
    tableRow: {
        flexDirection: "row",
        borderBottom: "0.5pt solid #e2e8f0",
        paddingVertical: 3,
        minHeight: 18,
    },
    tableRowAlt: {
        flexDirection: "row",
        borderBottom: "0.5pt solid #e2e8f0",
        paddingVertical: 3,
        minHeight: 18,
        backgroundColor: "#fafbfc",
    },
    colSpecies: { flex: 1, paddingHorizontal: 4 },
    colHeight: { width: 45, textAlign: "right", paddingHorizontal: 4 },
    colCount: { width: 40, textAlign: "right", paddingHorizontal: 4 },
    colUnitPrice: { width: 70, textAlign: "right", paddingHorizontal: 4 },
    colAmount: { width: 80, textAlign: "right", paddingHorizontal: 4 },
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
    const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
    const tax = Math.floor(subtotal * 0.1);
    const total = subtotal + tax;

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

                <View style={styles.headerRow}>
                    {/* 左: クライアント情報 */}
                    <View style={styles.headerLeft}>
                        {clientAddress && (
                            <Text style={styles.customerAddress}>{clientAddress}</Text>
                        )}
                        <Text style={styles.customerName}>
                            {clientName} <Text style={styles.customerSuffix}>御中</Text>
                        </Text>

                        <View style={styles.amountBox}>
                            <Text style={styles.amountLabel}>{DOC_AMOUNT_LABELS[type]}</Text>
                            <Text style={styles.amountValue}>
                                {formatCurrency(total)}（税込）
                            </Text>
                            <Text style={styles.amountSub}>
                                本体 {formatCurrency(subtotal)} ／ 消費税{" "}
                                {formatCurrency(tax)}
                            </Text>
                        </View>
                    </View>

                    {/* 右: 自社情報 */}
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

                {/* 明細テーブル */}
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.headerText, styles.colSpecies]}>樹種名</Text>
                        <Text style={[styles.headerText, styles.colHeight]}>樹高</Text>
                        <Text style={[styles.headerText, styles.colCount]}>本数</Text>
                        <Text style={[styles.headerText, styles.colUnitPrice]}>単価</Text>
                        <Text style={[styles.headerText, styles.colAmount]}>金額</Text>
                    </View>
                    {lines.map((line, idx) => (
                        <View
                            key={idx}
                            style={idx % 2 === 1 ? styles.tableRowAlt : styles.tableRow}
                        >
                            <Text style={[styles.cellText, styles.colSpecies]}>
                                {line.speciesName}
                            </Text>
                            <Text style={[styles.cellText, styles.colHeight]}>
                                {line.height}
                            </Text>
                            <Text style={[styles.cellText, styles.colCount]}>
                                {line.count}
                            </Text>
                            <Text style={[styles.cellText, styles.colUnitPrice]}>
                                {formatCurrency(line.unitPrice)}
                            </Text>
                            <Text
                                style={[
                                    styles.cellText,
                                    styles.colAmount,
                                    { fontWeight: "bold" },
                                ]}
                            >
                                {formatCurrency(line.amount)}
                            </Text>
                        </View>
                    ))}
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
