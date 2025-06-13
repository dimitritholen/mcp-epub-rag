import { BaseError } from './DocumentProcessingError.js';
export { BaseError, DocumentProcessingError } from './DocumentProcessingError.js';
export { 
  VectorDatabaseError, 
  EmbeddingError, 
  ConfigurationError, 
  ValidationError 
} from './ApplicationErrors.js';

/**
 * Type guard to check if an error is operational (safe to expose to users)
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof BaseError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Extract user-friendly message from any error
 */
export function getUserFriendlyMessage(error: Error): string {
  if (error instanceof BaseError) {
    return error.getUserMessage();
  }
  
  // For unknown errors, provide a generic message
  return 'An unexpected error occurred. Please try again or contact support if the problem persists.';
}

/**
 * Get recovery suggestions from any error
 */
export function getRecoverySuggestions(error: Error): string[] {
  if (error instanceof BaseError) {
    return error.getRecoverySuggestions();
  }
  
  // Generic recovery suggestions for unknown errors
  return [
    'Try the operation again',
    'Check your input parameters',
    'Verify your system has sufficient resources',
    'Contact support if the problem persists'
  ];
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Common error codes
 */
export enum ErrorCodes {
  DOCUMENT_PROCESSING_ERROR = 'DOCUMENT_PROCESSING_ERROR',
  VECTOR_DATABASE_ERROR = 'VECTOR_DATABASE_ERROR',
  EMBEDDING_ERROR = 'EMBEDDING_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED'
}
