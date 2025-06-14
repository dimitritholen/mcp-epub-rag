# MCP EPUB RAG Server API Documentation

The MCP EPUB RAG Server provides a Model Context Protocol (MCP) interface for document processing, vectorization, and semantic search. This server can process various document formats including EPUB, PDF, DOCX, and Markdown files.

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [API Endpoints](#api-endpoints)
- [Data Types](#data-types)
- [Error Handling](#error-handling)
- [Examples](#examples)
- [Performance Considerations](#performance-considerations)
- [Security](#security)

## Overview

The MCP EPUB RAG Server implements a Retrieval-Augmented Generation (RAG) system that:

1. **Processes Documents**: Parses EPUB, PDF, DOCX, and Markdown files
2. **Creates Embeddings**: Generates vector embeddings using transformer models
3. **Enables Search**: Provides semantic search capabilities across document collections
4. **Manages State**: Maintains a vector database for efficient retrieval

### Supported File Formats

| Format | Extensions | Description |
|--------|------------|-------------|
| EPUB | `.epub` | Electronic publication format |
| PDF | `.pdf` | Portable Document Format |
| DOCX | `.docx` | Microsoft Word documents |
| Markdown | `.md`, `.markdown`, `.mdown`, `.mkd` | Markdown text files |

### Key Features

- **Semantic Search**: Vector-based similarity search using transformer embeddings
- **Caching**: Intelligent caching for embeddings and search results
- **Security**: Input validation, path traversal protection, and content sanitization
- **Performance**: Optimized chunking, batch processing, and query optimization
- **Error Handling**: Comprehensive error reporting with context and recovery suggestions

## Getting Started

### Prerequisites

- Node.js 18+ 
- Sufficient disk space for vector database storage
- Documents in supported formats

### Basic Setup

1. **Install the server** (via npm or direct execution)
2. **Configure the server** with document paths and settings
3. **Start processing** documents and performing searches

### Configuration Parameters

```typescript
interface Config {
  documents: string[];           // Array of document file paths
  vectorDbPath: string;         // Vector database storage path
  embeddingModel?: string;      // Hugging Face model (default: 'Xenova/all-MiniLM-L6-v2')
  chunkSize?: number;          // Text chunk size (default: 512)
  chunkOverlap?: number;       // Chunk overlap (default: 50)
  maxResults?: number;         // Max search results (default: 10)
}
```

## API Endpoints

### 1. Configure (`configure`)

Initializes the RAG server with document paths and processing settings.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "documents": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Array of file paths to documents"
    },
    "vectorDbPath": {
      "type": "string", 
      "description": "Path where the vector database will be stored"
    },
    "embeddingModel": {
      "type": "string",
      "default": "Xenova/all-MiniLM-L6-v2",
      "description": "Hugging Face model for embeddings"
    },
    "chunkSize": {
      "type": "number",
      "default": 512,
      "description": "Size of text chunks for vectorization"
    },
    "chunkOverlap": {
      "type": "number", 
      "default": 50,
      "description": "Overlap between chunks"
    },
    "maxResults": {
      "type": "number",
      "default": 10,
      "description": "Maximum number of search results to return"
    }
  },
  "required": ["documents", "vectorDbPath"]
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Configuration successful. Processed N documents with M total chunks."
    }
  ]
}
```

**Security Limits:**
- Maximum 50 documents per batch
- Maximum 100MB file size per document
- Maximum 260 character path length
- Path traversal protection enabled

### 2. Search (`search`)

Performs semantic search across vectorized documents.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Search query text"
    },
    "maxResults": {
      "type": "number",
      "default": 10,
      "description": "Maximum number of results to return"
    },
    "threshold": {
      "type": "number",
      "description": "Minimum similarity threshold (0-1)"
    },
    "fileTypes": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Filter by file types (epub, pdf, docx, md)"
    }
  },
  "required": ["query"]
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text", 
      "text": "Found N results:\n\n1. **Document Title** (score: 0.XX)\n   Path: /path/to/document\n   Relevant text: \"...excerpt...\"\n\n2. ..."
    }
  ]
}
```

**Query Optimization:**
- Automatic query normalization and cleaning
- Abbreviation expansion (ai → artificial intelligence)
- Special character handling
- Maximum query length: 1000 characters

### 3. Add Documents (`add_documents`)

Adds new documents to the existing vector database.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "filePaths": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Array of file paths to add"
    }
  },
  "required": ["filePaths"]
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Successfully added N documents with M total chunks."
    }
  ]
}
```

### 4. List Documents (`list_documents`)

Lists all documents in the vector database with optional filtering.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "fileType": {
      "type": "string",
      "description": "Filter by file type (epub, pdf, docx, md)"
    }
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Documents in database:\n\n1. **Title** (type)\n   Path: /path/to/document\n   Size: XX KB, Words: XXXX, Chunks: XX\n   Added: YYYY-MM-DD HH:MM:SS\n\n..."
    }
  ]
}
```

