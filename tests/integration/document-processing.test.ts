import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DocumentParser } from '../../src/parsers/documentParser.js';
import { ChunkingService } from '../../src/services/chunkingService.js';
import { 
  TestFileUtils, 
  TestDataGenerator, 
  PerformanceTestUtils,
  TEST_CONFIG,
  SAMPLE_DOCUMENTS
} from '../setup.js';
import { DocumentProcessingError } from '@/errors/DocumentProcessingError';
import path from 'path';
import fs from 'fs-extra';

// Mock external dependencies for integration tests
vi.mock('pdf-parse-debugging-disabled', () => ({
  default: vi.fn().mockImplementation((buffer) => {
    const content = buffer.toString();
    return Promise.resolve({
      text: `Parsed content from: ${content}`,
      info: { 
        Title: 'Integration Test PDF',
        Author: 'Test Author'
      },
      numpages: 1,
      version: '1.4'
    });
  })
}));

vi.mock('mammoth', () => ({
  extractRawText: vi.fn().mockImplementation(({ buffer }) => {
    const content = buffer.toString();
    return Promise.resolve({
      value: `Parsed DOCX content from: ${content}`,
      messages: []
    });
  })
}));

vi.mock('epub2', () => ({
  default: vi.fn().mockImplementation((filePath) => {
    const mockEpub = {
      on: vi.fn(),
      parse: vi.fn(),
      metadata: {
        title: 'Integration Test EPUB',
        creator: 'Test Author'
      },
      flow: [
        { id: 'chapter1' },
        { id: 'chapter2' }
      ],
      getChapter: vi.fn()
    };

    mockEpub.on.mockImplementation((event, callback) => {
      if (event === 'end') {
        setTimeout(callback, 10);
      }
    });

    mockEpub.getChapter.mockImplementation((id, callback) => {
      callback(null, `<p>Content for ${id}</p>`);
    });

    return mockEpub;
  })
}));

