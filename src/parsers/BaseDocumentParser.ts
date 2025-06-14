import { DocumentProcessingError } from '../errors/DocumentProcessingError.js';

/**
 * Progress callback for document parsing operations
 */
export type ProgressCallback = (progress: {
  stage: string;
  percentage: number;
  message: string;
}) => void;

/**
 * Parser options interface
 */
export interface ParserOptions {
  validateContent?: boolean;
  extractMetadata?: boolean;
  preserveFormatting?: boolean;
  progressCallback?: ProgressCallback;
  timeout?: number;
  maxFileSize?: number;
  password?: string;
}

/**
 * Parsing result interface
 */
export interface ParseResult {
  content: string;
  title: string;
  author: string;
  metadata: Record<string, unknown>;
  wordCount?: number;
  language?: string;
}

/**
 * Abstract base class for document parsers
 * Provides common functionality and error handling patterns
 */
export abstract class BaseDocumentParser {
  protected readonly supportedExtensions: string[];
  protected readonly parserName: string;
  
  constructor(supportedExtensions: string[], parserName: string) {
    this.supportedExtensions = supportedExtensions.map(ext => ext.toLowerCase());
    this.parserName = parserName;
  }

  /**
   * Check if the parser supports the given file extension
   */
  isSupported(fileExtension: string): boolean {
    return this.supportedExtensions.includes(fileExtension.toLowerCase());
  }

  /**
   * Get supported file extensions
   */
  getSupportedExtensions(): string[] {
    return [...this.supportedExtensions];
  }

  /**
   * Parse a document with comprehensive error handling
   */
  async parseDocument(
    filePath: string, 
    fileExtension: string,
    options: ParserOptions = {}
  ): Promise<ParseResult> {
    if (!this.isSupported(fileExtension)) {
      throw new DocumentProcessingError(
        `Unsupported file type: ${fileExtension}`,
        filePath,
        'validation',
        fileExtension.slice(1),
        { supportedExtensions: this.supportedExtensions }
      );
    }

    const progressCallback = options.progressCallback;
    
    try {
      progressCallback?.({
        stage: 'validation',
        percentage: 0,
        message: 'Validating file...'
      });

      await this.validateFile(filePath, options);
      
      progressCallback?.({
        stage: 'parsing',
        percentage: 25,
        message: 'Parsing document content...'
      });

      const result = await this.parseInternal(filePath, fileExtension, options);
      
      progressCallback?.({
        stage: 'post-processing',
        percentage: 75,
        message: 'Processing extracted content...'
      });

      const processedResult = await this.postProcess(result, options);
      
      progressCallback?.({
        stage: 'completed',
        percentage: 100,
        message: 'Document parsing completed successfully'
      });

      return processedResult;
    } catch (error) {
      if (error instanceof DocumentProcessingError) {
        throw error;
      }
      
      throw new DocumentProcessingError(
        `Failed to parse ${this.parserName} document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath,
        'parsing',
        fileExtension.slice(1),
        { parserName: this.parserName },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Validate file before parsing
   */
  protected abstract validateFile(filePath: string, options: ParserOptions): Promise<void>;

  /**
   * Internal parsing implementation - to be implemented by subclasses
   */
  protected abstract parseInternal(
    filePath: string, 
    fileExtension: string, 
    options: ParserOptions
  ): Promise<ParseResult>;

  /**
   * Post-process parsing results
   */
  protected async postProcess(result: ParseResult, options: ParserOptions): Promise<ParseResult> {
    const processedResult = { ...result };

    // Clean up content if requested
    if (options.validateContent !== false) {
      processedResult.content = this.cleanContent(processedResult.content);
    }

    // Calculate word count
    if (processedResult.content) {
      processedResult.wordCount = this.calculateWordCount(processedResult.content);
    }

    // Detect language if possible
    if (processedResult.content && !processedResult.language) {
      processedResult.language = this.detectLanguage(processedResult.content);
    }

    return processedResult;
  }

  /**
   * Clean and normalize extracted content
   */
  protected cleanContent(content: string): string {
    return content
      .replace(/\r\n/g, '\n')          // Normalize line endings
      .replace(/\r/g, '\n')            // Handle remaining carriage returns
      .replace(/\n{3,}/g, '\n\n')      // Reduce multiple empty lines
      .replace(/[ \t]+/g, ' ')         // Normalize whitespace
      .replace(/[ \t]*\n[ \t]*/g, '\n') // Clean line breaks
      .trim();
  }

  /**
   * Calculate word count
   */
  protected calculateWordCount(content: string): number {
    return content
      .split(/\s+/)
      .filter(word => word.length > 0)
      .length;
  }

  /**
   * Basic language detection (can be enhanced with proper language detection library)
   */
  protected detectLanguage(content: string): string {
    // Simple heuristic - can be replaced with proper language detection
    const sample = content.slice(0, 1000).toLowerCase();
    
    // English indicators
    if (/\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/.test(sample)) {
      return 'en';
    }
    
    // Default to unknown
    return 'unknown';
  }
}
