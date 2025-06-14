import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  DocumentProcessingError, 
  VectorDatabaseError, 
  EmbeddingError,
  isOperationalError,
  getUserFriendlyMessage,
  getRecoverySuggestions
} from '../../src/errors/index.js';

describe('Comprehensive Error Handling', () => {
  describe('DocumentProcessingError', () => {
    it('should create error with full context', () => {
      const error = new DocumentProcessingError(
        'Failed to parse PDF',
        '/path/to/document.pdf',
        'parsing',
        'pdf',
        { pageCount: 0, encrypted: true },
        new Error('Invalid PDF structure')
      );

      expect(error.message).toBe('Failed to parse PDF');
      expect(error.filePath).toBe('/path/to/document.pdf');
      expect(error.processingStage).toBe('parsing');
      expect(error.fileType).toBe('pdf');
      expect(error.context).toEqual({ pageCount: 0, encrypted: true });
      expect(error.cause).toBeInstanceOf(Error);
      expect(error.isOperational).toBe(true);
    });

    it('should provide stage-specific user messages', () => {
      const validationError = new DocumentProcessingError(
        'File not found',
        '/path/to/missing.pdf',
        'validation'
      );
      
      const parsingError = new DocumentProcessingError(
        'Corrupt PDF',
        '/path/to/corrupt.pdf',
        'parsing'
      );

      expect(validationError.getUserMessage()).toContain('file validation');
      expect(parsingError.getUserMessage()).toContain('parsing');
    });

    it('should provide stage-specific recovery suggestions', () => {
      const validationError = new DocumentProcessingError(
        'File not accessible',
        '/path/to/file.pdf',
        'validation'
      );

      const suggestions = validationError.getRecoverySuggestions();
      expect(suggestions).toContain('Check that the file exists and is readable');
      expect(suggestions).toContain('Verify file permissions');
    });

    it('should serialize to JSON with all relevant fields', () => {
      const error = new DocumentProcessingError(
        'Test error',
        '/test/path.pdf',
        'parsing',
        'pdf',
        { testField: 'testValue' }
      );

      const serialized = JSON.parse(JSON.stringify(error));
      expect(serialized.message).toBe('Test error');
      expect(serialized.filePath).toBe('/test/path.pdf');
      expect(serialized.processingStage).toBe('parsing');
      expect(serialized.context).toEqual({ testField: 'testValue' });
      expect(serialized.errorCode).toBe('DOCUMENT_PROCESSING_ERROR');
    });
  });

  describe('VectorDatabaseError', () => {
    it('should create error with operation context', () => {
      const error = new VectorDatabaseError(
        'Index corruption detected',
        'indexing',
        { indexSize: 1024, corruptedChunks: 5 },
        new Error('Database file corrupted')
      );

      expect(error.message).toBe('Index corruption detected');
      expect(error.operation).toBe('indexing');
      expect(error.context).toEqual({ indexSize: 1024, corruptedChunks: 5 });
      expect(error.severity).toBe('high');
    });

    it('should assign appropriate severity levels', () => {
      const initError = new VectorDatabaseError(
        'Failed to initialize',
        'initialization'
      );
      
      const searchError = new VectorDatabaseError(
        'Search timeout',
        'search'
      );

      expect(initError.severity).toBe('critical');
      expect(searchError.severity).toBe('medium');
    });

    it('should provide operation-specific recovery suggestions', () => {
      const indexError = new VectorDatabaseError(
        'Index build failed',
        'indexing'
      );

      const suggestions = indexError.getRecoverySuggestions();
      expect(suggestions).toContain('Try rebuilding the vector index');
      expect(suggestions).toContain('Check available disk space');
    });
  });

  describe('EmbeddingError', () => {
    it('should create error with model context', () => {
      const error = new EmbeddingError(
        'Model loading failed',
        'initialization',
        'Xenova/all-MiniLM-L6-v2',
        { modelSize: '22MB', downloadProgress: 0.5 },
        new Error('Network timeout')
      );

      expect(error.message).toBe('Model loading failed');
      expect(error.operation).toBe('initialization');
      expect(error.modelName).toBe('Xenova/all-MiniLM-L6-v2');
      expect(error.context).toEqual({ modelSize: '22MB', downloadProgress: 0.5 });
    });

    it('should provide model-specific user messages', () => {
      const error = new EmbeddingError(
        'Model not found',
        'initialization',
        'invalid-model-name'
      );

      const userMessage = error.getUserMessage();
      expect(userMessage).toContain('embedding model');
      expect(userMessage).toContain('invalid-model-name');
    });

    it('should provide operation-specific recovery suggestions', () => {
      const initError = new EmbeddingError(
        'Init failed',
        'initialization',
        'test-model'
      );
      
      const embeddingError = new EmbeddingError(
        'Embedding failed',
        'embedding',
        'test-model'
      );

      const initSuggestions = initError.getRecoverySuggestions();
      const embeddingSuggestions = embeddingError.getRecoverySuggestions();

      expect(initSuggestions).toContain('Check internet connection for model download');
      expect(embeddingSuggestions).toContain('Try with smaller batch size');
    });
  });

  describe('Error Utility Functions', () => {
    it('should correctly identify operational errors', () => {
      const operationalError = new DocumentProcessingError(
        'File not found',
        '/path/to/file.pdf',
        'validation'
      );
      
      const systemError = new Error('System crash');

      expect(isOperationalError(operationalError)).toBe(true);
      expect(isOperationalError(systemError)).toBe(false);
    });

    it('should provide user-friendly messages for all error types', () => {
      const docError = new DocumentProcessingError(
        'Technical error',
        '/path/file.pdf',
        'parsing'
      );
      
      const systemError = new Error('Internal system error');

      const docMessage = getUserFriendlyMessage(docError);
      const systemMessage = getUserFriendlyMessage(systemError);

      expect(docMessage).not.toContain('Technical error');
      expect(docMessage).toContain('document');
      
      expect(systemMessage).toContain('unexpected error');
      expect(systemMessage).toContain('try again');
    });

    it('should provide recovery suggestions for all error types', () => {
      const docError = new DocumentProcessingError(
        'Parse failed',
        '/path/file.pdf',
        'parsing'
      );
      
      const systemError = new Error('Unknown error');

      const docSuggestions = getRecoverySuggestions(docError);
      const systemSuggestions = getRecoverySuggestions(systemError);

      expect(docSuggestions).toBeInstanceOf(Array);
      expect(docSuggestions.length).toBeGreaterThan(0);
      
      expect(systemSuggestions).toBeInstanceOf(Array);
      expect(systemSuggestions).toContain('Try the operation again');
      expect(systemSuggestions).toContain('Contact support if the problem persists');
    });
  });

  describe('Error Chaining and Context', () => {
    it('should preserve error chain with proper context', () => {
      const rootCause = new Error('Network timeout');
      const embeddingError = new EmbeddingError(
        'Model download failed',
        'initialization',
        'test-model',
        { downloadProgress: 0.3 },
        rootCause
      );
      
      const processingError = new DocumentProcessingError(
        'Cannot process without embeddings',
        '/path/doc.pdf',
        'embedding',
        'pdf',
        { dependentService: 'embedding' },
        embeddingError
      );

      expect(processingError.cause).toBe(embeddingError);
      expect(embeddingError.cause).toBe(rootCause);
      
      // Should preserve original error information through the chain
      expect(processingError.message).toContain('Cannot process');
      expect((processingError.cause as EmbeddingError).message).toContain('Model download');
    });

    it('should handle complex error scenarios', () => {
      // Simulate a complex error scenario: 
      // File parsing fails due to embedding service unavailable due to network issues
      
      const networkError = new Error('DNS resolution failed');
      
      const embeddingError = new EmbeddingError(
        'Cannot connect to model service',
        'initialization',
        'Xenova/all-MiniLM-L6-v2',
        { 
          serviceUrl: 'https://huggingface.co',
          retryAttempts: 3,
          lastAttemptTime: new Date().toISOString()
        },
        networkError
      );

      const processingError = new DocumentProcessingError(
        'Document processing pipeline failed',
        '/important/document.pdf',
        'embedding',
        'pdf',
        {
          documentSize: 1024000,
          processedChunks: 0,
          totalChunks: 25,
          failurePoint: 'embedding_generation'
        },
        embeddingError
      );

      // Verify error context preservation
      expect(processingError.context.failurePoint).toBe('embedding_generation');
      expect(processingError.context.totalChunks).toBe(25);
      
      const embeddingContext = (processingError.cause as EmbeddingError).context;
      expect(embeddingContext.retryAttempts).toBe(3);
      expect(embeddingContext.serviceUrl).toBe('https://huggingface.co');

      // Verify user messages provide actionable information
      const userMessage = processingError.getUserMessage();
      expect(userMessage).toContain('document processing');
      
      const suggestions = processingError.getRecoverySuggestions();
      expect(suggestions.some(s => s.includes('network') || s.includes('connection'))).toBe(true);
    });
  });

  describe('Error Logging Integration', () => {
    it('should provide structured data for logging', () => {
      const error = new DocumentProcessingError(
        'Processing failed',
        '/docs/report.pdf',
        'parsing',
        'pdf',
        { 
          fileSize: 2048000,
          corruptPages: [1, 3, 7],
          processingStartTime: '2025-06-14T10:00:00Z'
        }
      );

      // Should serialize to structured format suitable for logging
      const logData = {
        error: error.message,
        errorCode: error.errorCode,
        filePath: error.filePath,
        fileType: error.fileType,
        processingStage: error.processingStage,
        context: error.context,
        severity: error.severity,
        timestamp: error.timestamp,
        isOperational: error.isOperational
      };

      expect(logData.errorCode).toBe('DOCUMENT_PROCESSING_ERROR');
      expect(logData.severity).toBe('medium');
      expect(logData.isOperational).toBe(true);
      expect(logData.context.fileSize).toBe(2048000);
      expect(logData.context.corruptPages).toEqual([1, 3, 7]);
    });

    it('should support error aggregation for monitoring', () => {
      const errors = [
        new DocumentProcessingError('Parse error 1', '/doc1.pdf', 'parsing'),
        new DocumentProcessingError('Parse error 2', '/doc2.pdf', 'parsing'),
        new VectorDatabaseError('Index error', 'indexing'),
        new EmbeddingError('Model error', 'initialization', 'test-model')
      ];

      // Group by error type and severity for monitoring
      const errorSummary = errors.reduce((acc, error) => {
        const key = `${error.constructor.name}-${error.severity}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      expect(errorSummary['DocumentProcessingError-medium']).toBe(2);
      expect(errorSummary['VectorDatabaseError-high']).toBe(1);
      expect(errorSummary['EmbeddingError-high']).toBe(1);
    });
  });
});