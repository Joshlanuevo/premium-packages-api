// Local shim: @types/pdfmake targets the browser createPdf() API, but this
// project uses server-side pdfmake@0.2.x, where require("pdfmake") returns
// the PdfPrinter class directly. Typed loosely and honestly rather than
// pretending to match the mismatched community types.
declare module "pdfmake" {
  interface PdfKitDocument {
    on(event: "data", listener: (chunk: Buffer) => void): this;
    on(event: "end", listener: () => void): this;
    on(event: "error", listener: (err: Error) => void): this;
    end(): void;
  }

  class PdfPrinter {
    constructor(fonts: Record<string, Record<string, string>>);
    createPdfKitDocument(docDefinition: unknown, options?: unknown): PdfKitDocument;
  }

  export = PdfPrinter;
}