### 5. Get Statistics (`get_stats`)

Returns comprehensive statistics about the vector database and system performance.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {}
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Database Statistics:\n- Total Documents: XX\n- Total Chunks: XXX\n- Index Size: XX MB\n- Cache Hit Rate: XX%\n- Average Search Time: XX ms"
    }
  ]
}
```

### 6. Clear Database (`clear_database`)

Removes all documents and data from the vector database.

**Input Schema:**
```json
{
  "type": "object", 
  "properties": {}
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Database cleared successfully. All documents and embeddings have been removed."
    }
  ]
}
```

## Data Types

### Document

```typescript
interface Document {
  id: string;                    // Unique document identifier
  title: string;                 // Document title
  content: string;               // Full text content
  metadata: DocumentMetadata;    // Document metadata
}

interface DocumentMetadata {
  filePath: string;              // Original file path
  fileType: string;              // File extension
  fileSize: number;              // File size in bytes
  lastModified: Date;            // Last modification date
  wordCount: number;             // Total word count
  author?: string;               // Document author
  language?: string;             // Document language
  [key: string]: any;            // Additional metadata
}
```

### Document Chunk

```typescript
interface DocumentChunk {
  id: string;                    // Unique chunk identifier
  documentId: string;            // Parent document ID
  content: string;               // Chunk text content
  startIndex: number;            // Start position in document
  endIndex: number;              // End position in document
  embedding?: number[];          // Vector embedding
  metadata?: any;                // Additional chunk metadata
}
```

### Search Result

```typescript
interface SearchResult {
  chunk: DocumentChunk;          // Matching chunk
  document: Document;            // Source document
  score: number;                 // Similarity score (0-1)
  relevantText: string;          // Highlighted relevant text
}
```

### Search Query

```typescript
interface SearchQuery {
  query: string;                 // Search text
  maxResults?: number;           // Result limit
  threshold?: number;            // Minimum similarity
  filters?: {
    fileTypes?: string[];        // File type filter
    authors?: string[];          // Author filter
    dateRange?: {
      start?: Date;              // Start date
      end?: Date;                // End date
    };
  };
}
```

## Error Handling

### Error Types

The server returns structured errors with context and recovery suggestions:

```typescript
interface ErrorResponse {
  error: {
    code: string;                // Error code
    message: string;             // Human-readable message
    details?: any;               // Additional error details
  };
}
```

### Common Error Codes

| Code | Description | Recovery |
|------|-------------|----------|
| `VALIDATION_ERROR` | Invalid input parameters | Check parameter types and values |
| `FILE_NOT_FOUND` | Document file not accessible | Verify file path and permissions |
| `UNSUPPORTED_FORMAT` | File format not supported | Use supported formats (epub, pdf, docx, md) |
| `PROCESSING_ERROR` | Document processing failed | Check file integrity and format |
| `EMBEDDING_ERROR` | Embedding generation failed | Verify model availability and input |
| `SEARCH_ERROR` | Search operation failed | Check database state and query |
| `SECURITY_ERROR` | Security validation failed | Review file paths and content |

### Error Examples

**Invalid File Path:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid document paths: /nonexistent/file.pdf: File does not exist"
  }
}
```

**Unsupported File Type:**
```json
{
  "error": {
    "code": "UNSUPPORTED_FORMAT", 
    "message": "File format '.txt' is not supported. Supported formats: .epub, .pdf, .docx, .md"
  }
}
```

## Examples

### Basic Usage

