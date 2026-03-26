export type DocumentType = "estimate" | "delivery" | "invoice";

export interface SpeciesLine {
    treeNo: string;
    speciesName: string;
    height: string;
    trunkCount: number;
    managementNumber: string;
    originalPrice?: number;
    unitPrice: number;
}

export interface DocumentPdfProps {
    type: DocumentType;
    documentNumber: string;
    issuedAt: string;
    clientName: string;
    clientAddress?: string | null;
    lines: SpeciesLine[];
    notes?: string | null;
    assignee?: string | null;
    hidePrices?: boolean;
    customTotal?: number | null;
}
