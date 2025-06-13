import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from 'fs-extra';
import { VectorDatabaseService } from '../../src/services/vectorDatabaseService';
import { EmbeddingService } from '../../src/services/embeddingService';
import { Document, DocumentChunk, SearchQuery, VectorDatabaseError } from '../../src/types';
import { generateId } from '../../src/utils/helpers';
import { testPaths } from '../setup';

// Mock Vectra
vi.mock('vectra', () => ({
  LocalIndex: vi.fn()
}));

// Mock EmbeddingService
vi.mock('../../src/services/embeddingService');

describe('VectorDatabaseService', () => {
  let vectorDbService: VectorDatabaseService;
  let mockEmbeddingService: vi.Mocked<EmbeddingService>;
  let mockLocalIndex: any;
  let sampleDocument: Document;
  let sampleChunk: DocumentChunk;

  beforeEach(() => {
    // Setup mock LocalIndex
    const { LocalIndex } = require('vectra');
    mockLocalIndex = {
      isIndexCreated: vi.fn(),
      createIndex: vi.fn(),
      insertItem: vi.fn(),
      queryItems: vi.fn(),
      deleteItem: vi.fn(),
      listItems: vi.fn(),
      getItem: vi.fn()
    };
    LocalIndex.mockImplementation(() => mockLocalIndex);

    // Setup mock EmbeddingService
    mockEmbeddingService = {
      initialize: vi.fn(),
      embedChunk: vi.fn(),
      embedChunks: vi.fn(),
      embedText: vi.fn()
    } as any;

    vectorDbService = new VectorDatabaseService(
      {
        indexPath: testPaths.vectorDbDir,
        embeddingDimension: 384
      },
      mockEmbeddingService
    );

    sampleDocument = {
      id: generateId(),
      title: 'Test Document',
      content: 'This is a test document content.',
      metadata: {
        filePath: '/test/document.md',
        fileType: 'md',
        createdAt: new Date(),
        lastModified: new Date(),
        fileSize: 100
      },
      chunks: []
    };

    sampleChunk = {
      id: generateId(),
      documentId: sampleDocument.id,
      content: 'This is a sample chunk of text.',
      startIndex: 0,
      endIndex: 31,
      embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
      metadata: {
        chunkIndex: 0
      }
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize the vector database', async () => {
      mockLocalIndex.isIndexCreated.mockResolvedValue(false);
      mockLocalIndex.createIndex.mockResolvedValue(undefined);
      
      await vectorDbService.initialize();
      
      expect(mockLocalIndex.isIndexCreated).toHaveBeenCalled();
      expect(mockLocalIndex.createIndex).toHaveBeenCalled();
    });

    it('should load existing index if it exists', async () => {
      mockLocalIndex.isIndexCreated.mockResolvedValue(true);
      mockLocalIndex.listItems.mockResolvedValue([]);
      
      await vectorDbService.initialize();
      
      expect(mockLocalIndex.isIndexCreated).toHaveBeenCalled();
      expect(mockLocalIndex.createIndex).not.toHaveBeenCalled();
      expect(mockLocalIndex.listItems).toHaveBeenCalled();
    });

    it('should only initialize once', async () => {
      mockLocalIndex.isIndexCreated.mockResolvedValue(false);
      mockLocalIndex.createIndex.mockResolvedValue(undefined);
      
      await vectorDbService.initialize();
      await vectorDbService.initialize();
      
      expect(mockLocalIndex.createIndex).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors', async () => {
      mockLocalIndex.isIndexCreated.mockRejectedValue(new Error('Index error'));
      
      await expect(vectorDbService.initialize())
        .rejects
        .toThrow(VectorDatabaseError);
    });
  });

  describe('addDocument', () => {
    beforeEach(async () => {
      mockLocalIndex.isIndexCreated.mockResolvedValue(true);
      mockLocalIndex.listItems.mockResolvedValue([]);
      await vectorDbService.initialize();
    });

    it('should add a document with its chunks', async () => {
      const documentWithChunks = {
        ...sampleDocument,
        chunks: [sampleChunk]
      };
      
      mockLocalIndex.insertItem.mockResolvedValue(undefined);
      
      await vectorDbService.addDocument(documentWithChunks);
      
      expect(mockLocalIndex.insertItem).toHaveBeenCalledWith({
        id: sampleChunk.id,
        documentId: sampleDocument.id,
        content: sampleChunk.content,
        metadata: expect.objectContaining({
          chunkIndex: 0,
          documentTitle: sampleDocument.title,
          documentPath: sampleDocument.metadata.filePath
        }),
        vector: sampleChunk.embedding
      });
    });

    it('should handle documents without embeddings', async () => {
      const chunkWithoutEmbedding = {
        ...sampleChunk,
        embedding: undefined
      };
      
      const documentWithChunks = {
        ...sampleDocument,
        chunks: [chunkWithoutEmbedding]
      };
      
      mockEmbeddingService.embedChunk.mockResolvedValue({
        ...chunkWithoutEmbedding,
        embedding: [0.1, 0.2, 0.3]
      });
      
      mockLocalIndex.insertItem.mockResolvedValue(undefined);
      
      await vectorDbService.addDocument(documentWithChunks);
      
      expect(mockEmbeddingService.embedChunk).toHaveBeenCalledWith(chunkWithoutEmbedding);
      expect(mockLocalIndex.insertItem).toHaveBeenCalled();
    });

    it('should handle empty chunks array', async () => {
      const documentWithoutChunks = {
        ...sampleDocument,
        chunks: []
      };
      
      await vectorDbService.addDocument(documentWithoutChunks);
      
      expect(mockLocalIndex.insertItem).not.toHaveBeenCalled();
    });

    it('should handle insertion errors', async () => {
      const documentWithChunks = {
        ...sampleDocument,
        chunks: [sampleChunk]
      };
      
      mockLocalIndex.insertItem.mockRejectedValue(new Error('Insert error'));
      
      await expect(vectorDbService.addDocument(documentWithChunks))
        .rejects
        .toThrow(VectorDatabaseError);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      mockLocalIndex.isIndexCreated.mockResolvedValue(true);
      mockLocalIndex.listItems.mockResolvedValue([]);
      await vectorDbService.initialize();
    });

    it('should perform semantic search', async () => {
      const searchQuery: SearchQuery = {
        query: 'test query',
        maxResults: 5,
        threshold: 0.7
      };
      
      const mockQueryEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      mockEmbeddingService.embedText.mockResolvedValue(mockQueryEmbedding);
      
      const mockSearchResults = [
        {
          item: {
            id: sampleChunk.id,
            documentId: sampleDocument.id,
            content: sampleChunk.content,
            metadata: {
              chunkIndex: 0,
              documentTitle: sampleDocument.title
            }
          },
          score: 0.85
        }
      ];
      
      mockLocalIndex.queryItems.mockResolvedValue(mockSearchResults);
      
      const results = await vectorDbService.search(searchQuery);
      
      expect(mockEmbeddingService.embedText).toHaveBeenCalledWith(searchQuery.query);
      expect(mockLocalIndex.queryItems).toHaveBeenCalledWith(
        mockQueryEmbedding,
        searchQuery.maxResults
      );
      expect(results).toBeDefined();
      expect(results.length).toBe(1);
      expect(results[0].score).toBe(0.85);
      expect(results[0].chunk.id).toBe(sampleChunk.id);
    });

    it('should filter results by threshold', async () => {
      const searchQuery: SearchQuery = {
        query: 'test query',
        maxResults: 5,
        threshold: 0.9
      };
      
      mockEmbeddingService.embedText.mockResolvedValue([0.1, 0.2, 0.3]);
      
      const mockSearchResults = [
        {
          item: { id: '1', content: 'content1' },
          score: 0.95 // Above threshold
        },
        {
          item: { id: '2', content: 'content2' },
          score: 0.85 // Below threshold
        }
      ];
      
      mockLocalIndex.queryItems.mockResolvedValue(mockSearchResults);
      
      const results = await vectorDbService.search(searchQuery);
      
      expect(results.length).toBe(1);
      expect(results[0].score).toBe(0.95);
    });

    it('should handle empty search results', async () => {
      const searchQuery: SearchQuery = {
        query: 'no matches',
        maxResults: 5
      };
      
      mockEmbeddingService.embedText.mockResolvedValue([0.1, 0.2, 0.3]);
      mockLocalIndex.queryItems.mockResolvedValue([]);
      
      const results = await vectorDbService.search(searchQuery);
      
      expect(results).toBeDefined();
      expect(results.length).toBe(0);
    });

    it('should handle search errors', async () => {
      const searchQuery: SearchQuery = {
        query: 'test query',
        maxResults: 5
      };
      
      mockEmbeddingService.embedText.mockRejectedValue(new Error('Embedding error'));
      
      await expect(vectorDbService.search(searchQuery))
        .rejects
        .toThrow(VectorDatabaseError);
    });
  });

  describe('removeDocument', () => {
    beforeEach(async () => {
      mockLocalIndex.isIndexCreated.mockResolvedValue(true);
      mockLocalIndex.listItems.mockResolvedValue([]);
      await vectorDbService.initialize();
    });

    it('should remove document and its chunks', async () => {
      mockLocalIndex.listItems.mockResolvedValue([
        {
          id: sampleChunk.id,
          metadata: { documentId: sampleDocument.id }
        }
      ]);
      
      mockLocalIndex.deleteItem.mockResolvedValue(undefined);
      
      await vectorDbService.removeDocument(sampleDocument.id);
      
      expect(mockLocalIndex.deleteItem).toHaveBeenCalledWith(sampleChunk.id);
    });

    it('should handle removal errors', async () => {
      mockLocalIndex.listItems.mockResolvedValue([
        {
          id: sampleChunk.id,
          metadata: { documentId: sampleDocument.id }
        }
      ]);
      
      mockLocalIndex.deleteItem.mockRejectedValue(new Error('Delete error'));
      
      await expect(vectorDbService.removeDocument(sampleDocument.id))
        .rejects
        .toThrow(VectorDatabaseError);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      mockLocalIndex.isIndexCreated.mockResolvedValue(true);
      mockLocalIndex.listItems.mockResolvedValue([]);
      await vectorDbService.initialize();
    });

    it('should return database statistics', async () => {
      mockLocalIndex.listItems.mockResolvedValue([
        { id: '1', metadata: { documentId: 'doc1' } },
        { id: '2', metadata: { documentId: 'doc1' } },
        { id: '3', metadata: { documentId: 'doc2' } }
      ]);
      
      const stats = await vectorDbService.getStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalDocuments).toBe(2);
      expect(stats.totalChunks).toBe(3);
      expect(stats.indexPath).toBe(testPaths.vectorDbDir);
    });
  });

  describe('clear', () => {
    beforeEach(async () => {
      mockLocalIndex.isIndexCreated.mockResolvedValue(true);
      mockLocalIndex.listItems.mockResolvedValue([]);
      await vectorDbService.initialize();
    });

    it('should clear all data from the database', async () => {
      mockLocalIndex.listItems.mockResolvedValue([
        { id: '1' },
        { id: '2' }
      ]);
      
      mockLocalIndex.deleteItem.mockResolvedValue(undefined);
      
      await vectorDbService.clear();
      
      expect(mockLocalIndex.deleteItem).toHaveBeenCalledTimes(2);
      expect(mockLocalIndex.deleteItem).toHaveBeenCalledWith('1');
      expect(mockLocalIndex.deleteItem).toHaveBeenCalledWith('2');
    });
  });
});