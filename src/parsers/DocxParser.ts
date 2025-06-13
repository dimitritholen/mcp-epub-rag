import fs from 'fs-extra';
import mammoth from 'mammoth';
import { BaseDocumentParser, ParserOptions, ParseResult } from './BaseDocumentParser.js';
import { DocumentProcessingError } from '@/errors/DocumentProcessingError';

/**
 * DOCX document parser with enhanced error handling and metadata extraction
 */
export class DocxParser extends BaseDocumentParser {
  constructor() {
    super(['.docx'], 'DOCX');
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
          'docx',
          { fileSize: stats.size, maxFileSize: options.maxFileSize }
        );
      }

      // Check if file is readable
      await fs.access(filePath, fs.constants.R_OK);
      
      // Validate DOCX file signature (ZIP file starting with PK)
      const buffer = await fs.readFile(filePath);
      if (!this.isValidDocxSignature(buffer)) {
        throw new DocumentProcessingError(
          'Invalid DOCX file signature',
          filePath,
          'validation',
          'docx'
        );
      }
    } catch (error) {
      if (error instanceof DocumentProcessingError) {
        throw error;
      }
      
      throw new DocumentProcessingError(
        `DOCX validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath,
        'validation',
        'docx',
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
      
      // Parse DOCX with timeout
      const result = await this.parseDocxWithTimeout(buffer, options);
      
      // Extract content and metadata
      const content = this.cleanDocxText(result.value);
      const metadata = this.extractDocxMetadata(result);
      
      return {
        content,
        title: metadata.title,
        author: metadata.author,
        metadata: {
          ...metadata,
          filePath,
          fileExtension,
          messages: result.messages?.length || 0,
          warnings: result.messages?.filter(m => m.type === 'warning').length || 0,
          errors: result.messages?.filter(m => m.type === 'error').length || 0
        }
      };
    } catch (error) {
      throw new DocumentProcessingError(
        `DOCX parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath,
        'parsing',
        'docx',
        {},
        error instanceof Error ? error : undefined
      );
    }
  }

  private isValidDocxSignature(buffer: Buffer): boolean {
    // DOCX files are ZIP archives, should start with PK
    const signature = buffer.subarray(0, 2);
    return signature[0] === 0x50 && signature[1] === 0x4B; // PK
  }

  private async parseDocxWithTimeout(
    buffer: Buffer,
    options: ParserOptions
  ): Promise<any> {
    const mammothOptions = {
      // Convert to raw text
      convertImage: mammoth.images.ignoreAll,
      // Handle styles
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh"
      ],
      // Include document properties
      includeDefaultStyleMap: true,
      // Transform document
      transformDocument: (document: any) => {
        // Can add custom transformations here
        return document;
      }
    };

    const parsePromise = mammoth.extractRawText({ buffer }, mammothOptions);
    
    if (!options.timeout) {
      return parsePromise;
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`DOCX parsing timeout after ${options.timeout}ms`));
      }, options.timeout);
    });

    return Promise.race([parsePromise, timeoutPromise]);
  }

  private cleanDocxText(text: string): string {
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove page breaks and form feeds
      .replace(/[\f\v]/g, '\n')
      // Normalize line breaks
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove excessive line breaks
      .replace(/\n{3,}/g, '\n\n')
      // Clean up spacing around punctuation
      .replace(/\s+([.,:;!?])/g, '$1')
      .replace(/([.,:;!?])\s+/g, '$1 ')
      // Remove leading/trailing whitespace
      .trim();
  }

  private extractDocxMetadata(result: any): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};
    
    // Extract basic metadata (mammoth doesn't provide direct access to document properties)
    // This is a simplified approach - for full metadata extraction, we'd need to parse the XML directly
    
    // Try to extract title from the beginning of the document
    const lines = result.value.split('\n').filter((line: string) => line.trim());
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      // If the first line looks like a title (not too long, not starting with lowercase)
      if (firstLine.length < 100 && firstLine.length > 0 && /^[A-Z]/.test(firstLine)) {
        metadata.title = firstLine;
      }
    }

    // Add processing information
    if (result.messages) {
      metadata.processingMessages = result.messages.map((msg: any) => ({
        type: msg.type,
        message: msg.message
      }));
    }

    return metadata;
  }
}
