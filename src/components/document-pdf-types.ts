export type DocumentType = "estimate" | "delivery" | "invoice";

export interface SpeciesLine {
    speciesName: string;
    height: string;
    count: number;
    unitPrice: number;
    amount: number;
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
