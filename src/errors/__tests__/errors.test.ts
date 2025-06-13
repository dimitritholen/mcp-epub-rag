import { describe, it, expect, beforeEach } from 'vitest';
import { 
  BaseError, 
  DocumentProcessingError, 
  VectorDatabaseError,
  EmbeddingError,
  ConfigurationError,
  ValidationError,
  isOperationalError,
  getUserFriendlyMessage,
  getRecoverySuggestions 
} from '../index.js';

describe('Error System', () => {
  describe('BaseError', () => {
    class TestError extends BaseError {
      getUserMessage(): string {
        return 'Test user message';
      }
      
      getRecoverySuggestions(): string[] {
        return ['Test suggestion 1', 'Test suggestion 2'];
      }
    }

    it('should create base error with all properties', () => {
      const error = new TestError(
        'Test message',
        'TEST_ERROR',
        { key: 'value' },
        true,
        'high'
      );

      expect(error.message).toBe('Test message');
      expect(error.errorCode).toBe('TEST_ERROR');
      expect(error.context).toEqual({ key: 'value' });
      expect(error.isOperational).toBe(true);
      expect(error.severity).toBe('high');
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should have default values', () => {
      const error = new TestError('Test', 'TEST');

      expect(error.context).toEqual({});
      expect(error.isOperational).toBe(true);
      expect(error.severity).toBe('medium');
    });

    it('should serialize to JSON correctly', () => {
      const error = new TestError('Test', 'TEST', { data: 'test' });
      const json = error.toJSON();

      expect(json.name).toBe('TestError');
      expect(json.message).toBe('Test');
      expect(json.errorCode).toBe('TEST');
      expect(json.context).toEqual({ data: 'test' });
      expect(json.timestamp).toBeDefined();
      expect(json.stack).toBeDefined();
    });
  });

  describe('DocumentProcessingError', () => {
    it('should create with all parameters', () => {
      const error = new DocumentProcessingError(
        'Parse failed',
        '/path/to/file.pdf',
        'parsing',
        'pdf',
        { extra: 'data' },
        new Error('Cause')
      );

      expect(error.message).toBe('Parse failed');
      expect(error.filePath).toBe('/path/to/file.pdf');
      expect(error.processingStage).toBe('parsing');
      expect(error.fileType).toBe('pdf');
      expect(error.cause).toBeInstanceOf(Error);
    });

    it('should provide user messages for different stages', () => {
      const validationError = new DocumentProcessingError(
        'Validation failed',
        '/path/file.pdf',
        'validation'
      );
      expect(validationError.getUserMessage()).toContain('validated');

      const parsingError = new DocumentProcessingError(
        'Parse failed',
        '/path/file.pdf',
        'parsing'
      );
      expect(parsingError.getUserMessage()).toContain('parsed');

      const chunkingError = new DocumentProcessingError(
        'Chunk failed',
        '/path/file.pdf',
        'chunking'
      );
      expect(chunkingError.getUserMessage()).toContain('chunks');

      const embeddingError = new DocumentProcessingError(
        'Embedding failed',
        '/path/file.pdf',
        'embedding'
      );
      expect(embeddingError.getUserMessage()).toContain('embeddings');
    });

    it('should provide recovery suggestions for different stages', () => {
      const validationError = new DocumentProcessingError(
        'Validation failed',
        '/path/file.pdf',
        'validation'
      );
      const suggestions = validationError.getRecoverySuggestions();
      expect(suggestions).toContain('Verify the file path is correct');
      expect(suggestions).toContain('Check file permissions');

      const parsingError = new DocumentProcessingError(
        'Parse failed',
        '/path/file.pdf',
        'parsing'
      );
      const parseSuggestions = parsingError.getRecoverySuggestions();
      expect(parseSuggestions).toContain('Verify the file is not corrupted');
      expect(parseSuggestions).toContain('Check if the file format is supported');
    });
  });

  describe('VectorDatabaseError', () => {
    it('should create with all parameters', () => {
      const error = new VectorDatabaseError(
        'DB failed',
        'indexing',
        '/path/to/db',
        { batch: 'data' },
        new Error('Cause')
      );

      expect(error.message).toBe('DB failed');
      expect(error.operation).toBe('indexing');
      expect(error.databasePath).toBe('/path/to/db');
      expect(error.cause).toBeInstanceOf(Error);
    });

    it('should provide user messages for different operations', () => {
      const initError = new VectorDatabaseError('Init failed', 'initialization');
      expect(initError.getUserMessage()).toContain('initialize');

      const searchError = new VectorDatabaseError('Search failed', 'search');
      expect(searchError.getUserMessage()).toContain('Search operation failed');
    });

    it('should have higher severity for initialization errors', () => {
      const initError = new VectorDatabaseError('Init failed', 'initialization');
      expect(initError.severity).toBe('high');

      const searchError = new VectorDatabaseError('Search failed', 'search');
      expect(searchError.severity).toBe('medium');
    });
  });

  describe('EmbeddingError', () => {
    it('should create with all parameters', () => {
      const error = new EmbeddingError(
        'Embedding failed',
        'all-MiniLM-L6-v2',
        'embedding',
        { text: 'sample' },
        new Error('Cause')
      );

      expect(error.message).toBe('Embedding failed');
      expect(error.modelName).toBe('all-MiniLM-L6-v2');
      expect(error.operation).toBe('embedding');
      expect(error.cause).toBeInstanceOf(Error);
    });

    it('should provide model-specific user messages', () => {
      const initError = new EmbeddingError(
        'Init failed',
        'test-model',
        'initialization'
      );
      expect(initError.getUserMessage()).toContain('test-model');
    });

    it('should provide operation-specific recovery suggestions', () => {
      const initError = new EmbeddingError(
        'Init failed',
        'test-model',
        'initialization'
      );
      const suggestions = initError.getRecoverySuggestions();
      expect(suggestions).toContain('Check internet connection for model download');

      const embeddingError = new EmbeddingError(
        'Embedding failed',
        'test-model',
        'embedding'
      );
      const embeddingSuggestions = embeddingError.getRecoverySuggestions();
      expect(embeddingSuggestions).toContain('Try with smaller text chunks');
    });
  });

  describe('ConfigurationError', () => {
    it('should create with config key', () => {
      const error = new ConfigurationError(
        'Invalid config',
        'vectorDbPath',
        { value: '/invalid/path' }
      );

      expect(error.message).toBe('Invalid config');
      expect(error.configKey).toBe('vectorDbPath');
      expect(error.severity).toBe('high');
    });

    it('should provide config-specific user messages', () => {
      const error = new ConfigurationError('Invalid value', 'testKey');
      expect(error.getUserMessage()).toContain('testKey');
      expect(error.getUserMessage()).toContain('Invalid value');
    });
  });

  describe('ValidationError', () => {
    it('should create with field and value', () => {
      const error = new ValidationError(
        'Invalid input',
        'email',
        'not-an-email',
        { required: true }
      );

      expect(error.message).toBe('Invalid input');
      expect(error.field).toBe('email');
      expect(error.value).toBe('not-an-email');
    });

    it('should provide field-specific user messages', () => {
      const error = new ValidationError('Invalid format', 'email');
      expect(error.getUserMessage()).toContain('email');
      expect(error.getUserMessage()).toContain('Invalid format');
    });
  });

  describe('utility functions', () => {
    describe('isOperationalError', () => {
      it('should return true for operational errors', () => {
        const error = new DocumentProcessingError('Test', '/path', 'parsing');
        expect(isOperationalError(error)).toBe(true);
      });

      it('should return false for non-operational errors', () => {
        const error = new Error('Regular error');
        expect(isOperationalError(error)).toBe(false);
      });
    });

    describe('getUserFriendlyMessage', () => {
      it('should return custom message for BaseError instances', () => {
        const error = new DocumentProcessingError('Technical error', '/path', 'parsing');
        const message = getUserFriendlyMessage(error);
        expect(message).toContain('parsed');
        expect(message).not.toBe('Technical error');
      });

      it('should return generic message for unknown errors', () => {
        const error = new Error('Unknown error');
        const message = getUserFriendlyMessage(error);
        expect(message).toContain('unexpected error occurred');
      });
    });

    describe('getRecoverySuggestions', () => {
      it('should return specific suggestions for BaseError instances', () => {
        const error = new DocumentProcessingError('Test', '/path', 'validation');
        const suggestions = getRecoverySuggestions(error);
        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions[0]).toBe('Verify the file path is correct');
      });

      it('should return generic suggestions for unknown errors', () => {
        const error = new Error('Unknown error');
        const suggestions = getRecoverySuggestions(error);
        expect(suggestions).toContain('Try the operation again');
        expect(suggestions).toContain('Contact support if the problem persists');
      });
    });
  });

  describe('error chaining', () => {
    it('should preserve original error as cause', () => {
      const originalError = new Error('Original error');
      const wrappedError = new DocumentProcessingError(
        'Wrapped error',
        '/path',
        'parsing',
        'pdf',
        {},
        originalError
      );

      expect(wrappedError.cause).toBe(originalError);
      expect(wrappedError.context.cause).toBe('Original error');
    });

    it('should handle nested error chains', () => {
      const rootCause = new Error('Root cause');
      const middleError = new DocumentProcessingError(
        'Middle error',
        '/path',
        'parsing',
        'pdf',
        {},
        rootCause
      );
      const topError = new VectorDatabaseError(
        'Top error',
        'storage',
        '/db/path',
        {},
        middleError
      );

      expect(topError.cause).toBe(middleError);
      expect((topError.cause as any).cause).toBe(rootCause);
    });
  });

  describe('error context', () => {
    it('should include relevant context information', () => {
      const error = new DocumentProcessingError(
        'Parse failed',
        '/documents/large.pdf',
        'parsing',
        'pdf',
        {
          fileSize: 1024000,
          pageCount: 100,
          processingTime: 5000
        }
      );

      expect(error.context.fileSize).toBe(1024000);
      expect(error.context.pageCount).toBe(100);
      expect(error.context.processingTime).toBe(5000);
      expect(error.context.filePath).toBe('/documents/large.pdf');
      expect(error.context.fileType).toBe('pdf');
      expect(error.context.processingStage).toBe('parsing');
    });

    it('should merge custom context with default context', () => {
      const error = new VectorDatabaseError(
        'Storage failed',
        'storage',
        '/vector/db',
        {
          batchSize: 100,
          documentsProcessed: 50
        }
      );

      expect(error.context.operation).toBe('storage');
      expect(error.context.databasePath).toBe('/vector/db');
      expect(error.context.batchSize).toBe(100);
      expect(error.context.documentsProcessed).toBe(50);
    });
  });
});
