import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DocumentParser } from '../../src/parsers/documentParser.js';
import { ChunkingService } from '../../src/services/chunkingService.js';
import { EmbeddingService } from '../../src/services/embeddingService.js';
import { VectorDatabaseService } from '../../src/services/vectorDatabaseService.js';
import { CacheService } from '../../src/services/cacheService.js';
import { 
  TestFileUtils, 
  TestDataGenerator, 
  PerformanceTestUtils,
  TEST_CONFIG,
  SAMPLE_DOCUMENTS
} from '../setup.js';
import path from 'path';
import fs from 'fs-extra';
import { createMCPServer } from '../../src/index.js';

// Mock embedding service for E2E tests
vi.mock('../../src/services/embeddingService.js', () => {
  return {
    EmbeddingService: vi.fn().mockImplementation(() => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      generateEmbedding: vi.fn().mockImplementation((text: string) => {
        // Generate deterministic mock embeddings based on text content
        const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const embedding = Array.from({ length: 384 }, (_, i) => 
          Math.sin(hash + i) * 0.1 + Math.cos(hash * 2 + i) * 0.1
        );
        return Promise.resolve(embedding);
      }),
      generateEmbeddings: vi.fn().mockImplementation((texts: string[]) => {
        return Promise.all(texts.map(text => {
          const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const embedding = Array.from({ length: 384 }, (_, i) => 
            Math.sin(hash + i) * 0.1 + Math.cos(hash * 2 + i) * 0.1
          );
          return embedding;
        }));
      }),
      embedChunks: vi.fn().mockImplementation(async (chunks) => {
        return chunks.map((chunk: any) => ({
          ...chunk,
          embedding: Array.from({ length: 384 }, (_, i) => 
            Math.sin(chunk.content.length + i) * 0.1 + Math.cos(chunk.content.length * 2 + i) * 0.1
          )
        }));
      }),
      isReady: vi.fn().mockReturnValue(true),
      getCacheStats: vi.fn().mockReturnValue({ hitRate: 0.75, totalHits: 100, totalMisses: 33 }),
      clearCache: vi.fn(),
      dispose: vi.fn().mockResolvedValue(undefined)
    }))
  };
});

