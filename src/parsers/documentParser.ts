import fs from 'fs-extra';
import path from 'path';
import { Document, DocumentMetadata } from '../types/index.js';
import { DocumentProcessingError } from '../errors/index.js';
import { generateId } from '../utils/helpers.js';
import { logger, trackPerformance } from '../utils/logging/logger.js';

import { BaseDocumentParser, ParserOptions, ProgressCallback } from './BaseDocumentParser.js';
import { MarkdownParser } from './MarkdownParser.js';
import { PdfParser } from './PdfParser.js';
import { DocxParser } from './DocxParser.js';
import { EpubParser } from './EpubParser.js';

/**
 * Main document parser that orchestrates all format-specific parsers
 * Provides a unified interface for parsing various document formats
 */
export class DocumentParser {
  private readonly parsers: Map<string, BaseDocumentParser>;
  private readonly supportedExtensions: Set<string>;

  constructor() {
    this.parsers = new Map();
    this.supportedExtensions = new Set();
    
    this.initializeParsers();
  }

  private initializeParsers(): void {
    const parserInstances = [
      new MarkdownParser(),
      new PdfParser(),
      new DocxParser(),
      new EpubParser()
    ];

    for (const parser of parserInstances) {
      const extensions = parser.getSupportedExtensions();
      for (const ext of extensions) {
        this.parsers.set(ext, parser);
        this.supportedExtensions.add(ext);
      }
    }

    logger.info({
      supportedExtensions: Array.from(this.supportedExtensions),
      parserCount: this.parsers.size
    }, 'Document parsers initialized');
  }

  /**
   * Parse a document from file path
   */
  async parseDocument(filePath: string, options: ParserOptions = {}): Promise<Document> {
    const performance = trackPerformance(`parse-document-${path.basename(filePath)}`);
    
    try {
      // Validate file path
      await this.validateFilePath(filePath);
      
      // Get file statistics and metadata
      const stats = await fs.stat(filePath);
      const extension = path.extname(filePath).toLowerCase();
      const fileName = path.basename(filePath, extension);
      
      // Check if format is supported
      if (!this.isSupported(extension)) {
        throw new DocumentProcessingError(
          `Unsupported file format: ${extension}`,
          filePath,
          'validation',
          extension.slice(1),
          { 
            supportedFormats: Array.from(this.supportedExtensions),
            providedFormat: extension 
          }
        );
      }

      // Get appropriate parser
      const parser = this.parsers.get(extension);
      if (!parser) {
        throw new DocumentProcessingError(
          `No parser available for format: ${extension}`,
          filePath,
          'validation',
          extension.slice(1)
        );
      }

      // Set up progress tracking
      const progressCallback: ProgressCallback = (progress) => {
        logger.debug({
          filePath,
          stage: progress.stage,
          percentage: progress.percentage,
          message: progress.message
        }, 'Document parsing progress');
        
        options.progressCallback?.(progress);
      };

      // Parse the document
      const parsingOptions: ParserOptions = {
        ...options,
        progressCallback
      };

      const parseResult = await parser.parseDocument(filePath, extension, parsingOptions);
      
      // Create document metadata
      const metadata: DocumentMetadata = {
        filePath,
        fileType: extension.slice(1) as any,
        author: parseResult.author,
        createdAt: stats.birthtime,
        lastModified: stats.mtime,
        fileSize: stats.size
      };

      // Create document object
      const document: Document = {
        id: generateId(),
        title: parseResult.title || fileName,
        content: parseResult.content,
        metadata,
        chunks: [] // Will be populated by chunking service
      };

      // Add additional metadata from parsing result
      if (parseResult.metadata) {
        document.metadata = {
          ...document.metadata,
          ...parseResult.metadata
        };
      }

      performance.finish({
        filePath,
        fileSize: stats.size,
        contentLength: parseResult.content.length,
        wordCount: parseResult.wordCount,
        title: document.title
      });

      logger.info({
        documentId: document.id,
        title: document.title,
        fileType: document.metadata.fileType,
        contentLength: document.content.length,
        wordCount: parseResult.wordCount
      }, 'Document parsed successfully');

      return document;
    } catch (error) {
      performance.finishWithError(error as Error, { filePath });
      
      if (error instanceof DocumentProcessingError) {
        throw error;
      }
      
      throw new DocumentProcessingError(
        `Failed to parse document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath,
        'parsing',
        path.extname(filePath).slice(1),
        {},
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Parse multiple documents in batch
   */
  async parseDocuments(
    filePaths: string[], 
    options: ParserOptions = {}
  ): Promise<{
    successful: Document[];
    failed: Array<{ filePath: string; error: DocumentProcessingError }>;
    stats: {
      totalFiles: number;
      successCount: number;
      failureCount: number;
      totalProcessingTime: number;
    };
  }> {
    const startTime = Date.now();
    const successful: Document[] = [];
    const failed: Array<{ filePath: string; error: DocumentProcessingError }> = [];

    logger.info({
      fileCount: filePaths.length,
      files: filePaths.map(fp => path.basename(fp))
    }, 'Starting batch document parsing');

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      
      try {
        // Update overall progress
        options.progressCallback?.({
          stage: 'batch-processing',
          percentage: (i / filePaths.length) * 100,
          message: `Processing file ${i + 1} of ${filePaths.length}: ${path.basename(filePath)}`
        });

        const document = await this.parseDocument(filePath, {
          ...options,
          progressCallback: undefined // Don't pass individual progress for batch operations
        });
        
        successful.push(document);
      } catch (error) {
        const processingError = error instanceof DocumentProcessingError 
          ? error 
          : new DocumentProcessingError(
              `Batch parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              filePath,
              'parsing',
              path.extname(filePath).slice(1),
              {},
              error instanceof Error ? error : undefined
            );
        
        failed.push({ filePath, error: processingError });
        
        logger.error({
          filePath,
          error: processingError.toJSON()
        }, 'Failed to parse document in batch');
      }
    }

