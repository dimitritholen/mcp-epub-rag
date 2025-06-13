/**
 * Base error class for all application errors
 * Provides structured error handling with context and recovery suggestions
 */
export abstract class BaseError extends Error {
  public readonly timestamp: Date;
  public readonly context: Record<string, unknown>;
  public readonly errorCode: string;
  public readonly isOperational: boolean;
  public readonly severity: 'low' | 'medium' | 'high' | 'critical';
  
  constructor(
    message: string,
    errorCode: string,
    context: Record<string, unknown> = {},
    isOperational: boolean = true,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.context = context;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    this.severity = severity;
    
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Get a structured representation of the error
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      errorCode: this.errorCode,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      severity: this.severity,
      isOperational: this.isOperational,
      stack: this.stack
    };
  }

  /**
   * Get a user-friendly error message
   */
  abstract getUserMessage(): string;

  /**
   * Get recovery suggestions
   */
  abstract getRecoverySuggestions(): string[];
}

/**
 * Document processing related errors
 */
export class DocumentProcessingError extends BaseError {
  public readonly filePath: string;
  public readonly fileType?: string;
  public readonly processingStage: 'validation' | 'parsing' | 'chunking' | 'embedding';
  
  constructor(
    message: string,
    filePath: string,
    processingStage: 'validation' | 'parsing' | 'chunking' | 'embedding',
    fileType?: string,
    context: Record<string, unknown> = {},
    cause?: Error
  ) {
    super(
      message,
      'DOCUMENT_PROCESSING_ERROR',
      {
        ...context,
        filePath,
        fileType,
        processingStage,
        cause: cause?.message
      },
      true,
      'medium'
    );
    
    this.filePath = filePath;
    this.fileType = fileType;
    this.processingStage = processingStage;
    
    if (cause) {
      this.cause = cause;
    }
  }

  getUserMessage(): string {
    switch (this.processingStage) {
      case 'validation':
        return `The file "${this.filePath}" could not be validated. Please check if the file exists and is accessible.`;
      case 'parsing':
        return `The file "${this.filePath}" could not be parsed. The file may be corrupted or in an unsupported format.`;
      case 'chunking':
        return `The document "${this.filePath}" could not be split into chunks. This may be due to unusual formatting.`;
      case 'embedding':
        return `The document "${this.filePath}" could not be processed for embeddings. This may be a temporary issue.`;
      default:
        return `An error occurred while processing the document "${this.filePath}".`;
    }
  }

  getRecoverySuggestions(): string[] {
    const suggestions = [];
    
    switch (this.processingStage) {
      case 'validation':
        suggestions.push('Verify the file path is correct');
        suggestions.push('Check file permissions');
        suggestions.push('Ensure the file is not in use by another application');
        break;
      case 'parsing':
        suggestions.push('Verify the file is not corrupted');
        suggestions.push('Check if the file format is supported');
        suggestions.push('Try converting the file to a supported format');
        break;
      case 'chunking':
        suggestions.push('Try adjusting chunk size and overlap settings');
        suggestions.push('Check document content for unusual formatting');
        break;
      case 'embedding':
        suggestions.push('Retry the operation');
        suggestions.push('Check if the embedding service is available');
        suggestions.push('Try reducing the chunk size');
        break;
    }
    
    return suggestions;
  }
}
