export type DocumentType = "estimate" | "delivery" | "invoice";

export interface SpeciesLine {
    managementNumber: string;
    speciesName: string;
    height: string;
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
}
