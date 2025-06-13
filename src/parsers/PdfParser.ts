import fs from 'fs-extra';
import pdfParse from 'pdf-parse-debugging-disabled';
import { BaseDocumentParser, ParserOptions, ParseResult } from './BaseDocumentParser.js';
import { DocumentProcessingError } from '@/errors/DocumentProcessingError';

/**
 * PDF document parser with enhanced error handling and metadata extraction
 */
export class PdfParser extends BaseDocumentParser {
  constructor() {
    super(['.pdf'], 'PDF');
  }

  protected async validateFile(filePath: string, options: ParserOptions): Promise<void> {
    try {
      const stats = await fs.stat(filePath);
      
      // Check file size limits
      if (options.maxFileSize && stats.size > options.maxFileSize) {
        throw new DocumentProcessingError(
          `File size (${stats.size} bytes) exceeds maximum allowed size (${options.maxFileSize} bytes)`,
          filePath,
          'validation',
          'pdf',
          { fileSize: stats.size, maxFileSize: options.maxFileSize }
        );
      }

      // Check if file is readable
      await fs.access(filePath, fs.constants.R_OK);
      
      // Validate PDF file signature
      const buffer = await fs.readFile(filePath);
      if (!this.isValidPdfSignature(buffer)) {
        throw new DocumentProcessingError(
          'Invalid PDF file signature',
          filePath,
          'validation',
          'pdf'
        );
      }
    } catch (error) {
      if (error instanceof DocumentProcessingError) {
        throw error;
      }
      
      throw new DocumentProcessingError(
        `PDF validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath,
        'validation',
        'pdf',
        {},
        error instanceof Error ? error : undefined
      );
    }
  }

  protected async parseInternal(
    filePath: string,
    fileExtension: string,
    options: ParserOptions
  ): Promise<ParseResult> {
    try {
      const buffer = await fs.readFile(filePath);
      
      // Configure PDF parsing options
      const parseOptions = {
        normalizeWhitespace: true,
        disableCombineTextItems: false,
        max: options.maxFileSize ? Math.floor(options.maxFileSize / 1024) : 0 // Convert to KB
      };

      // Parse PDF with timeout
      const data = await this.parsePdfWithTimeout(buffer, parseOptions, options.timeout);
      
      // Extract and clean content
      const content = this.cleanPdfText(data.text);
      
      // Extract metadata
      const metadata = this.extractPdfMetadata(data);
      
      return {
        content,
        title: metadata.title,
        author: metadata.author,
        metadata: {
          ...metadata,
          pageCount: data.numpages,
          filePath,
          fileExtension,
          pdfVersion: data.version,
          encrypted: data.info?.IsAcroFormPresent || false
        }
      };
    } catch (error) {
      if ((error as any)?.message?.includes('password')) {
        throw new DocumentProcessingError(
          'PDF is password protected. Please provide the password or decrypt the file.',
          filePath,
          'parsing',
          'pdf',
          { requiresPassword: true }
        );
      }
      
      throw new DocumentProcessingError(
        `PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath,
        'parsing',
        'pdf',
        {},
        error instanceof Error ? error : undefined
      );
    }
  }

  private isValidPdfSignature(buffer: Buffer): boolean {
    // PDF files should start with %PDF-
    const signature = buffer.subarray(0, 5).toString('ascii');
    return signature === '%PDF-';
  }

  private async parsePdfWithTimeout(
    buffer: Buffer, 
    parseOptions: any, 
    timeout?: number
  ): Promise<any> {
    const parsePromise = pdfParse(buffer, parseOptions);
    
    if (!timeout) {
      return parsePromise;
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`PDF parsing timeout after ${timeout}ms`));
      }, timeout);
    });

    return Promise.race([parsePromise, timeoutPromise]);
  }

  private cleanPdfText(text: string): string {
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Fix common PDF text extraction issues
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      // Remove page numbers and headers/footers patterns
      .replace(/^\d+\s*$/gm, '')
      // Remove excessive line breaks
      .replace(/\n{3,}/g, '\n\n')
      // Normalize spacing
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  private extractPdfMetadata(data: any): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};
    
    if (data.info) {
      metadata.title = data.info.Title || '';
      metadata.author = data.info.Author || '';
      metadata.subject = data.info.Subject || '';
      metadata.keywords = data.info.Keywords || '';
      metadata.creator = data.info.Creator || '';
      metadata.producer = data.info.Producer || '';
      metadata.creationDate = data.info.CreationDate || '';
      metadata.modificationDate = data.info.ModDate || '';
    }

    return metadata;
  }
}
