import { z } from 'zod';

// Configuration schema
export const ConfigSchema = z.object({
  documents: z.array(z.string()).describe('Array of file paths to documents (*.epub, *.pdf, *.mobi, *.docx, *.md)'),
  vectorDbPath: z.string().describe('Path where the vector database will be stored'),
  embeddingModel: z.string().default('Xenova/all-MiniLM-L6-v2').describe('Hugging Face model for embeddings'),
  chunkSize: z.number().default(512).describe('Size of text chunks for vectorization'),
  chunkOverlap: z.number().default(50).describe('Overlap between chunks'),
  maxResults: z.number().default(10).describe('Maximum number of search results to return'),
  maxFileSize: z.number().optional().describe('Maximum file size in bytes'),
  timeout: z.number().default(30000).describe('Timeout for operations in milliseconds'),
  enableCache: z.boolean().default(true).describe('Enable caching for better performance'),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  batchSize: z.number().default(10).describe('Batch size for processing multiple documents')
});

export type Config = z.infer<typeof ConfigSchema>;

// Document types
export interface Document {
  id: string;
  title: string;
  content: string;
  metadata: DocumentMetadata;
  chunks: DocumentChunk[];
}

export interface DocumentMetadata {
  filePath: string;
  fileType: 'epub' | 'pdf' | 'mobi' | 'docx' | 'md';
  author?: string;
  createdAt: Date;
  lastModified: Date;
  fileSize: number;
  wordCount?: number;
  language?: string;
  pageCount?: number;
  // Additional format-specific metadata
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  version?: string;
  encrypted?: boolean;
  [key: string]: unknown;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  startIndex: number;
  endIndex: number;
  embedding?: number[];
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  chunkIndex: number;
  pageNumber?: number;
  section?: string;
  wordCount?: number;
  language?: string;
  [key: string]: unknown;
}

// Search types
export interface SearchQuery {
  query: string;
  maxResults?: number;
  threshold?: number;
  filters?: SearchFilters;
}

export interface SearchFilters {
  fileTypes?: string[];
  authors?: string[];
  languages?: string[];
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  fileSizeRange?: {
    min?: number;
    max?: number;
  };
  [key: string]: unknown;
}

export interface SearchResult {
  chunk: DocumentChunk;
  document: Document;
  score: number;
  relevantText: string;
  highlights?: string[];
}

// MCP Tool types
export interface SearchToolArgs {
  query: string;
  maxResults?: number;
  threshold?: number;
  fileTypes?: string[];
  authors?: string[];
  languages?: string[];
}

export interface AddDocumentsToolArgs {
  filePaths: string[];
  options?: {
    batchSize?: number;
    timeout?: number;
    maxFileSize?: number;
    overwrite?: boolean;
  };
}

export interface ListDocumentsToolArgs {
  fileType?: string;
  author?: string;
  language?: string;
  sortBy?: 'title' | 'author' | 'date' | 'size';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// Service interfaces
export interface EmbeddingServiceConfig {
  modelName: string;
  batchSize?: number;
  normalize?: boolean;
  maxTokens?: number;
  device?: 'cpu' | 'gpu';
}

export interface VectorDatabaseConfig {
  indexPath: string;
  dimensions?: number;
  similarity?: 'cosine' | 'euclidean' | 'dot';
  enablePersistence?: boolean;
  cacheSize?: number;
}

export interface ChunkingConfig {
  chunkSize: number;
  chunkOverlap: number;
  preserveSentences?: boolean;
  preserveParagraphs?: boolean;
  minChunkSize?: number;
  maxChunkSize?: number;
}

// Performance and monitoring types
export interface ProcessingStats {
  totalDocuments: number;
  totalChunks: number;
  averageChunkSize: number;
  processingTime: number;
  memoryUsage: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}

export interface DatabaseStats {
  totalDocuments: number;
  totalChunks: number;
  indexSize: number;
  memoryUsage: number;
  diskUsage: number;
  lastUpdated: Date;
}

export interface ModelInfo {
  name: string;
  isInitialized: boolean;
  loadTime?: number;
  memoryUsage?: number;
  version?: string;
  tokenLimit?: number;
}

// Progress tracking
export interface ProgressInfo {
  stage: string;
  percentage: number;
  message: string;
  currentItem?: string;
  itemsProcessed?: number;
  totalItems?: number;
  estimatedTimeRemaining?: number;
}

// Validation schemas for runtime validation
export const SearchToolArgsSchema = z.object({
  query: z.string().min(1),
  maxResults: z.number().int().positive().optional(),
  threshold: z.number().min(0).max(1).optional(),
  fileTypes: z.array(z.string()).optional(),
  authors: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional()
});

export const AddDocumentsToolArgsSchema = z.object({
  filePaths: z.array(z.string().min(1)),
  options: z.object({
    batchSize: z.number().int().positive().optional(),
    timeout: z.number().int().positive().optional(),
    maxFileSize: z.number().int().positive().optional(),
    overwrite: z.boolean().optional()
  }).optional()
});

export const ListDocumentsToolArgsSchema = z.object({
  fileType: z.string().optional(),
  author: z.string().optional(),
  language: z.string().optional(),
  sortBy: z.enum(['title', 'author', 'date', 'size']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional()
});

// Cache-related types
export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  timestamp: number;
  ttl?: number;
  size?: number;
}

export interface CacheStats {
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  cacheSize: number;
  memoryUsage: number;
}

// Event types for the event-driven architecture
export type EventType = 
  | 'document:added'
  | 'document:removed'
  | 'document:updated'
  | 'search:performed'
  | 'error:occurred'
  | 'system:initialized'
  | 'system:shutdown';

export interface SystemEvent {
  type: EventType;
  timestamp: Date;
  data: Record<string, unknown>;
  source?: string;
  userId?: string;
}

// Health check types
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  services: {
    documentParser: 'up' | 'down' | 'degraded';
    vectorDatabase: 'up' | 'down' | 'degraded';
    embeddingService: 'up' | 'down' | 'degraded';
  };
  metrics: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
  };
  errors?: string[];
}

// Re-export error classes and types from the errors module
export { 
  BaseError, 
  DocumentProcessingError,
  VectorDatabaseError,
  EmbeddingError,
  ConfigurationError,
  ValidationError 
} from './errors/index.js';