```typescript
// 1. Configure the server
await callTool('configure', {
  documents: [
    '/path/to/book1.epub',
    '/path/to/document.pdf',
    '/path/to/notes.md'
  ],
  vectorDbPath: '/path/to/vector-db',
  chunkSize: 512,
  chunkOverlap: 50
});

// 2. Search for content
const results = await callTool('search', {
  query: 'artificial intelligence machine learning',
  maxResults: 5,
  threshold: 0.7
});

// 3. Add more documents
await callTool('add_documents', {
  filePaths: ['/path/to/new-book.epub']
});

// 4. Get statistics
const stats = await callTool('get_stats', {});
```

### Advanced Search with Filters

```typescript
// Search with file type filtering
const results = await callTool('search', {
  query: 'neural networks deep learning',
  maxResults: 10,
  threshold: 0.6,
  fileTypes: ['pdf', 'epub']
});
```

### Batch Document Processing

```typescript
// Process multiple documents efficiently
await callTool('configure', {
  documents: [
    '/documents/book1.epub',
    '/documents/book2.epub', 
    '/documents/research.pdf',
    '/documents/notes.md'
  ],
  vectorDbPath: '/data/vector-db',
  chunkSize: 1024,        // Larger chunks for better context
  chunkOverlap: 100,      // More overlap for continuity
  maxResults: 20          // More search results
});
```

## Performance Considerations

### Optimization Strategies

1. **Chunk Size**: 
   - Smaller chunks (256-512): Better precision, more results
   - Larger chunks (1024-2048): Better context, fewer results

2. **Caching**:
   - Embedding cache: 1-hour TTL, 50MB memory limit
   - Search cache: 30-minute TTL, 25MB memory limit
   - Cache hit rates typically 70-90%

3. **Batch Processing**:
   - Maximum 50 documents per batch
   - Concurrent processing for multiple files
   - Memory-efficient streaming for large files

4. **Search Optimization**:
   - Query preprocessing and normalization
   - Pre-filtering based on metadata
   - Result caching with TTL
   - Slow query analysis (>1s)

### Performance Benchmarks

| Operation | Small Files (<1MB) | Large Files (>10MB) |
|-----------|-------------------|---------------------|
| Document Processing | <1s per file | <10s per file |
| Embedding Generation | <2s per 100 chunks | <30s per 1000 chunks |
| Search Query | <100ms | <500ms |
| Cache Hit Search | <50ms | <100ms |

### Memory Usage

- Base memory: ~100MB
- Per document: ~1-5MB (depending on size)
- Vector database: ~1MB per 1000 chunks
- Cache overhead: ~50-75MB

## Security

### Input Validation

1. **Path Security**:
   - Path traversal prevention (`../` blocked)
   - Null byte injection protection
   - Maximum path length limits
   - File size validation (100MB limit)

2. **Content Sanitization**:
   - XSS prevention in search queries
   - Script tag removal
   - Event handler sanitization
   - Null byte filtering

3. **Rate Limiting**:
   - Maximum 50 documents per batch
   - Query length limits (1000 characters)
   - Timeout protection (30 seconds)

### Security Limits

```typescript
const SECURITY_LIMITS = {
  MAX_FILE_SIZE: 100 * 1024 * 1024,    // 100MB
  MAX_QUERY_LENGTH: 1000,               // 1000 characters
  MAX_BATCH_SIZE: 50,                   // 50 documents
  MAX_PATH_LENGTH: 260,                 // 260 characters
  MAX_FILENAME_LENGTH: 255,             // 255 characters
  TIMEOUT_MS: 30000                     // 30 seconds
};
```

### Best Practices

1. **File Access**:
   - Store documents in controlled directories
   - Use absolute paths when possible
   - Validate file permissions before processing

2. **Query Safety**:
   - Sanitize user input for search queries
   - Validate query parameters
   - Monitor for suspicious patterns

3. **Resource Management**:
   - Set appropriate memory limits
   - Monitor disk usage for vector database
   - Implement cleanup procedures for temporary files

## Troubleshooting

### Common Issues

1. **"File not found" errors**: Verify file paths are absolute and accessible
2. **"Unsupported format" errors**: Check file extensions match supported formats
3. **"Processing timeout" errors**: Reduce batch size or increase timeout
4. **"Memory errors"**: Reduce chunk size or enable more aggressive caching
5. **"Search returns no results"**: Lower similarity threshold or check embeddings

### Debug Information

Enable detailed logging by setting the log level to `debug` for comprehensive error tracking and performance monitoring.

---

*This documentation covers the MCP EPUB RAG Server API v2.0.0. For updates and additional information, refer to the project repository.*