import { LocalIndex } from 'vectra';
import fs from 'fs-extra';
import path from 'path';
import { DocumentChunk, SearchQuery, SearchResult, Document, VectorDatabaseError } from '../types.js';
import { EmbeddingService } from './embeddingService.js';

export interface VectorDatabaseOptions {
  indexPath: string;
  embeddingDimension?: number;
}

export interface IndexedChunk {
  id: string;
  documentId: string;
  content: string;
  metadata: any;
  vector: number[];
}

export class VectorDatabaseService {
  private index: LocalIndex | null = null;
  private isInitialized = false;
  private documents: Map<string, Document> = new Map();
  private chunks: Map<string, DocumentChunk> = new Map();

  constructor(
    private options: VectorDatabaseOptions,
    private embeddingService: EmbeddingService
  ) {}

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Ensure the index directory exists
      await fs.ensureDir(this.options.indexPath);

      // Initialize or load existing index
      this.index = new LocalIndex(this.options.indexPath);
      
      // Check if index exists and load it
      const indexExists = await this.indexExists();
      if (indexExists) {
        console.log('Loading existing vector index...');
        await this.loadExistingData();
      } else {
        console.log('Creating new vector index...');
        // The index will be created when we add the first item
      }

      this.isInitialized = true;
      console.log('Vector database initialized successfully');
    } catch (error) {
      throw new VectorDatabaseError(
        `Failed to initialize vector database: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  private async indexExists(): Promise<boolean> {
    try {
      const indexFile = path.join(this.options.indexPath, 'index.json');
      return await fs.pathExists(indexFile);
    } catch {
      return false;
    }
  }

  private async loadExistingData(): Promise<void> {
    try {
      // Load documents and chunks metadata
      const metadataPath = path.join(this.options.indexPath, 'metadata.json');
      if (await fs.pathExists(metadataPath)) {
        const metadata = await fs.readJson(metadataPath);
        
        // Restore documents map
        if (metadata.documents) {
          for (const [id, doc] of Object.entries(metadata.documents)) {
            this.documents.set(id, doc as Document);
          }
        }
        
        // Restore chunks map
        if (metadata.chunks) {
          for (const [id, chunk] of Object.entries(metadata.chunks)) {
            this.chunks.set(id, chunk as DocumentChunk);
          }
        }
        
        console.log(`Loaded ${this.documents.size} documents and ${this.chunks.size} chunks`);
      }
    } catch (error) {
      console.warn('Failed to load existing metadata, starting fresh:', error);
      this.documents.clear();
      this.chunks.clear();
    }
  }

  private async saveMetadata(): Promise<void> {
    try {
      const metadataPath = path.join(this.options.indexPath, 'metadata.json');
      const metadata = {
        documents: Object.fromEntries(this.documents),
        chunks: Object.fromEntries(this.chunks),
        lastUpdated: new Date().toISOString()
      };
      
      await fs.writeJson(metadataPath, metadata, { spaces: 2 });
    } catch (error) {
      console.error('Failed to save metadata:', error);
    }
  }

  async addDocument(document: Document, chunks: DocumentChunk[]): Promise<void> {
    if (!this.isInitialized || !this.index) {
      throw new VectorDatabaseError('Vector database not initialized');
    }

    try {
      console.log(`Adding document: ${document.title} with ${chunks.length} chunks`);
      
      // Store document
      this.documents.set(document.id, document);
      
      // Add chunks to index
      for (const chunk of chunks) {
        if (!chunk.embedding) {
          throw new VectorDatabaseError(`Chunk ${chunk.id} missing embedding`);
        }
        
        // Store chunk metadata
        this.chunks.set(chunk.id, chunk);
        
        // Add to vector index
        await this.index.insertItem({
          id: chunk.id,
          vector: chunk.embedding,
          metadata: {
            documentId: chunk.documentId,
            content: chunk.content,
            startIndex: chunk.startIndex,
            endIndex: chunk.endIndex,
            chunkMetadata: chunk.metadata
          }
        });
      }
      
      // Save metadata to disk
      await this.saveMetadata();
      
      console.log(`Successfully added document: ${document.title}`);
    } catch (error) {
      throw new VectorDatabaseError(
        `Failed to add document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async removeDocument(documentId: string): Promise<void> {
    if (!this.isInitialized || !this.index) {
      throw new VectorDatabaseError('Vector database not initialized');
    }

    try {
      // Find all chunks for this document
      const chunksToRemove = Array.from(this.chunks.values())
        .filter(chunk => chunk.documentId === documentId);
      
      // Remove chunks from index
      for (const chunk of chunksToRemove) {
        await this.index.deleteItem(chunk.id);
        this.chunks.delete(chunk.id);
      }
      
      // Remove document
      this.documents.delete(documentId);
      
      // Save metadata
      await this.saveMetadata();
      
      console.log(`Removed document ${documentId} and ${chunksToRemove.length} chunks`);
    } catch (error) {
      throw new VectorDatabaseError(
        `Failed to remove document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    if (!this.isInitialized || !this.index) {
      throw new VectorDatabaseError('Vector database not initialized');
    }

    try {
      // Generate embedding for query
      const queryEmbedding = await this.embeddingService.generateEmbedding(query.query);
      
      // Search the index
      const searchResults = await this.index.queryItems(queryEmbedding, query.maxResults || 10);
      
      // Convert to SearchResult format
      const results: SearchResult[] = [];
      
      for (const result of searchResults) {
        const chunk = this.chunks.get(result.item.id);
        const document = chunk ? this.documents.get(chunk.documentId) : null;
        
        if (chunk && document) {
          // Apply filters if specified
          if (this.passesFilters(document, chunk, query.filters)) {
            // Apply threshold filter
            if (!query.threshold || result.score >= query.threshold) {
              results.push({
                chunk,
                document,
                score: result.score,
                relevantText: this.extractRelevantText(chunk.content, query.query)
              });
            }
          }
        }
      }
      
      return results.sort((a, b) => b.score - a.score);
    } catch (error) {
      throw new VectorDatabaseError(
        `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  private passesFilters(document: Document, chunk: DocumentChunk, filters?: any): boolean {
    if (!filters) return true;
    
    // File type filter
    if (filters.fileTypes && filters.fileTypes.length > 0) {
      if (!filters.fileTypes.includes(document.metadata.fileType)) {
        return false;
      }
    }
    
    // Author filter
    if (filters.authors && filters.authors.length > 0) {
      if (!document.metadata.author || !filters.authors.includes(document.metadata.author)) {
        return false;
      }
    }
    
    // Date range filter
    if (filters.dateRange) {
      const docDate = document.metadata.lastModified;
      if (filters.dateRange.start && docDate < filters.dateRange.start) {
        return false;
      }
      if (filters.dateRange.end && docDate > filters.dateRange.end) {
        return false;
      }
    }
    
    return true;
  }

  private extractRelevantText(content: string, query: string): string {
    // Simple relevance extraction - could be improved with more sophisticated algorithms
    const queryWords = query.toLowerCase().split(/\s+/);
    const sentences = content.split(/[.!?]+/);
    
    // Find sentences containing query words
    const relevantSentences = sentences.filter(sentence => {
      const lowerSentence = sentence.toLowerCase();
      return queryWords.some(word => lowerSentence.includes(word));
    });
    
    if (relevantSentences.length > 0) {
      return relevantSentences.slice(0, 2).join('. ').trim() + '.';
    }
    
    // Fallback to first part of content
    return content.substring(0, 200) + (content.length > 200 ? '...' : '');
  }

  async getDocuments(): Promise<Document[]> {
    return Array.from(this.documents.values());
  }

  async getDocument(documentId: string): Promise<Document | null> {
    return this.documents.get(documentId) || null;
  }

  async getDocumentChunks(documentId: string): Promise<DocumentChunk[]> {
    return Array.from(this.chunks.values())
      .filter(chunk => chunk.documentId === documentId);
  }

  async getStats(): Promise<{
    totalDocuments: number;
    totalChunks: number;
    indexSize: number;
  }> {
    const indexSize = this.index ? await this.getIndexSize() : 0;
    
    return {
      totalDocuments: this.documents.size,
      totalChunks: this.chunks.size,
      indexSize
    };
  }

  private async getIndexSize(): Promise<number> {
    try {
      const stats = await fs.stat(this.options.indexPath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  async clear(): Promise<void> {
    if (!this.isInitialized) {
      throw new VectorDatabaseError('Vector database not initialized');
    }

    try {
      // Clear in-memory data
      this.documents.clear();
      this.chunks.clear();
      
      // Remove index files
      await fs.remove(this.options.indexPath);
      
      // Reinitialize
      this.isInitialized = false;
      await this.initialize();
      
      console.log('Vector database cleared successfully');
    } catch (error) {
      throw new VectorDatabaseError(
        `Failed to clear database: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }
}