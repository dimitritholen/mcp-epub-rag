import { BaseError } from './DocumentProcessingError.js';

/**
 * Vector database related errors
 */
export class VectorDatabaseError extends BaseError {
  public readonly operation: 'initialization' | 'indexing' | 'search' | 'storage' | 'retrieval';
  public readonly databasePath?: string;
  
  constructor(
    message: string,
    operation: 'initialization' | 'indexing' | 'search' | 'storage' | 'retrieval',
    databasePath?: string,
    context: Record<string, unknown> = {},
    cause?: Error
  ) {
    super(
      message,
      'VECTOR_DATABASE_ERROR',
      {
        ...context,
        operation,
        databasePath,
        cause: cause?.message
      },
      true,
      operation === 'initialization' ? 'high' : 'medium'
    );
    
    this.operation = operation;
    if (databasePath !== undefined) {
      this.databasePath = databasePath;
    }
    
    if (cause) {
      this.cause = cause;
    }
  }

  getUserMessage(): string {
    switch (this.operation) {
      case 'initialization':
        return 'Failed to initialize the vector database. Please check your configuration.';
      case 'indexing':
        return 'Failed to index documents in the vector database.';
      case 'search':
        return 'Search operation failed. Please try again with a different query.';
      case 'storage':
        return 'Failed to store data in the vector database.';
      case 'retrieval':
        return 'Failed to retrieve data from the vector database.';
      default:
        return 'A vector database operation failed.';
    }
  }

  getRecoverySuggestions(): string[] {
    const suggestions = [];
    
    switch (this.operation) {
      case 'initialization':
        suggestions.push('Check if the database path is writable');
        suggestions.push('Verify sufficient disk space');
        suggestions.push('Ensure no other process is using the database');
        break;
      case 'indexing':
      case 'storage':
        suggestions.push('Check available disk space');
        suggestions.push('Verify write permissions');
        suggestions.push('Try reducing batch size');
        break;
      case 'search':
      case 'retrieval':
        suggestions.push('Retry the operation');
        suggestions.push('Check if the database is properly initialized');
        suggestions.push('Verify the search query format');
        break;
    }
    
    return suggestions;
  }
}

/**
 * Embedding service related errors
 */
export class EmbeddingError extends BaseError {
  public readonly modelName: string;
  public readonly operation: 'initialization' | 'embedding' | 'batch_processing';
  
  constructor(
    message: string,
    modelName: string,
    operation: 'initialization' | 'embedding' | 'batch_processing',
    context: Record<string, unknown> = {},
    cause?: Error
  ) {
    super(
      message,
      'EMBEDDING_ERROR',
      {
        ...context,
        modelName,
        operation,
        cause: cause?.message
      },
      true,
      'medium'
    );
    
    this.modelName = modelName;
    this.operation = operation;
    
    if (cause) {
      this.cause = cause;
    }
  }

  getUserMessage(): string {
    switch (this.operation) {
      case 'initialization':
        return `Failed to initialize the embedding model "${this.modelName}". Please check your configuration.`;
      case 'embedding':
        return 'Failed to generate embeddings for the text content.';
      case 'batch_processing':
        return 'Failed to process multiple embeddings in batch.';
      default:
        return 'An embedding operation failed.';
    }
  }

  getRecoverySuggestions(): string[] {
    const suggestions = [];
    
    switch (this.operation) {
      case 'initialization':
        suggestions.push('Check internet connection for model download');
        suggestions.push('Verify the model name is correct');
        suggestions.push('Check available memory and disk space');
        break;
      case 'embedding':
        suggestions.push('Try with smaller text chunks');
        suggestions.push('Verify the text content is valid');
        suggestions.push('Retry the operation');
        break;
      case 'batch_processing':
        suggestions.push('Try reducing batch size');
        suggestions.push('Check available memory');
        suggestions.push('Process items individually');
        break;
    }
    
    return suggestions;
  }
}

/**
 * Configuration related errors
 */
export class ConfigurationError extends BaseError {
  public readonly configKey?: string;
  
  constructor(
    message: string,
    configKey?: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      message,
      'CONFIGURATION_ERROR',
      {
        ...context,
        configKey
      },
      true,
      'high'
    );
    
    if (configKey !== undefined) {
      this.configKey = configKey;
    }
  }

  getUserMessage(): string {
    if (this.configKey) {
      return `Configuration error in "${this.configKey}": ${this.message}`;
    }
    return `Configuration error: ${this.message}`;
  }

  getRecoverySuggestions(): string[] {
    return [
      'Check your configuration file for syntax errors',
      'Verify all required configuration values are provided',
      'Ensure file paths in configuration exist and are accessible',
      'Review the documentation for configuration requirements'
    ];
  }
}

/**
 * Validation related errors
 */
export class ValidationError extends BaseError {
  public readonly field?: string;
  public readonly value?: unknown;
  
  constructor(
    message: string,
    field?: string,
    value?: unknown,
    context: Record<string, unknown> = {}
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      {
        ...context,
        field,
        value
      },
      true,
      'medium'
    );
    
    if (field !== undefined) {
      this.field = field;
    }
    this.value = value;
  }

  getUserMessage(): string {
    if (this.field) {
      return `Validation error in field "${this.field}": ${this.message}`;
    }
    return `Validation error: ${this.message}`;
  }

  getRecoverySuggestions(): string[] {
    return [
      'Check the input format and requirements',
      'Verify all required fields are provided',
      'Ensure values are within acceptable ranges',
      'Review the API documentation for parameter specifications'
    ];
  }
}