    const totalProcessingTime = Date.now() - startTime;
    const stats = {
      totalFiles: filePaths.length,
      successCount: successful.length,
      failureCount: failed.length,
      totalProcessingTime
    };

    logger.info(stats, 'Batch document parsing completed');

    return { successful, failed, stats };
  }

  /**
   * Check if a file format is supported
   */
  isSupported(filePathOrExtension: string): boolean {
    const extension = filePathOrExtension.startsWith('.') 
      ? filePathOrExtension.toLowerCase()
      : path.extname(filePathOrExtension).toLowerCase();
    
    return this.supportedExtensions.has(extension);
  }

  /**
   * Get all supported file extensions
   */
  getSupportedExtensions(): string[] {
    return Array.from(this.supportedExtensions);
  }

  /**
   * Get parser information for a specific format
   */
  getParserInfo(extension: string): { name: string; supported: boolean } | null {
    const normalizedExt = extension.toLowerCase();
    const parser = this.parsers.get(normalizedExt);
    
    if (!parser) {
      return null;
    }

    return {
      name: (parser as any).parserName || 'Unknown',
      supported: true
    };
  }

  private async validateFilePath(filePath: string): Promise<void> {
    if (!filePath || typeof filePath !== 'string') {
      throw new DocumentProcessingError(
        'Invalid file path provided',
        filePath || 'undefined',
        'validation'
      );
    }

    if (!await fs.pathExists(filePath)) {
      throw new DocumentProcessingError(
        `File does not exist: ${filePath}`,
        filePath,
        'validation'
      );
    }

    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw new DocumentProcessingError(
        `Path is not a file: ${filePath}`,
        filePath,
        'validation'
      );
    }

    // Check file permissions
    try {
      await fs.access(filePath, fs.constants.R_OK);
    } catch (error) {
      throw new DocumentProcessingError(
        `File is not readable: ${filePath}`,
        filePath,
        'validation',
        undefined,
        {},
        error instanceof Error ? error : undefined
      );
    }
  }
}
