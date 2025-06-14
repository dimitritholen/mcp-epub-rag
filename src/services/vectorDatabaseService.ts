import { LocalIndex } from 'vectra';
import fs from 'fs-extra';
import path from 'path';
import { DocumentChunk, SearchQuery, SearchResult, Document, VectorDatabaseError } from '../types.js';
import { EmbeddingService } from './embeddingService.js';
import { CacheService, getGlobalCache } from './cacheService.js';
import { logger } from '../utils/logging/logger.js';
import crypto from 'crypto';

export interface VectorDatabaseOptions {
  indexPath: string;
  embeddingDimension?: number;
  enableCache?: boolean;
  cacheConfig?: {
    maxSearchResults?: number;
    searchCacheTtl?: number; // TTL for search results in milliseconds
    maxCacheMemory?: number; // Maximum memory for search cache
  };
  optimizations?: {
    enablePrefiltering?: boolean; // Filter before vector search
    enableResultCaching?: boolean; // Cache search results
    enableQueryRewriting?: boolean; // Optimize queries
    batchSize?: number; // Batch size for bulk operations
  };
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
  private cache: CacheService;
  private enableCache: boolean;
  private optimizations: Required<NonNullable<VectorDatabaseOptions['optimizations']>>;

  // Performance tracking
  private searchStats = {
    totalSearches: 0,
    cacheHits: 0,
    averageSearchTime: 0,
    slowQueries: [] as Array<{ query: string; time: number; timestamp: Date }>
  };

