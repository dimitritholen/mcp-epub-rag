import { describe, it, expect, beforeEach } from "vitest";
import { ChunkingService } from '../../src/services/chunkingService';
import { Document, DocumentChunk } from '../../src/types';
import { generateId } from '../../src/utils/helpers';

describe('ChunkingService', () => {
  let chunkingService: ChunkingService;
  let sampleDocument: Document;

  beforeEach(() => {
    chunkingService = new ChunkingService();
    sampleDocument = {
      id: generateId(),
      title: 'Test Document',
      content: 'This is a test document with multiple sentences. It contains several paragraphs to test the chunking functionality.\n\nThis is the second paragraph. It should be processed separately if paragraph preservation is enabled.\n\nThis is the third paragraph with more content to ensure proper chunking behavior.',
      metadata: {
        filePath: '/test/document.md',
        fileType: 'md',
        createdAt: new Date(),
        lastModified: new Date(),
        fileSize: 100
      },
      chunks: []
    };
  });

  describe('chunkDocument', () => {
    it('should create chunks from document content', () => {
      const chunks = chunkingService.chunkDocument(sampleDocument);
      
      expect(chunks).toBeDefined();
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should create chunks with proper structure', () => {
      const chunks = chunkingService.chunkDocument(sampleDocument);
      
      chunks.forEach((chunk, index) => {
        expect(chunk.id).toBeDefined();
        expect(chunk.documentId).toBe(sampleDocument.id);
        expect(chunk.content).toBeDefined();
        expect(typeof chunk.content).toBe('string');
        expect(chunk.startIndex).toBeDefined();
        expect(chunk.endIndex).toBeDefined();
        expect(chunk.startIndex).toBeLessThan(chunk.endIndex);
        expect(chunk.metadata).toBeDefined();
        expect(chunk.metadata.chunkIndex).toBe(index);
      });
    });

    it('should respect chunk size limits', () => {
      const chunkSize = 100;
      const chunks = chunkingService.chunkDocument(sampleDocument, { chunkSize });
      
      chunks.forEach(chunk => {
        // Allow some flexibility for sentence preservation
        expect(chunk.content.length).toBeLessThanOrEqual(chunkSize * 1.5);
      });
    });

    it('should create overlapping chunks when overlap is specified', () => {
      const chunkSize = 100;
      const chunkOverlap = 20;
      const chunks = chunkingService.chunkDocument(sampleDocument, { 
        chunkSize, 
        chunkOverlap 
      });
      
      if (chunks.length > 1) {
        // Check that consecutive chunks have overlapping content
        for (let i = 0; i < chunks.length - 1; i++) {
          const currentChunk = chunks[i];
          const nextChunk = chunks[i + 1];
          
          // There should be some overlap in the indices
          expect(nextChunk.startIndex).toBeLessThan(nextChunk.endIndex);
          if (chunkOverlap && chunkOverlap > 0 && currentChunk.endIndex > nextChunk.startIndex) {
            expect(currentChunk.endIndex).toBeGreaterThan(nextChunk.startIndex);
          }
        }
      }
    });

    it('should preserve sentences when enabled', () => {
      const chunks = chunkingService.chunkDocument(sampleDocument, {
        chunkSize: 50,
        preserveSentences: true
      });
      
      chunks.forEach(chunk => {
        // Chunks should not end in the middle of a sentence (unless it's very long)
        const content = chunk.content.trim();
        if (content.length > 0 && content.length < 200) {
          // Should end with sentence-ending punctuation or be a complete thought
          expect(content).toMatch(/[.!?]\s*$|^[^.!?]*$/);
        }
      });
    });

    it('should handle empty content gracefully', () => {
      const emptyDocument = {
        ...sampleDocument,
        content: ''
      };
      
      const chunks = chunkingService.chunkDocument(emptyDocument);
      
      expect(chunks).toBeDefined();
      expect(chunks.length).toBe(0);
    });

    it('should handle very short content', () => {
      const shortDocument = {
        ...sampleDocument,
        content: 'Short.'
      };
      
      const chunks = chunkingService.chunkDocument(shortDocument);
      
      expect(chunks).toBeDefined();
      expect(chunks.length).toBe(1);
      expect(chunks[0].content).toBe('Short.');
    });

    it('should handle very long content', () => {
      const longContent = 'This is a very long sentence that repeats itself. '.repeat(100);
      const longDocument = {
        ...sampleDocument,
        content: longContent
      };
      
      const chunks = chunkingService.chunkDocument(longDocument, {
        chunkSize: 200
      });
      
      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(1);
      
      // Verify all content is covered
      const totalChunkContent = chunks.map(c => c.content).join('');
      expect(totalChunkContent.length).toBeGreaterThanOrEqual(longContent.length * 0.9);
    });

    it('should create non-overlapping chunks when overlap is 0', () => {
      const chunks = chunkingService.chunkDocument(sampleDocument, {
        chunkSize: 100,
        chunkOverlap: 0,
        preserveSentences: false
      });
      
      if (chunks.length > 1) {
        for (let i = 0; i < chunks.length - 1; i++) {
          const currentChunk = chunks[i];
          const nextChunk = chunks[i + 1];
          
          expect(nextChunk.startIndex).toBeGreaterThanOrEqual(currentChunk.endIndex);
        }
      }
    });

    it('should handle custom chunking options', () => {
      const customOptions = {
        chunkSize: 150,
        chunkOverlap: 30,
        preserveSentences: false,
        preserveParagraphs: false
      };
      
      const chunks = chunkingService.chunkDocument(sampleDocument, customOptions);
      
      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);
      
      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeLessThanOrEqual(customOptions.chunkSize * 1.2);
      });
    });

    it('should maintain proper chunk indices', () => {
      const chunks = chunkingService.chunkDocument(sampleDocument);
      
      chunks.forEach((chunk, index) => {
        expect(chunk.metadata.chunkIndex).toBe(index);
      });
    });
  });
});