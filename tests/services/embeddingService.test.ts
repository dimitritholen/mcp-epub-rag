import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EmbeddingService } from '../../src/services/embeddingService';
import { DocumentChunk, EmbeddingError } from '../../src/types';
import { generateId } from '../../src/utils/helpers';

// Mock the transformers pipeline (ESM-compatible)
vi.mock('@xenova/transformers', () => ({
  default: {
    pipeline: vi.fn()
  }
}));

describe('EmbeddingService', () => {
  let embeddingService: EmbeddingService;
  let mockPipeline: vi.Mock;
  let sampleChunk: DocumentChunk;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup mock pipeline
    const { pipeline } = (await import('@xenova/transformers')).default;
    mockPipeline = vi.fn();
    pipeline.mockResolvedValue(mockPipeline);
    
    // Mock pipeline to return fake embeddings
    mockPipeline.mockResolvedValue({
      data: new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5])
    });
    
    embeddingService = new EmbeddingService({
      modelName: 'Xenova/all-MiniLM-L6-v2',
      batchSize: 10,
      normalize: true
    });
    
    sampleChunk = {
      id: generateId(),
      documentId: generateId(),
      content: 'This is a sample chunk of text for testing embeddings.',
      startIndex: 0,
      endIndex: 55,
      metadata: {
        chunkIndex: 0
      }
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize the embedding model', async () => {
      await embeddingService.initialize();
      
      const { pipeline } = require('@xenova/transformers');
      expect(pipeline).toHaveBeenCalledWith(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        expect.objectContaining({
          quantized: true
        })
      );
    });

    it('should only initialize once', async () => {
      await embeddingService.initialize();
      await embeddingService.initialize();
      
      const { pipeline } = require('@xenova/transformers');
      expect(pipeline).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors', async () => {
      const { pipeline } = require('@xenova/transformers');
      pipeline.mockRejectedValue(new Error('Model loading failed'));
      
      await expect(embeddingService.initialize())
        .rejects
        .toThrow(EmbeddingError);
    });
  });

  describe('embedChunk', () => {
    beforeEach(async () => {
      await embeddingService.initialize();
    });

    it('should generate embeddings for a chunk', async () => {
      const result = await embeddingService.embedChunk(sampleChunk);
      
      expect(result).toBeDefined();
      expect(result.id).toBe(sampleChunk.id);
      expect(result.embedding).toBeDefined();
      expect(Array.isArray(result.embedding)).toBe(true);
      expect(result.embedding!.length).toBeGreaterThan(0);
    });

    it('should call the pipeline with chunk content', async () => {
      await embeddingService.embedChunk(sampleChunk);
      
      expect(mockPipeline).toHaveBeenCalledWith(sampleChunk.content);
    });

    it('should handle empty content', async () => {
      const emptyChunk = {
        ...sampleChunk,
        content: ''
      };
      
      const result = await embeddingService.embedChunk(emptyChunk);
      
      expect(result).toBeDefined();
      expect(result.embedding).toBeDefined();
    });

    it('should handle very long content', async () => {
      const longChunk = {
        ...sampleChunk,
        content: 'This is a very long text. '.repeat(1000)
      };
      
      const result = await embeddingService.embedChunk(longChunk);
      
      expect(result).toBeDefined();
      expect(result.embedding).toBeDefined();
    });

    it('should handle pipeline errors', async () => {
      mockPipeline.mockRejectedValue(new Error('Pipeline error'));
      
      await expect(embeddingService.embedChunk(sampleChunk))
        .rejects
        .toThrow(EmbeddingError);
    });

    it('should normalize embeddings when enabled', async () => {
      const result = await embeddingService.embedChunk(sampleChunk);
      
      expect(result.embedding).toBeDefined();
      
      // Check if embeddings are normalized (magnitude should be close to 1)
      const magnitude = Math.sqrt(
        result.embedding!.reduce((sum, val) => sum + val * val, 0)
      );
      expect(magnitude).toBeCloseTo(1, 1);
    });
  });

  describe('embedChunks', () => {
    beforeEach(async () => {
      await embeddingService.initialize();
    });

    it('should process multiple chunks', async () => {
      const chunks = [
        sampleChunk,
        {
          ...sampleChunk,
          id: generateId(),
          content: 'Another chunk of text for testing.'
        },
        {
          ...sampleChunk,
          id: generateId(),
          content: 'A third chunk with different content.'
        }
      ];
      
      const results = await embeddingService.embedChunks(chunks);
      
      expect(results).toBeDefined();
      expect(results.length).toBe(chunks.length);
      
      results.forEach((result, index) => {
        expect(result.id).toBe(chunks[index].id);
        expect(result.embedding).toBeDefined();
        expect(Array.isArray(result.embedding)).toBe(true);
      });
    });

    it('should handle empty array', async () => {
      const results = await embeddingService.embedChunks([]);
      
      expect(results).toBeDefined();
      expect(results.length).toBe(0);
    });

    it('should process chunks in batches', async () => {
      const embeddingServiceSmallBatch = new EmbeddingService({
        modelName: 'Xenova/all-MiniLM-L6-v2',
        batchSize: 2,
        normalize: true
      });
      
      await embeddingServiceSmallBatch.initialize();
      
      const chunks = Array.from({ length: 5 }, (_, i) => ({
        ...sampleChunk,
        id: generateId(),
        content: `Chunk ${i} content`
      }));
      
      const results = await embeddingServiceSmallBatch.embedChunks(chunks);
      
      expect(results.length).toBe(5);
      // Should have been called multiple times due to batching
      expect(mockPipeline).toHaveBeenCalledTimes(5);
    });

    it('should handle partial failures gracefully', async () => {
      const chunks = [
        sampleChunk,
        {
          ...sampleChunk,
          id: generateId(),
          content: 'Good chunk'
        }
      ];
      
      // Mock pipeline to fail on second call
      mockPipeline
        .mockResolvedValueOnce({ data: new Float32Array([0.1, 0.2, 0.3]) })
        .mockRejectedValueOnce(new Error('Pipeline error'));
      
      await expect(embeddingService.embedChunks(chunks))
        .rejects
        .toThrow(EmbeddingError);
    });
  });

  describe('error handling', () => {
    it('should throw EmbeddingError when not initialized', async () => {
      const uninitializedService = new EmbeddingService({
        modelName: 'test-model',
        batchSize: 10,
        normalize: true
      });
      
      await expect(uninitializedService.embedChunk(sampleChunk))
        .rejects
        .toThrow(EmbeddingError);
    });

    it('should include original error in EmbeddingError', async () => {
      const { pipeline } = require('@xenova/transformers');
      const originalError = new Error('Original error message');
      pipeline.mockRejectedValue(originalError);
      
      try {
        await embeddingService.initialize();
      } catch (error) {
        expect(error).toBeInstanceOf(EmbeddingError);
        expect((error as EmbeddingError).cause).toBe(originalError);
      }
    });
  });
});