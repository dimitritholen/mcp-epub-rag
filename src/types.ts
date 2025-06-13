import { z } from 'zod';

// Configuration schema
export const ConfigSchema = z.object({
  documents: z.array(z.string()).describe('Array of file paths to documents (*.epub, *.pdf, *.mobi, *.docx, *.md)'),
  vectorDbPath: z.string().describe('Path where the vector database will be stored'),
  embeddingModel: z.string().default('Xenova/all-MiniLM-L6-v2').describe('Hugging Face model for embeddings'),
  chunkSize: z.number().default(512).describe('Size of text chunks for vectorization'),
  chunkOverlap: z.number().default(50).describe('Overlap between chunks'),
  maxResults: z.number().default(10).describe('Maximum number of search results to return')
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
  [key: string]: any;
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
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  [key: string]: any;
}

export interface SearchResult {
  chunk: DocumentChunk;
  document: Document;
  score: number;
  relevantText: string;
}

// MCP Tool types
export interface SearchToolArgs {
  query: string;
  maxResults?: number;
  threshold?: number;
  fileTypes?: string[];
}

export interface AddDocumentsToolArgs {
  filePaths: string[];
}

export interface ListDocumentsToolArgs {
  fileType?: string;
}

// Error types
export class DocumentProcessingError extends Error {
  public filePath: string;
  public cause?: Error;
  
  constructor(message: string, filePath: string, cause?: Error) {
    super(message);
    this.name = 'DocumentProcessingError';
    this.filePath = filePath;
    this.cause = cause;
  }
}

export class VectorDatabaseError extends Error {
  public cause?: Error;
  
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'VectorDatabaseError';
    this.cause = cause;
  }
}

export class EmbeddingError extends Error {
  public cause?: Error;
  
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'EmbeddingError';
    this.cause = cause;
  }
}