describe('Complete Workflow E2E Tests', () => {
  let documentParser: DocumentParser;
  let chunkingService: ChunkingService;
  let embeddingService: EmbeddingService;
  let vectorDatabase: VectorDatabaseService;
  let cacheService: CacheService;
  let testFiles: string[] = [];
  let tempIndexPath: string;

  beforeEach(async () => {
    // Setup temporary index directory
    tempIndexPath = path.join(TEST_CONFIG.tempDir, 'e2e-index');
    await fs.ensureDir(tempIndexPath);

    // Initialize services
    documentParser = new DocumentParser();
    chunkingService = new ChunkingService();
    embeddingService = new EmbeddingService({
      modelName: 'sentence-transformers/all-MiniLM-L6-v2',
      batchSize: 10,
      normalize: true,
      enableCache: true
    });

    vectorDatabase = new VectorDatabaseService({
      indexPath: tempIndexPath,
      embeddingDimension: 384,
      enableCache: true,
      cacheConfig: {
        maxSearchResults: 100,
        searchCacheTtl: 30000, // 30 seconds for testing
        maxCacheMemory: 10 * 1024 * 1024 // 10MB
      },
      optimizations: {
        enablePrefiltering: true,
        enableResultCaching: true,
        enableQueryRewriting: true,
        batchSize: 25
      }
    }, embeddingService);

    cacheService = new CacheService({
      maxSize: 500,
      maxMemory: 50 * 1024 * 1024, // 50MB
      defaultTtl: 30 * 60 * 1000, // 30 minutes
      cleanupInterval: 5 * 60 * 1000, // 5 minutes
      enableStats: true
    });

    // Initialize services
    await embeddingService.initialize();
    await vectorDatabase.initialize();

    testFiles = [];
  });

  afterEach(async () => {
    // Cleanup
    await TestFileUtils.cleanupFiles(testFiles);
    
    if (vectorDatabase) {
      await vectorDatabase.clear();
    }
    
    if (cacheService) {
      cacheService.destroy();
    }
    
    if (embeddingService) {
      await embeddingService.dispose();
    }

    // Clean up index directory
    try {
      await fs.remove(tempIndexPath);
    } catch (error) {
      console.warn('Failed to cleanup temp index directory:', error);
    }
  });

  describe('Complete Document Processing Pipeline', () => {
    it('should process document from file to searchable chunks', async () => {
      const testFile = path.join(TEST_CONFIG.tempDir, 'pipeline-test.md');
      testFiles.push(testFile);

      const content = TestDataGenerator.generateMarkdown({
        title: 'Complete Pipeline Test Document',
        content: `This document tests the complete processing pipeline from file ingestion to search.
        
        It contains multiple sections about artificial intelligence, machine learning, and natural language processing.
        The system should be able to parse, chunk, embed, and index this content for semantic search.
        
        Section about AI: Artificial intelligence represents the simulation of human intelligence in machines.
        These systems can learn, reason, and make decisions.
        
        Section about ML: Machine learning is a subset of AI that enables systems to learn from data.
        It includes supervised, unsupervised, and reinforcement learning approaches.
        
        Section about NLP: Natural language processing combines computational linguistics with machine learning.
        It enables computers to understand, interpret, and generate human language.`,
        frontmatter: {
          title: 'Pipeline Test',
          author: 'E2E Test Suite',
          tags: ['ai', 'ml', 'nlp'],
          category: 'technology'
        },
        sections: 4
      });

      await TestFileUtils.createTestFile(testFile, content);

      // Step 1: Parse document
      const { result: document, duration: parseDuration } = await PerformanceTestUtils.measureTime(
        () => documentParser.parseDocument(testFile)
      );

      expect(document).toBeDefined();
      expect(document.title).toBe('Pipeline Test'); // Title comes from frontmatter
      expect(document.content).toContain('artificial intelligence');
      expect(document.metadata.author).toBe('E2E Test Suite');
      expect(document.metadata.fileType).toBe('md');
      expect(parseDuration).toBeLessThan(5000);

      // Step 2: Chunk document
      const { result: chunks, duration: chunkDuration } = await PerformanceTestUtils.measureTime(
        () => chunkingService.chunkDocument(document, {
          chunkSize: 300,
          chunkOverlap: 50,
          preserveSentences: true
        })
      );

      expect(chunks.length).toBeGreaterThan(3);
      expect(chunks[0]?.documentId).toBe(document.id);
      expect(chunkDuration).toBeLessThan(2000);

      // Step 3: Generate embeddings for chunks
      const { result: embeddedChunks, duration: embedDuration } = await PerformanceTestUtils.measureTime(
        () => embeddingService.embedChunks(chunks)
      );

      expect(embeddedChunks.length).toBe(chunks.length);
      expect(embeddedChunks[0]?.embedding).toBeDefined();
      expect(embeddedChunks[0]?.embedding?.length).toBe(384);
      expect(embedDuration).toBeLessThan(3000);

      // Step 4: Index in vector database
      const { duration: indexDuration } = await PerformanceTestUtils.measureTime(
        () => vectorDatabase.addDocument(document, embeddedChunks)
      );

      expect(indexDuration).toBeLessThan(15000); // Vector index creation can take time

      // Step 5: Verify search functionality
      const searchResults = await vectorDatabase.search({
        query: 'artificial intelligence machine learning',
        maxResults: 5,
        threshold: 0.1
      });

      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults[0]?.document.id).toBe(document.id);
      expect(searchResults[0]?.score).toBeGreaterThan(0);
      expect(searchResults[0]?.relevantText).toBeDefined();

      // Verify total pipeline performance
      const totalDuration = parseDuration + chunkDuration + embedDuration + indexDuration;
      expect(totalDuration).toBeLessThan(25000); // Complete pipeline under 25 seconds

      console.log(`Complete pipeline: Parse(${parseDuration}ms) + Chunk(${chunkDuration}ms) + Embed(${embedDuration}ms) + Index(${indexDuration}ms) = ${totalDuration}ms`);
    });

    it('should handle multiple documents and cross-document search', async () => {
      const testDocuments = [
        {
          file: path.join(TEST_CONFIG.tempDir, 'doc1-ai.md'),
          content: TestDataGenerator.generateMarkdown({
            title: 'Introduction to Artificial Intelligence',
            content: `Artificial intelligence is transforming technology across industries.
            Machine learning algorithms enable computers to learn from data patterns.
            Deep learning networks can process complex information like images and text.`,
            frontmatter: { category: 'ai', difficulty: 'beginner' }
          })
        },
        {
          file: path.join(TEST_CONFIG.tempDir, 'doc2-ml.md'),
          content: TestDataGenerator.generateMarkdown({
            title: 'Machine Learning Fundamentals',
            content: `Machine learning involves training algorithms on datasets.
            Supervised learning uses labeled data for classification and regression.
            Unsupervised learning finds patterns in unlabeled data through clustering.`,
            frontmatter: { category: 'ml', difficulty: 'intermediate' }
          })
        },
        {
          file: path.join(TEST_CONFIG.tempDir, 'doc3-nlp.md'),
          content: TestDataGenerator.generateMarkdown({
            title: 'Natural Language Processing Applications',
            content: `Natural language processing enables computers to understand human language.
            Text analysis, sentiment analysis, and language translation are key applications.
            Transformer models have revolutionized NLP with attention mechanisms.`,
            frontmatter: { category: 'nlp', difficulty: 'advanced' }
          })
        }
      ];

      // Create and process all documents
      const processedDocuments = [];
      for (const { file, content } of testDocuments) {
        testFiles.push(file);
        await TestFileUtils.createTestFile(file, content);

        const document = await documentParser.parseDocument(file);
        const chunks = chunkingService.chunkDocument(document, {
          chunkSize: 200,
          chunkOverlap: 30
        });
        const embeddedChunks = await embeddingService.embedChunks(chunks);
        await vectorDatabase.addDocument(document, embeddedChunks);
        
        processedDocuments.push(document);
      }

      expect(processedDocuments.length).toBe(3);

      // Test cross-document search
      const searchQueries = [
        {
          query: 'machine learning algorithms',
          expectedCategories: ['ai', 'ml']
        },
        {
          query: 'text analysis language processing',
          expectedCategories: ['nlp']
        },
        {
          query: 'data patterns clustering',
          expectedCategories: ['ml']
        }
      ];

      for (const { query, expectedCategories } of searchQueries) {
        const results = await vectorDatabase.search({
          query,
          maxResults: 10,
          threshold: 0.1
        });

        expect(results.length).toBeGreaterThan(0);
        
        // Verify results come from expected document categories
        const resultCategories = results.map(r => r.document.metadata.category);
        const hasExpectedCategory = expectedCategories.some(cat => 
          resultCategories.includes(cat)
        );
        expect(hasExpectedCategory).toBe(true);
      }

      // Test filtering by metadata
      const filteredResults = await vectorDatabase.search({
        query: 'learning',
        maxResults: 10,
        filters: {
          fileTypes: ['md']
        }
      });

      expect(filteredResults.length).toBeGreaterThan(0);
      filteredResults.forEach(result => {
        expect(result.document.metadata.fileType).toBe('md');
      });
    });

    it('should demonstrate caching effectiveness across pipeline', async () => {
      const testFile = path.join(TEST_CONFIG.tempDir, 'cache-test.md');
      testFiles.push(testFile);

      const content = TestDataGenerator.generateMarkdown({
        title: 'Caching Effectiveness Test',
        content: 'This document tests caching effectiveness across the processing pipeline.',
        sections: 2
      });

      await TestFileUtils.createTestFile(testFile, content);

      // First processing run - everything should be cache misses
      const document = await documentParser.parseDocument(testFile);
      const chunks = chunkingService.chunkDocument(document);
      const embeddedChunks = await embeddingService.embedChunks(chunks);
      await vectorDatabase.addDocument(document, embeddedChunks);

      // First search
      const firstSearchTime = await PerformanceTestUtils.measureTime(
        () => vectorDatabase.search({ query: 'caching effectiveness test', maxResults: 5 })
      );

      // Second identical search - should hit cache
      const secondSearchTime = await PerformanceTestUtils.measureTime(
        () => vectorDatabase.search({ query: 'caching effectiveness test', maxResults: 5 })
      );

      // Cache should improve performance
      expect(secondSearchTime.duration).toBeLessThan(firstSearchTime.duration);

      // Verify cache statistics
      const searchStats = vectorDatabase.getSearchStats();
      expect(searchStats.cacheHitRate).toBeGreaterThan(0);
      expect(searchStats.totalSearches).toBeGreaterThanOrEqual(2);

      const embeddingCacheStats = embeddingService.getCacheStats();
      expect(embeddingCacheStats).toBeDefined();
      expect(embeddingCacheStats?.hitRate).toBeGreaterThanOrEqual(0);

      console.log(`Cache effectiveness: First search(${firstSearchTime.duration}ms) vs Second search(${secondSearchTime.duration}ms)`);
      console.log(`Search cache hit rate: ${(searchStats.cacheHitRate * 100).toFixed(1)}%`);
    });
  });

  describe('MCP Server Integration', () => {
    it('should handle MCP tool calls end-to-end', async () => {
      // Setup test documents
      const testFile = path.join(TEST_CONFIG.tempDir, 'mcp-test.md');
      testFiles.push(testFile);

      const content = TestDataGenerator.generateMarkdown({
        title: 'MCP Integration Test Document',
        content: `This document is used to test MCP server integration.
        It contains information about document processing, search functionality, and system capabilities.
        
        The MCP server should be able to process this document and respond to tool calls.`,
        frontmatter: {
          title: 'MCP Test',
          category: 'integration'
        }
      });

      await TestFileUtils.createTestFile(testFile, content);

      // Process document through the system
      const document = await documentParser.parseDocument(testFile);
      const chunks = chunkingService.chunkDocument(document);
      const embeddedChunks = await embeddingService.embedChunks(chunks);
      await vectorDatabase.addDocument(document, embeddedChunks);

      // Simulate MCP tool calls
      const toolCalls = [
        {
          name: 'process_document',
          arguments: { filePath: testFile }
        },
        {
          name: 'search_documents',
          arguments: { 
            query: 'MCP integration test',
            maxResults: 5
          }
        },
        {
          name: 'get_document_stats',
          arguments: {}
        }
      ];

      // Verify that each tool call would work with our processed data
      for (const toolCall of toolCalls) {
        switch (toolCall.name) {
          case 'process_document':
            // Document should already be processed
            const docs = await vectorDatabase.getDocuments();
            expect(docs.some(doc => doc.metadata.filePath === testFile)).toBe(true);
            break;

          case 'search_documents':
            const searchResults = await vectorDatabase.search({
              query: toolCall.arguments.query,
              maxResults: toolCall.arguments.maxResults
            });
            expect(searchResults.length).toBeGreaterThan(0);
            expect(searchResults[0]?.document.title).toContain('MCP Integration');
            break;

          case 'get_document_stats':
            const stats = await vectorDatabase.getStats();
            expect(stats.totalDocuments).toBeGreaterThan(0);
            expect(stats.totalChunks).toBeGreaterThan(0);
            break;
        }
      }
    });

    it('should handle concurrent MCP requests efficiently', async () => {
      // Setup multiple test documents
      const testDocuments = [];
      for (let i = 0; i < 5; i++) {
        const file = path.join(TEST_CONFIG.tempDir, `concurrent-mcp-${i}.md`);
        testFiles.push(file);
        
        const content = TestDataGenerator.generateMarkdown({
          title: `Concurrent Test Document ${i}`,
          content: `This is test document ${i} for concurrent MCP processing.`,
          sections: 2
        });
        
        await TestFileUtils.createTestFile(file, content);
        testDocuments.push({ file, content });
      }

      // Process all documents
      for (const { file } of testDocuments) {
        const document = await documentParser.parseDocument(file);
        const chunks = chunkingService.chunkDocument(document);
        const embeddedChunks = await embeddingService.embedChunks(chunks);
        await vectorDatabase.addDocument(document, embeddedChunks);
      }

      // Simulate concurrent search requests
      const concurrentSearches = Array.from({ length: 10 }, (_, i) => 
        vectorDatabase.search({
          query: `concurrent test document ${i % 5}`,
          maxResults: 3
        })
      );

      const { result: searchResults, duration } = await PerformanceTestUtils.measureTime(
        () => Promise.all(concurrentSearches)
      );

      expect(searchResults.length).toBe(10);
      expect(searchResults.every(results => results.length > 0)).toBe(true);
      expect(duration).toBeLessThan(10000); // All searches under 10 seconds

      // Verify cache effectiveness under concurrent load
      const finalStats = vectorDatabase.getSearchStats();
      expect(finalStats.totalSearches).toBeGreaterThanOrEqual(10);
      
      console.log(`Concurrent searches: ${searchResults.length} requests in ${duration}ms`);
      console.log(`Cache hit rate under load: ${(finalStats.cacheHitRate * 100).toFixed(1)}%`);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover gracefully from processing errors', async () => {
      const testFileConfigs = [
        {
          path: path.join(TEST_CONFIG.tempDir, 'valid-doc.md'),
          content: SAMPLE_DOCUMENTS.markdown.simple,
          shouldSucceed: true
        },
        {
          path: path.join(TEST_CONFIG.tempDir, 'invalid-doc.pdf'),
          content: 'Not a valid PDF file',
          shouldSucceed: false
        },
        {
          path: path.join(TEST_CONFIG.tempDir, 'another-valid.md'),
          content: SAMPLE_DOCUMENTS.markdown.withCode,
          shouldSucceed: true
        }
      ];

      const processedFiles = [];
      const errors = [];

      for (const { path: filePath, content, shouldSucceed } of testFileConfigs) {
        testFiles.push(filePath);
        await TestFileUtils.createTestFile(filePath, content);

        try {
          const document = await documentParser.parseDocument(filePath);
          const chunks = chunkingService.chunkDocument(document);
          const embeddedChunks = await embeddingService.embedChunks(chunks);
          await vectorDatabase.addDocument(document, embeddedChunks);
          processedFiles.push(filePath);
        } catch (error) {
          errors.push({ filePath, error });
        }
      }

      // Should have processed valid files despite errors
      expect(processedFiles.length).toBe(2);
      expect(errors.length).toBe(1);
      expect(errors[0]?.filePath).toContain('invalid-doc.pdf');

      // Search should still work with successfully processed documents
      const searchResults = await vectorDatabase.search({
        query: 'test content',
        maxResults: 10
      });

      expect(searchResults.length).toBeGreaterThan(0);
      
      // Verify system statistics reflect partial success
      const stats = await vectorDatabase.getStats();
      expect(stats.totalDocuments).toBe(2);
    });

    it('should handle memory pressure gracefully', async () => {
      // Create a scenario with high memory usage
      const largeDocuments = [];
      
      for (let i = 0; i < 3; i++) {
        const file = path.join(TEST_CONFIG.tempDir, `large-memory-${i}.md`);
        testFiles.push(file);
        
        const content = TestDataGenerator.generateMarkdown({
          title: `Large Memory Test ${i}`,
          content: TestDataGenerator.generateLargeText(100), // 100KB each
          sections: 10
        });
        
        await TestFileUtils.createTestFile(file, content);
        largeDocuments.push(file);
      }

      // Process documents and monitor memory usage
      const { memoryDelta } = await PerformanceTestUtils.measureMemory(async () => {
        for (const file of largeDocuments) {
          const document = await documentParser.parseDocument(file);
          const chunks = chunkingService.chunkDocument(document, {
            chunkSize: 256,
            chunkOverlap: 50
          });
          const embeddedChunks = await embeddingService.embedChunks(chunks);
          await vectorDatabase.addDocument(document, embeddedChunks);
        }
      });

      // Memory usage should be reasonable (less than 200MB increase)
      expect(memoryDelta).toBeLessThan(200 * 1024 * 1024);

      // System should still be responsive
      const searchResults = await vectorDatabase.search({
        query: 'large memory test',
        maxResults: 5
      });

      expect(searchResults.length).toBeGreaterThan(0);

      // Cache should help with memory efficiency
      const cacheStats = vectorDatabase.getSearchStats().cacheStats;
      expect(cacheStats).toBeDefined();

      console.log(`Memory usage for large documents: ${Math.round(memoryDelta / 1024 / 1024)}MB`);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance targets for typical workloads', async () => {
      const benchmarkFiles = [];
      
      // Create typical document sizes
      for (let i = 0; i < 10; i++) {
        const file = path.join(TEST_CONFIG.tempDir, `benchmark-${i}.md`);
        testFiles.push(file);
        
        const content = TestDataGenerator.generateMarkdown({
          title: `Benchmark Document ${i}`,
          content: TestDataGenerator.generateLargeText(10), // 10KB each (typical size)
          sections: 3
        });
        
        await TestFileUtils.createTestFile(file, content);
        benchmarkFiles.push(file);
      }

      // Benchmark full processing pipeline
      const { duration: processingTime } = await PerformanceTestUtils.measureTime(async () => {
        for (const file of benchmarkFiles) {
          const document = await documentParser.parseDocument(file);
          const chunks = chunkingService.chunkDocument(document);
          const embeddedChunks = await embeddingService.embedChunks(chunks);
          await vectorDatabase.addDocument(document, embeddedChunks);
        }
      });

      // Benchmark search performance
      const searchQueries = [
        'benchmark document test',
        'performance evaluation content',
        'typical workload processing',
        'system capability testing',
        'processing pipeline benchmark'
      ];

      const { duration: searchTime } = await PerformanceTestUtils.measureTime(async () => {
        for (const query of searchQueries) {
          await vectorDatabase.search({ query, maxResults: 5 });
        }
      });

      // Performance targets
      expect(processingTime).toBeLessThan(30000); // 30 seconds for 10 documents
      expect(searchTime).toBeLessThan(2000); // 2 seconds for 5 searches
      expect(processingTime / benchmarkFiles.length).toBeLessThan(3000); // 3 seconds per document

      const avgSearchTime = searchTime / searchQueries.length;
      expect(avgSearchTime).toBeLessThan(500); // 500ms per search

      console.log(`Performance benchmark:`);
      console.log(`  Processing: ${processingTime}ms for ${benchmarkFiles.length} documents (${Math.round(processingTime / benchmarkFiles.length)}ms/doc)`);
      console.log(`  Search: ${searchTime}ms for ${searchQueries.length} queries (${Math.round(avgSearchTime)}ms/query)`);
    });
  });
});