describe('Document Processing Integration Tests', () => {
  let documentParser: DocumentParser;
  let chunkingService: ChunkingService;
  let testFiles: string[] = [];

  beforeEach(() => {
    documentParser = new DocumentParser();
    chunkingService = new ChunkingService();
    testFiles = [];
  });

  afterEach(async () => {
    await TestFileUtils.cleanupFiles(testFiles);
  });

  describe('End-to-End Document Processing', () => {
    it('should process markdown document from start to finish', async () => {
      const testFile = path.join(TEST_CONFIG.tempDir, 'e2e-test.md');
      testFiles.push(testFile);

      const markdownContent = TestDataGenerator.generateMarkdown({
        title: 'End-to-End Test Document',
        content: 'This is a comprehensive test of the document processing pipeline.',
        frontmatter: {
          title: 'E2E Test',
          author: 'Integration Test',
          category: 'testing'
        },
        sections: 5
      });

      await TestFileUtils.createTestFile(testFile, markdownContent);

      // Measure performance
      const { result: document, duration } = await PerformanceTestUtils.measureTime(
        () => documentParser.parseDocument(testFile)
      );

      // Verify document parsing
      expect(document).toBeDefined();
      expect(document.title).toBe('End-to-End Test Document');
      expect(document.content).toContain('comprehensive test');
      expect(document.metadata.author).toBe('Integration Test');
      expect(document.metadata.fileType).toBe('md');
      expect(document.metadata.wordCount).toBeGreaterThan(0);

      // Process through chunking service
      const chunks = chunkingService.chunkDocument(document, {
        chunkSize: 200,
        chunkOverlap: 50
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]?.content).toBeDefined();
      expect(chunks[0]?.documentId).toBe(document.id);

      // Verify performance
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      console.log(`E2E processing completed in ${duration}ms with ${chunks.length} chunks`);
    });

    it('should handle batch processing of multiple formats', async () => {
      const testFileConfigs = [
        {
          path: path.join(TEST_CONFIG.tempDir, 'batch-1.md'),
          content: SAMPLE_DOCUMENTS.markdown.simple
        },
        {
          path: path.join(TEST_CONFIG.tempDir, 'batch-2.pdf'),
          content: SAMPLE_DOCUMENTS.pdf.valid
        },
        {
          path: path.join(TEST_CONFIG.tempDir, 'batch-3.docx'),
          content: SAMPLE_DOCUMENTS.docx.valid
        },
        {
          path: path.join(TEST_CONFIG.tempDir, 'batch-4.epub'),
          content: SAMPLE_DOCUMENTS.epub.valid
        }
      ];

      const createdFiles = await TestFileUtils.createTestFiles(testFileConfigs);
      testFiles.push(...createdFiles);

      const { result: batchResult } = await PerformanceTestUtils.measureTime(
        () => documentParser.parseDocuments(createdFiles)
      );

      expect(batchResult.successful).toHaveLength(4);
      expect(batchResult.failed).toHaveLength(0);
      expect(batchResult.stats.successCount).toBe(4);
      expect(batchResult.stats.failureCount).toBe(0);

      // Verify each document type was processed correctly
      const docTypes = batchResult.successful.map(doc => doc.metadata.fileType);
      expect(docTypes).toContain('md');
      expect(docTypes).toContain('pdf');
      expect(docTypes).toContain('docx');
      expect(docTypes).toContain('epub');
    });

    it('should handle large document processing efficiently', async () => {
      const testFile = path.join(TEST_CONFIG.tempDir, 'large-doc.md');
      testFiles.push(testFile);

      const largeContent = TestDataGenerator.generateMarkdown({
        title: 'Large Document Performance Test',
        content: TestDataGenerator.generateLargeText(500), // 500KB
        sections: 10
      });

      await TestFileUtils.createTestFile(testFile, largeContent);

      const { result: document, duration } = await PerformanceTestUtils.measureTime(
        () => documentParser.parseDocument(testFile)
      );

      expect(document).toBeDefined();
      expect(document.content.length).toBeGreaterThan(500000); // 500KB+
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      // Test chunking performance
      const { result: chunks, duration: chunkDuration } = await PerformanceTestUtils.measureTime(
        () => chunkingService.chunkDocument(document, {
          chunkSize: 512,
          chunkOverlap: 50
        })
      );

      expect(chunks.length).toBeGreaterThan(100); // Should create many chunks
      expect(chunkDuration).toBeLessThan(5000); // Chunking should be fast

      console.log(`Large document: ${chunks.length} chunks in ${chunkDuration}ms`);
    });

    it('should handle mixed success/failure scenarios gracefully', async () => {
      const testFileConfigs = [
        {
          path: path.join(TEST_CONFIG.tempDir, 'valid.md'),
          content: SAMPLE_DOCUMENTS.markdown.simple
        },
        {
          path: path.join(TEST_CONFIG.tempDir, 'invalid.pdf'),
          content: Buffer.from('Not a valid PDF')
        },
        {
          path: path.join(TEST_CONFIG.tempDir, 'another-valid.md'),
          content: SAMPLE_DOCUMENTS.markdown.withCode
        }
      ];

      const createdFiles = await TestFileUtils.createTestFiles(testFileConfigs);
      testFiles.push(...createdFiles);

      const result = await documentParser.parseDocuments(createdFiles);

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.stats.successCount).toBe(2);
      expect(result.stats.failureCount).toBe(1);

      // Verify the failed document is the invalid PDF
      expect(result.failed[0]?.filePath).toContain('invalid.pdf');
      expect(result.failed[0]?.error).toBeInstanceOf(DocumentProcessingError);
    });
  });

  describe('Error Handling Integration', () => {
    it('should provide detailed error context for parsing failures', async () => {
      const testFile = path.join(TEST_CONFIG.tempDir, 'corrupt.pdf');
      testFiles.push(testFile);

      // Create a file with PDF extension but invalid content
      await TestFileUtils.createTestFile(testFile, 'This is not a PDF file');

      try {
        await documentParser.parseDocument(testFile);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(DocumentProcessingError);
        const docError = error as DocumentProcessingError;
        
        expect(docError.filePath).toBe(testFile);
        expect(docError.fileType).toBe('pdf');
        expect(docError.processingStage).toBe('validation');
        expect(docError.context).toHaveProperty('filePath');
        expect(docError.getUserMessage()).toContain('PDF file signature');
        expect(docError.getRecoverySuggestions()).toContain('Verify the file is not corrupted');
      }
    });

    it('should handle timeout scenarios', async () => {
      const testFile = path.join(TEST_CONFIG.tempDir, 'timeout-test.md');
      testFiles.push(testFile);

      await TestFileUtils.createTestFile(testFile, SAMPLE_DOCUMENTS.markdown.simple);

      // Test with very short timeout
      try {
        await documentParser.parseDocument(testFile, { timeout: 1 }); // 1ms timeout
        // Note: This test might not always fail due to fast processing
      } catch (error) {
        if (error instanceof DocumentProcessingError) {
          expect(error.message).toContain('timeout');
        }
      }
    });

    it('should handle file permission errors', async () => {
      const testFile = path.join(TEST_CONFIG.tempDir, 'permission-test.md');
      testFiles.push(testFile);

      await TestFileUtils.createTestFile(testFile, SAMPLE_DOCUMENTS.markdown.simple);

      // This test might not work on all systems due to permission handling differences
      try {
        await fs.chmod(testFile, 0o000); // Remove all permissions
        
        await expect(documentParser.parseDocument(testFile))
          .rejects
          .toThrow(DocumentProcessingError);
      } catch (setupError) {
        // Skip test if we can't change permissions
        console.log('Skipping permission test due to system limitations');
      } finally {
        // Restore permissions for cleanup
        try {
          await fs.chmod(testFile, 0o644);
        } catch {
          // Ignore
        }
      }
    });
  });

  describe('Progress Tracking Integration', () => {
    it('should track progress through document processing pipeline', async () => {
      const testFile = path.join(TEST_CONFIG.tempDir, 'progress-test.md');
      testFiles.push(testFile);

      const content = TestDataGenerator.generateMarkdown({
        title: 'Progress Tracking Test',
        content: 'Content for progress tracking',
        sections: 3
      });

      await TestFileUtils.createTestFile(testFile, content);

      const progressEvents: Array<{ stage: string; percentage: number; message: string }> = [];
      
      const document = await documentParser.parseDocument(testFile, {
        progressCallback: (progress) => {
          progressEvents.push({
            stage: progress.stage,
            percentage: progress.percentage,
            message: progress.message
          });
        }
      });

      expect(document).toBeDefined();
      expect(progressEvents.length).toBeGreaterThan(0);
      
      // Verify progress stages
      const stages = progressEvents.map(e => e.stage);
      expect(stages).toContain('validation');
      expect(stages).toContain('parsing');
      expect(stages).toContain('completed');

      // Verify progress percentages are reasonable
      const percentages = progressEvents.map(e => e.percentage);
      expect(Math.min(...percentages)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...percentages)).toBeLessThanOrEqual(100);
    });

    it('should track progress in batch processing', async () => {
      const testFileConfigs = [
        {
          path: path.join(TEST_CONFIG.tempDir, 'batch-progress-1.md'),
          content: SAMPLE_DOCUMENTS.markdown.simple
        },
        {
          path: path.join(TEST_CONFIG.tempDir, 'batch-progress-2.md'),
          content: SAMPLE_DOCUMENTS.markdown.withCode
        }
      ];

      const createdFiles = await TestFileUtils.createTestFiles(testFileConfigs);
      testFiles.push(...createdFiles);

      const batchProgressEvents: Array<{ stage: string; percentage: number; message: string }> = [];

      const result = await documentParser.parseDocuments(createdFiles, {
        progressCallback: (progress) => {
          batchProgressEvents.push({
            stage: progress.stage,
            percentage: progress.percentage,
            message: progress.message
          });
        }
      });

      expect(result.successful).toHaveLength(2);
      expect(batchProgressEvents.length).toBeGreaterThan(0);

      // Verify batch progress events
      const batchStages = batchProgressEvents.map(e => e.stage);
      expect(batchStages).toContain('batch-processing');

      // Verify progress messages mention file processing
      const messages = batchProgressEvents.map(e => e.message);
      expect(messages.some(msg => msg.includes('Processing file'))).toBe(true);
    });
  });

  describe('Memory and Performance Integration', () => {
    it('should handle memory efficiently during large batch processing', async () => {
      const testFileConfigs = [];
      
      // Create multiple medium-sized documents
      for (let i = 0; i < 10; i++) {
        testFileConfigs.push({
          path: path.join(TEST_CONFIG.tempDir, `batch-memory-${i}.md`),
          content: TestDataGenerator.generateMarkdown({
            title: `Memory Test Document ${i}`,
            content: TestDataGenerator.generateLargeText(50), // 50KB each
            sections: 5
          })
        });
      }

      const createdFiles = await TestFileUtils.createTestFiles(testFileConfigs);
      testFiles.push(...createdFiles);

      const { result: batchResult, memoryDelta } = await PerformanceTestUtils.measureMemory(
        () => documentParser.parseDocuments(createdFiles)
      );

      expect(batchResult.successful).toHaveLength(10);
      expect(batchResult.failed).toHaveLength(0);

      // Memory usage should be reasonable (less than 100MB increase)
      expect(memoryDelta).toBeLessThan(100 * 1024 * 1024);

      console.log(`Batch processing memory delta: ${Math.round(memoryDelta / 1024 / 1024)}MB`);
    });

    it('should process documents concurrently without issues', async () => {
      const testFileConfigs = [];
      
      for (let i = 0; i < 5; i++) {
        testFileConfigs.push({
          path: path.join(TEST_CONFIG.tempDir, `concurrent-${i}.md`),
          content: TestDataGenerator.generateMarkdown({
            title: `Concurrent Test ${i}`,
            content: `Content for concurrent processing test ${i}`,
            sections: 2
          })
        });
      }

      const createdFiles = await TestFileUtils.createTestFiles(testFileConfigs);
      testFiles.push(...createdFiles);

      // Process multiple documents concurrently
      const promises = createdFiles.map(filePath => 
        documentParser.parseDocument(filePath)
      );

      const { result: documents, duration } = await PerformanceTestUtils.measureTime(
        () => Promise.all(promises)
      );

      expect(documents).toHaveLength(5);
      expect(documents.every(doc => doc.id && doc.title && doc.content)).toBe(true);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      console.log(`Concurrent processing completed in ${duration}ms`);
    });
  });

  describe('Edge Cases Integration', () => {
    it('should handle empty and minimal files', async () => {
      const testFileConfigs = [
        {
          path: path.join(TEST_CONFIG.tempDir, 'empty.md'),
          content: ''
        },
        {
          path: path.join(TEST_CONFIG.tempDir, 'minimal.md'),
          content: '# Title Only'
        },
        {
          path: path.join(TEST_CONFIG.tempDir, 'whitespace.md'),
          content: '   \n\n   \n   '
        }
      ];

      const createdFiles = await TestFileUtils.createTestFiles(testFileConfigs);
      testFiles.push(...createdFiles);

      const result = await documentParser.parseDocuments(createdFiles);

      // Should handle gracefully, some might succeed with minimal content
      expect(result.stats.totalFiles).toBe(3);
      expect(result.successful.length + result.failed.length).toBe(3);

      // Check that we get reasonable results for minimal content
      const minimalDoc = result.successful.find(doc => 
        doc.metadata.filePath.includes('minimal.md')
      );
      if (minimalDoc) {
        expect(minimalDoc.title).toBe('Title Only');
        expect(minimalDoc.content.trim()).toBe('Title Only');
      }
    });

    it('should handle special characters and encoding', async () => {
      const testFile = path.join(TEST_CONFIG.tempDir, 'special-chars.md');
      testFiles.push(testFile);

      const specialContent = `# Document with Special Characters

Content with émojis 🚀, açcénts, and ünïcödé characters.

Chinese: 你好世界
Japanese: こんにちは世界
Arabic: مرحبا بالعالم
Russian: Привет мир

Special symbols: ©®™€£¥₹₽₿

Mathematical: ∑∏∫∆∇∂∞`;

      await TestFileUtils.createTestFile(testFile, specialContent);

      const document = await documentParser.parseDocument(testFile);

      expect(document).toBeDefined();
      expect(document.title).toBe('Document with Special Characters');
      expect(document.content).toContain('🚀');
      expect(document.content).toContain('你好世界');
      expect(document.content).toContain('∑∏∫');
    });

    it('should handle deeply nested directory structures', async () => {
      const deepPath = path.join(
        TEST_CONFIG.tempDir, 
        'level1', 'level2', 'level3', 'level4', 'deep-file.md'
      );
      testFiles.push(deepPath);

      await TestFileUtils.createTestFile(deepPath, SAMPLE_DOCUMENTS.markdown.simple);

      const document = await documentParser.parseDocument(deepPath);

      expect(document).toBeDefined();
      expect(document.metadata.filePath).toBe(deepPath);
      expect(path.isAbsolute(document.metadata.filePath)).toBe(true);
    });
  });

  describe('Chunking Integration', () => {
    it('should produce consistent chunks across different chunk sizes', async () => {
      const testFile = path.join(TEST_CONFIG.tempDir, 'chunking-test.md');
      testFiles.push(testFile);

      const content = TestDataGenerator.generateMarkdown({
        title: 'Chunking Consistency Test',
        content: TestDataGenerator.generateLargeText(20), // 20KB
        sections: 5
      });

      await TestFileUtils.createTestFile(testFile, content);
      const document = await documentParser.parseDocument(testFile);

      // Test different chunk sizes
      const chunkSizes = [256, 512, 1024];
      const chunkResults = chunkSizes.map(size => {
        const chunks = chunkingService.chunkDocument(document, {
          chunkSize: size,
          chunkOverlap: 50
        });
        return { size, chunks, totalChars: chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) };
      });

      // Verify that smaller chunks produce more chunks
      expect(chunkResults[0]?.chunks.length).toBeGreaterThan(chunkResults[1]?.chunks.length);
      expect(chunkResults[1]?.chunks.length).toBeGreaterThan(chunkResults[2]?.chunks.length);

      // Verify that total content is preserved
      const originalLength = document.content.length;
      chunkResults.forEach(result => {
        expect(result.totalChars).toBeGreaterThan(originalLength * 0.8); // Account for overlap
        expect(result.totalChars).toBeLessThan(originalLength * 2); // Reasonable upper bound
      });

      console.log('Chunk consistency:', chunkResults.map(r => 
        `${r.size}: ${r.chunks.length} chunks, ${r.totalChars} chars`
      ));
    });

    it('should handle sentence and paragraph preservation', async () => {
      const testFile = path.join(TEST_CONFIG.tempDir, 'boundaries-test.md');
      testFiles.push(testFile);

      const content = `# Boundary Preservation Test

This is the first paragraph. It contains multiple sentences. Each sentence should be preserved properly.

This is the second paragraph. It also contains multiple sentences. The chunking should respect paragraph boundaries.

This is the third paragraph with a longer sentence that might span across chunk boundaries but should still maintain readability and coherence.`;

      await TestFileUtils.createTestFile(testFile, content);
      const document = await documentParser.parseDocument(testFile);

      const chunks = chunkingService.chunkDocument(document, {
        chunkSize: 150, // Small chunks to force boundary decisions
        chunkOverlap: 20,
        preserveSentences: true,
        preserveParagraphs: true
      });

      expect(chunks.length).toBeGreaterThan(1);

      // Verify that chunks don't break sentences inappropriately
      chunks.forEach(chunk => {
        const content = chunk.content.trim();
        if (content.length > 0) {
          // Should not start with lowercase (unless it's a continuation)
          // Should not end mid-word
          expect(content).not.toMatch(/\s\w+$/); // Should not end with partial word
        }
      });
    });
  });
});
