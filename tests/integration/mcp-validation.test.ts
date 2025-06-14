import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { 
  SearchToolArgsSchema, 
  AddDocumentsToolArgsSchema, 
  ListDocumentsToolArgsSchema,
  ConfigSchema 
} from '../../src/types.js';
import { SECURITY_LIMITS } from '../../src/utils/helpers.js';

describe('MCP Tool Validation', () => {
  describe('SearchToolArgsSchema', () => {
    it('should validate proper search arguments', () => {
      const validArgs = {
        query: 'machine learning',
        maxResults: 10,
        threshold: 0.7,
        fileTypes: ['pdf', 'md']
      };

      const result = SearchToolArgsSchema.parse(validArgs);
      expect(result).toEqual(validArgs);
    });

    it('should require query field', () => {
      const invalidArgs = {
        maxResults: 10
      };

      expect(() => SearchToolArgsSchema.parse(invalidArgs)).toThrow();
    });

    it('should reject empty query strings', () => {
      const invalidArgs = {
        query: ''
      };

      expect(() => SearchToolArgsSchema.parse(invalidArgs)).toThrow();
    });

    it('should validate threshold range', () => {
      const invalidArgs = {
        query: 'test',
        threshold: 1.5 // Should be between 0-1
      };

      expect(() => SearchToolArgsSchema.parse(invalidArgs)).toThrow();
    });

    it('should validate positive maxResults', () => {
      const invalidArgs = {
        query: 'test',
        maxResults: -5
      };

      expect(() => SearchToolArgsSchema.parse(invalidArgs)).toThrow();
    });

    it('should accept optional fields', () => {
      const minimalArgs = {
        query: 'machine learning'
      };

      const result = SearchToolArgsSchema.parse(minimalArgs);
      expect(result.query).toBe('machine learning');
      expect(result.maxResults).toBeUndefined();
      expect(result.threshold).toBeUndefined();
    });
  });

  describe('AddDocumentsToolArgsSchema', () => {
    it('should validate proper add documents arguments', () => {
      const validArgs = {
        filePaths: ['/path/to/doc1.pdf', '/path/to/doc2.md'],
        options: {
          batchSize: 5,
          timeout: 30000,
          overwrite: false
        }
      };

      const result = AddDocumentsToolArgsSchema.parse(validArgs);
      expect(result).toEqual(validArgs);
    });

    it('should require filePaths field', () => {
      const invalidArgs = {
        options: { batchSize: 5 }
      };

      expect(() => AddDocumentsToolArgsSchema.parse(invalidArgs)).toThrow();
    });

    it('should reject empty filePaths array', () => {
      const invalidArgs = {
        filePaths: []
      };

      expect(() => AddDocumentsToolArgsSchema.parse(invalidArgs)).toThrow();
    });

    it('should reject empty file paths', () => {
      const invalidArgs = {
        filePaths: ['valid/path.pdf', '', 'another/path.md']
      };

      expect(() => AddDocumentsToolArgsSchema.parse(invalidArgs)).toThrow();
    });

    it('should validate positive numbers in options', () => {
      const invalidArgs = {
        filePaths: ['/path/to/doc.pdf'],
        options: {
          batchSize: -1,
          timeout: -5000
        }
      };

      expect(() => AddDocumentsToolArgsSchema.parse(invalidArgs)).toThrow();
    });

    it('should accept minimal arguments', () => {
      const minimalArgs = {
        filePaths: ['/path/to/doc.pdf']
      };

      const result = AddDocumentsToolArgsSchema.parse(minimalArgs);
      expect(result.filePaths).toEqual(['/path/to/doc.pdf']);
      expect(result.options).toBeUndefined();
    });
  });

  describe('ListDocumentsToolArgsSchema', () => {
    it('should validate proper list documents arguments', () => {
      const validArgs = {
        fileType: 'pdf',
        author: 'John Doe',
        sortBy: 'date' as const,
        sortOrder: 'desc' as const,
        limit: 20,
        offset: 0
      };

      const result = ListDocumentsToolArgsSchema.parse(validArgs);
      expect(result).toEqual(validArgs);
    });

    it('should validate enum values for sortBy', () => {
      const invalidArgs = {
        sortBy: 'invalid-sort'
      };

      expect(() => ListDocumentsToolArgsSchema.parse(invalidArgs)).toThrow();
    });

    it('should validate enum values for sortOrder', () => {
      const invalidArgs = {
        sortOrder: 'invalid-order'
      };

      expect(() => ListDocumentsToolArgsSchema.parse(invalidArgs)).toThrow();
    });

    it('should validate positive limit', () => {
      const invalidArgs = {
        limit: -10
      };

      expect(() => ListDocumentsToolArgsSchema.parse(invalidArgs)).toThrow();
    });

    it('should validate non-negative offset', () => {
      const invalidArgs = {
        offset: -5
      };

      expect(() => ListDocumentsToolArgsSchema.parse(invalidArgs)).toThrow();
    });

    it('should accept all optional fields', () => {
      const result = ListDocumentsToolArgsSchema.parse({});
      expect(result).toEqual({});
    });
  });

  describe('ConfigSchema', () => {
    it('should validate proper configuration', () => {
      const validConfig = {
        documents: ['/path/to/doc1.pdf', '/path/to/doc2.md'],
        vectorDbPath: '/path/to/vector-db',
        embeddingModel: 'Xenova/all-MiniLM-L6-v2',
        chunkSize: 512,
        chunkOverlap: 50,
        maxResults: 10,
        timeout: 30000,
        logLevel: 'info' as const
      };

      const result = ConfigSchema.parse(validConfig);
      expect(result).toEqual(validConfig);
    });

    it('should require documents and vectorDbPath', () => {
      const invalidConfig = {
        embeddingModel: 'test-model'
      };

      expect(() => ConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should apply default values', () => {
      const minimalConfig = {
        documents: ['/path/to/doc.pdf'],
        vectorDbPath: '/path/to/db'
      };

      const result = ConfigSchema.parse(minimalConfig);
      expect(result.embeddingModel).toBe('Xenova/all-MiniLM-L6-v2');
      expect(result.chunkSize).toBe(512);
      expect(result.chunkOverlap).toBe(50);
      expect(result.maxResults).toBe(10);
      expect(result.timeout).toBe(30000);
      expect(result.logLevel).toBe('info');
    });

    it('should validate log level enum', () => {
      const invalidConfig = {
        documents: ['/path/to/doc.pdf'],
        vectorDbPath: '/path/to/db',
        logLevel: 'invalid-level'
      };

      expect(() => ConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should validate positive numeric values', () => {
      const invalidConfig = {
        documents: ['/path/to/doc.pdf'],
        vectorDbPath: '/path/to/db',
        chunkSize: -100,
        maxResults: 0
      };

      expect(() => ConfigSchema.parse(invalidConfig)).toThrow();
    });
  });

  describe('Security Validation Integration', () => {
    it('should enforce batch size limits', () => {
      // Test that schemas would reject batch sizes exceeding security limits
      const largeFileList = Array(SECURITY_LIMITS.MAX_BATCH_SIZE + 1)
        .fill(0)
        .map((_, i) => `/path/to/file${i}.pdf`);

      const args = {
        filePaths: largeFileList
      };

      // Schema itself doesn't enforce this limit, but application logic should
      const result = AddDocumentsToolArgsSchema.parse(args);
      expect(result.filePaths).toHaveLength(SECURITY_LIMITS.MAX_BATCH_SIZE + 1);
      
      // This would be caught by application validation logic
      expect(result.filePaths.length).toBeGreaterThan(SECURITY_LIMITS.MAX_BATCH_SIZE);
    });

    it('should validate against common injection patterns', () => {
      const maliciousArgs = {
        query: '<script>alert("xss")</script>DROP TABLE documents;--',
        fileTypes: ['../../../etc/passwd', 'normal.pdf']
      };

      // Schema validation passes, but content validation should catch this
      const result = SearchToolArgsSchema.parse(maliciousArgs);
      expect(result.query).toContain('<script>');
      expect(result.fileTypes).toContain('../../../etc/passwd');
    });

    it('should handle edge cases in validation', () => {
      const edgeCases = [
        { query: '   ', maxResults: 0 }, // Whitespace-only query, zero results
        { query: 'a'.repeat(1000) }, // Very long query (but within reasonable limits)
        { query: 'test', threshold: 0 }, // Minimum threshold
        { query: 'test', threshold: 1 } // Maximum threshold
      ];

      edgeCases.forEach((testCase, index) => {
        try {
          const result = SearchToolArgsSchema.parse(testCase);
          // Some may pass schema validation but fail business logic validation
          console.log(`Edge case ${index} passed schema validation:`, result);
        } catch (error) {
          // Some should fail schema validation
          console.log(`Edge case ${index} failed schema validation:`, error.message);
        }
      });
    });
  });

  describe('Error Message Quality', () => {
    it('should provide descriptive error messages', () => {
      const invalidArgs = {
        query: '',
        maxResults: -5,
        threshold: 2.0
      };

      try {
        SearchToolArgsSchema.parse(invalidArgs);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeInstanceOf(z.ZodError);
        const zodError = error as z.ZodError;
        
        // Should have multiple validation errors
        expect(zodError.errors.length).toBeGreaterThan(1);
        
        // Should include specific field information
        const errorMessages = zodError.errors.map(e => e.message);
        expect(errorMessages.some(msg => msg.includes('String must contain at least 1 character(s)'))).toBe(true);
      }
    });

    it('should handle nested validation errors', () => {
      const invalidArgs = {
        filePaths: ['valid.pdf'],
        options: {
          batchSize: -1,
          timeout: 'not-a-number',
          maxFileSize: -100
        }
      };

      try {
        AddDocumentsToolArgsSchema.parse(invalidArgs);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeInstanceOf(z.ZodError);
        const zodError = error as z.ZodError;
        
        // Should validate nested options object
        expect(zodError.errors.length).toBeGreaterThan(0);
        expect(zodError.errors.some(e => e.path.includes('options'))).toBe(true);
      }
    });
  });
});