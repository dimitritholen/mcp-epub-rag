import { pipeline, Pipeline } from '@xenova/transformers';
import { DocumentChunk, EmbeddingError } from '../types.js';

export interface EmbeddingOptions {
  modelName: string;
  batchSize: number;
  normalize: boolean;
}

export class EmbeddingService {
  private pipeline: any | null = null;
  private modelName: string;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(private options: EmbeddingOptions) {
    this.modelName = options.modelName;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.doInitialize();
    return this.initializationPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      console.log(`Initializing embedding model: ${this.modelName}`);
      
      // Create the feature extraction pipeline
      this.pipeline = await pipeline('feature-extraction', this.modelName, {
        quantized: true, // Use quantized model for better performance
        progress_callback: (progress: any) => {
          if (progress.status === 'downloading') {
            console.log(`Downloading model: ${Math.round(progress.progress * 100)}%`);
          }
        }
      });
      
      this.isInitialized = true;
      console.log('Embedding model initialized successfully');
    } catch (error) {
      this.initializationPromise = null;
      throw new EmbeddingError(
        `Failed to initialize embedding model: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    await this.initialize();
    
    if (!this.pipeline) {
      throw new EmbeddingError('Embedding pipeline not initialized');
    }

    try {
      // Clean and prepare text
      const cleanText = this.preprocessText(text);
      
      if (cleanText.length === 0) {
        throw new EmbeddingError('Empty text provided for embedding');
      }

      // Generate embedding
      const result = await this.pipeline(cleanText, {
        pooling: 'mean',
        normalize: this.options.normalize
      });

      // Extract the embedding array
      let embedding: number[];
      if (Array.isArray(result)) {
        embedding = result;
      } else if (result.data) {
        embedding = Array.from(result.data);
      } else {
        throw new EmbeddingError('Unexpected embedding result format');
      }

      if (embedding.length === 0) {
        throw new EmbeddingError('Generated embedding is empty');
      }

      return embedding;
    } catch (error) {
      throw new EmbeddingError(
        `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    await this.initialize();
    
    if (!this.pipeline) {
      throw new EmbeddingError('Embedding pipeline not initialized');
    }

    const embeddings: number[][] = [];
    const batchSize = this.options.batchSize;

    // Process in batches to avoid memory issues
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchEmbeddings = await Promise.all(
        batch.map(text => this.generateEmbedding(text))
      );
      embeddings.push(...batchEmbeddings);
      
      // Log progress for large batches
      if (texts.length > 10) {
        const progress = Math.min(i + batchSize, texts.length);
        console.log(`Generated embeddings: ${progress}/${texts.length}`);
      }
    }

    return embeddings;
  }

  async embedChunks(chunks: DocumentChunk[]): Promise<DocumentChunk[]> {
    if (chunks.length === 0) {
      return chunks;
    }

    console.log(`Generating embeddings for ${chunks.length} chunks...`);
    
    try {
      const texts = chunks.map(chunk => chunk.content);
      const embeddings = await this.generateEmbeddings(texts);
      
      // Add embeddings to chunks
      const embeddedChunks = chunks.map((chunk, index) => ({
        ...chunk,
        embedding: embeddings[index]
      }));

      console.log('Embeddings generated successfully');
      return embeddedChunks;
    } catch (error) {
      throw new EmbeddingError(
        `Failed to embed chunks: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  private preprocessText(text: string): string {
    // Clean and normalize text for better embeddings
    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[\r\n]+/g, ' ') // Replace line breaks with spaces
      .substring(0, 512); // Limit length to model's max input size
  }

  // Calculate cosine similarity between two embeddings
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      const aVal = a[i];
      const bVal = b[i];
      if (aVal !== undefined && bVal !== undefined) {
        dotProduct += aVal * bVal;
        normA += aVal * aVal;
        normB += bVal * bVal;
      }
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  // Get embedding dimension
  async getEmbeddingDimension(): Promise<number> {
    const testEmbedding = await this.generateEmbedding('test');
    return testEmbedding.length;
  }

  // Check if the service is ready
  isReady(): boolean {
    return this.isInitialized && this.pipeline !== null;
  }

  // Get model information
  getModelInfo(): { name: string; isInitialized: boolean } {
    return {
      name: this.modelName,
      isInitialized: this.isInitialized
    };
  }

  // Cleanup resources
  async dispose(): Promise<void> {
    if (this.pipeline) {
      // Note: @xenova/transformers doesn't have explicit cleanup methods
      // The models will be garbage collected when no longer referenced
      this.pipeline = null;
    }
    this.isInitialized = false;
    this.initializationPromise = null;
  }
}