  constructor(
    private options: VectorDatabaseOptions,
    private embeddingService: EmbeddingService
  ) {
    this.enableCache = options.enableCache ?? true;
    
    // Initialize optimizations with defaults
    this.optimizations = {
      enablePrefiltering: options.optimizations?.enablePrefiltering ?? true,
      enableResultCaching: options.optimizations?.enableResultCaching ?? true,
      enableQueryRewriting: options.optimizations?.enableQueryRewriting ?? true,
      batchSize: options.optimizations?.batchSize ?? 50
    };

    // Initialize cache for search results
    const cacheConfig = {
      maxSize: options.cacheConfig?.maxSearchResults ?? 500,
      defaultTtl: options.cacheConfig?.searchCacheTtl ?? 30 * 60 * 1000, // 30 minutes
      maxMemory: options.cacheConfig?.maxCacheMemory ?? 25 * 1024 * 1024, // 25MB
      cleanupInterval: 5 * 60 * 1000 // 5 minutes
    };
    
    this.cache = getGlobalCache(cacheConfig);
    
    logger.info({
      indexPath: this.options.indexPath,
      cacheEnabled: this.enableCache,
      optimizations: this.optimizations,
      cacheConfig
    }, 'VectorDatabaseService initialized');
  }

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
        // Create the index with proper dimensions
        await this.index.createIndex();
      }

      this.isInitialized = true;
      console.log('Vector database initialized successfully');
    } catch (error) {
      throw new VectorDatabaseError(
        `Failed to initialize vector database: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'initialization',
        this.options.indexPath,
        {},
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
      throw new VectorDatabaseError('Vector database not initialized', 'indexing');
    }

    try {
      console.log(`Adding document: ${document.title} with ${chunks.length} chunks`);
      
      // Store document
      this.documents.set(document.id, document);
      
      // Add chunks to index
      for (const chunk of chunks) {
        if (!chunk.embedding) {
          throw new VectorDatabaseError(`Chunk ${chunk.id} missing embedding`, 'indexing');
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
            chunkMetadata: chunk.metadata as any
          }
        });
      }
      
      // Save metadata to disk
      await this.saveMetadata();
      
      console.log(`Successfully added document: ${document.title}`);
    } catch (error) {
      throw new VectorDatabaseError(
        `Failed to add document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'indexing',
        this.options.indexPath,
        {},
        error instanceof Error ? error : undefined
      );
    }
  }

  async removeDocument(documentId: string): Promise<void> {
    if (!this.isInitialized || !this.index) {
      throw new VectorDatabaseError('Vector database not initialized', 'storage');
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
        'storage',
        this.options.indexPath,
        {},
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Performs semantic search across vectorized documents with caching and optimization
   * 
   * This method implements a multi-stage search pipeline:
   * 1. Cache lookup for repeated queries
   * 2. Query preprocessing and optimization
   * 3. Metadata-based pre-filtering (if enabled)
   * 4. Vector similarity search using embeddings
   * 5. Result ranking and filtering
   * 6. Cache storage for future requests
   * 
   * @param query Search query with text, filters, and parameters
   * @returns Promise resolving to ranked search results with relevance scores
   */
  async search(query: SearchQuery): Promise<SearchResult[]> {
    if (!this.isInitialized || !this.index) {
      throw new VectorDatabaseError('Vector database not initialized', 'search');
    }

    const startTime = Date.now();
    this.searchStats.totalSearches++;

    try {
      // Step 1: Generate deterministic cache key based on query parameters
      const cacheKey = this.generateSearchCacheKey(query);
      
      // Step 2: Check cache for previously computed results (30min TTL)
      if (this.enableCache && this.optimizations.enableResultCaching) {
        const cached = this.cache.get<SearchResult[]>(cacheKey);
        if (cached) {
          this.searchStats.cacheHits++;
          const searchTime = Date.now() - startTime;
          this.updateSearchStats(searchTime);
          
          logger.debug({ 
            query: query.query,
            cacheHit: true,
            resultCount: cached.length,
            searchTime
          }, 'Search cache hit');
          
          return cached;
        }
      }

      // Step 3: Apply query optimization (normalization, abbreviation expansion, limits)
      const optimizedQuery = this.optimizations.enableQueryRewriting ? 
        this.optimizeQuery(query) : query;

      // Step 4: Pre-filter document chunks based on metadata to reduce search space
      let candidateChunks: DocumentChunk[] | null = null;
      if (this.optimizations.enablePrefiltering && optimizedQuery.filters) {
        candidateChunks = this.prefilterChunks(optimizedQuery.filters);
        
        logger.debug({
          totalChunks: this.chunks.size,
          filteredChunks: candidateChunks.length,
          filters: optimizedQuery.filters
        }, 'Pre-filtering applied');
      }

      // Step 5: Generate vector embedding for the search query using transformer model
      const queryEmbedding = await this.embeddingService.generateEmbedding(optimizedQuery.query);
      
      // Step 6: Perform vector similarity search against indexed document chunks
      const maxResults = Math.min(optimizedQuery.maxResults || 10, 100); // Cap max results for performance
      const searchResults = await (this.index as any).queryItems(
        queryEmbedding, 
        // Search more candidates than needed to account for filtering and ranking
        candidateChunks ? Math.min(maxResults * 2, candidateChunks.length) : maxResults * 2
      );
      
      // Step 7: Process vector search results into structured SearchResult objects
      const results: SearchResult[] = [];
      const processedIds = new Set<string>(); // Prevent duplicate results
      
      for (const result of searchResults) {
        // Skip duplicates that may occur in vector search
        if (processedIds.has(result.item.id)) {
          continue;
        }
        processedIds.add(result.item.id);

        // Retrieve chunk and document metadata from in-memory maps
        const chunk = this.chunks.get(result.item.id);
        const document = chunk ? this.documents.get(chunk.documentId) : null;
        
        if (chunk && document) {
          // Apply additional filtering for chunks not pre-filtered
          if (!candidateChunks || candidateChunks.includes(chunk)) {
            if (this.passesFilters(document, chunk, optimizedQuery.filters)) {
              // Apply similarity threshold to filter low-quality matches
              if (!optimizedQuery.threshold || result.score >= optimizedQuery.threshold) {
                results.push({
                  chunk,
                  document,
                  score: result.score,
                  // Extract the most relevant portion of the chunk for display
                  relevantText: this.extractRelevantText(chunk.content, optimizedQuery.query)
                });

                // Early termination once we have enough high-quality results
                if (results.length >= maxResults) {
                  break;
                }
              }
            }
          }
        }
      }
      
      // Step 8: Sort results by relevance score (highest first)
      const sortedResults = results.sort((a, b) => b.score - a.score);

      // Step 9: Cache results for future queries (adaptive TTL based on result set size)
      if (this.enableCache && this.optimizations.enableResultCaching && sortedResults.length > 0) {
        // Use shorter TTL for large result sets to manage cache memory usage
        const ttl = sortedResults.length > 20 ? 10 * 60 * 1000 : undefined; // 10 minutes for large sets
        this.cache.set(cacheKey, sortedResults, ttl);
      }

      const searchTime = Date.now() - startTime;
      this.updateSearchStats(searchTime);

      // Track slow queries for optimization
      if (searchTime > 1000) { // Queries taking more than 1 second
        this.searchStats.slowQueries.push({
          query: optimizedQuery.query,
          time: searchTime,
          timestamp: new Date()
        });
        
        // Keep only last 10 slow queries
        if (this.searchStats.slowQueries.length > 10) {
          this.searchStats.slowQueries.shift();
        }
      }

      logger.debug({
        query: optimizedQuery.query,
        cacheHit: false,
        resultCount: sortedResults.length,
        searchTime,
        prefiltered: !!candidateChunks,
        optimized: optimizedQuery !== query
      }, 'Vector search completed');

      return sortedResults;
    } catch (error) {
      const searchTime = Date.now() - startTime;
      this.updateSearchStats(searchTime);
      
      throw new VectorDatabaseError(
        `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'search',
        this.options.indexPath,
        { query: query.query, searchTime },
        error instanceof Error ? error : undefined
      );
    }
  }

  private passesFilters(document: Document, _chunk: DocumentChunk, filters?: any): boolean {
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
      throw new VectorDatabaseError('Vector database not initialized', 'storage');
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
        'storage',
        this.options.indexPath,
        {},
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Generate cache key for search queries
   */
  private generateSearchCacheKey(query: SearchQuery): string {
    const hash = crypto.createHash('sha256');
    const cacheData = {
      query: query.query,
      maxResults: query.maxResults,
      threshold: query.threshold,
      filters: query.filters
    };
    hash.update(JSON.stringify(cacheData));
    return `search:${hash.digest('hex')}`;
  }

  /**
   * Optimize query for better performance
   */
  private optimizeQuery(query: SearchQuery): SearchQuery {
    const optimized = { ...query };
    
    // Normalize and clean query text
    optimized.query = query.query
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s-]/g, ' ') // Remove special characters except hyphens
      .trim();

    // Expand common abbreviations or synonyms
    const expansions: Record<string, string> = {
      'ai': 'artificial intelligence',
      'ml': 'machine learning',
      'nlp': 'natural language processing',
      'db': 'database'
    };

    for (const [abbrev, expansion] of Object.entries(expansions)) {
      const regex = new RegExp(`\\b${abbrev}\\b`, 'gi');
      optimized.query = optimized.query.replace(regex, expansion);
    }

    // Optimize result limits
    if (!optimized.maxResults || optimized.maxResults > 100) {
      optimized.maxResults = 20; // Reasonable default
    }

    return optimized;
  }

  /**
   * Pre-filter chunks based on metadata filters
   */
  private prefilterChunks(filters: any): DocumentChunk[] {
    const candidateChunks: DocumentChunk[] = [];
    
    for (const chunk of this.chunks.values()) {
      const document = this.documents.get(chunk.documentId);
      if (document && this.passesFilters(document, chunk, filters)) {
        candidateChunks.push(chunk);
      }
    }
    
    return candidateChunks;
  }

  /**
   * Update search performance statistics
   */
  private updateSearchStats(searchTime: number): void {
    const currentAvg = this.searchStats.averageSearchTime;
    const totalSearches = this.searchStats.totalSearches;
    
    // Calculate running average
    this.searchStats.averageSearchTime = 
      (currentAvg * (totalSearches - 1) + searchTime) / totalSearches;
  }

  /**
   * Get search performance statistics
   */
  getSearchStats() {
    const cacheStats = this.enableCache ? this.cache.getStats() : null;
    
    return {
      ...this.searchStats,
      cacheStats,
      cacheHitRate: this.searchStats.totalSearches > 0 ? 
        this.searchStats.cacheHits / this.searchStats.totalSearches : 0
    };
  }

  /**
   * Clear search result cache
   */
  clearSearchCache(): void {
    if (this.enableCache) {
      this.cache.invalidatePattern(/^search:/);
      logger.info('Search cache cleared');
    }
  }

  /**
   * Optimize database performance
   */
  async optimizeIndex(): Promise<void> {
    if (!this.isInitialized || !this.index) {
      throw new VectorDatabaseError('Vector database not initialized', 'initialization');
    }

    try {
      // For Vectra, optimization might involve index rebuilding or cleanup
      // This is a placeholder for future optimization techniques
      logger.info('Index optimization completed');
    } catch (error) {
      logger.error({ error }, 'Index optimization failed');
      throw new VectorDatabaseError(
        'Index optimization failed',
        'initialization',
        this.options.indexPath,
        {},
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get slow query analysis
   */
  getSlowQueryAnalysis() {
    if (this.searchStats.slowQueries.length === 0) {
      return { message: 'No slow queries detected' };
    }

    const avgSlowTime = this.searchStats.slowQueries.reduce((sum, q) => sum + q.time, 0) / 
      this.searchStats.slowQueries.length;

    const commonPatterns = this.analyzeSlowQueryPatterns();

    return {
      slowQueryCount: this.searchStats.slowQueries.length,
      averageSlowTime: Math.round(avgSlowTime),
      commonPatterns,
      recentSlowQueries: this.searchStats.slowQueries.slice(-5)
    };
  }

  /**
   * Analyze patterns in slow queries for optimization insights
   */
  private analyzeSlowQueryPatterns() {
    const patterns: Record<string, number> = {};
    
    for (const slowQuery of this.searchStats.slowQueries) {
      const queryLength = slowQuery.query.length;
      const wordCount = slowQuery.query.split(' ').length;
      
      // Categorize by query characteristics
      if (queryLength > 100) {
        patterns['Long queries (>100 chars)'] = (patterns['Long queries (>100 chars)'] || 0) + 1;
      }
      if (wordCount > 10) {
        patterns['Complex queries (>10 words)'] = (patterns['Complex queries (>10 words)'] || 0) + 1;
      }
      if (slowQuery.query.includes('"')) {
        patterns['Quoted phrases'] = (patterns['Quoted phrases'] || 0) + 1;
      }
    }
    
    return patterns;
  }
}