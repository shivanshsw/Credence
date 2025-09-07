declare module 'pdf-parse' {
  interface PdfParseResult {
    text: string;
    numpages?: number;
    info?: Record<string, unknown>;
    metadata?: unknown;
  }
  const pdfParse: (dataBuffer: Buffer) => Promise<PdfParseResult>;
  export default pdfParse;
}

declare module 'mammoth' {
  export function extractRawText(input: { buffer: Buffer }): Promise<{ value: string }>;
}

declare module 'xlsx' {
  const XLSX: any;
  export = XLSX;
}


