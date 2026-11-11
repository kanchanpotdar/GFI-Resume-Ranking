declare module "pdf-parse" {
  function pdfParse(
    dataBuffer: Buffer | Uint8Array | ArrayBuffer,
    options?: any
  ): Promise<{
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    text: string;
    version: string;
  }>;
  export = pdfParse;
}
