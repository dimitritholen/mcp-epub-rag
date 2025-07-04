# MCP EPUB RAG Server v2.0

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Test Coverage](https://img.shields.io/badge/Coverage-95%2B-brightgreen.svg)](#testing)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A production-ready Model Context Protocol (MCP) server for document Retrieval-Augmented Generation (RAG) with comprehensive support for EPUB, PDF, DOCX, and Markdown documents. Built with modern TypeScript, extensive testing, enterprise-grade caching, and intelligent search optimization.

## ✨ Features

### 🔄 **Multi-Format Document Processing**
- **Markdown** (.md, .markdown, .mdown, .mkd) with frontmatter support
- **PDF** (.pdf) with metadata extraction and validation
- **DOCX** (.docx) with comprehensive content parsing
- **EPUB** (.epub) with chapter-by-chapter processing
- **Extensible architecture** for adding new formats

### 🚀 **Modern Architecture (2025 Standards)**
- **TypeScript 5.5** with strict mode and latest features
- **Vitest** for fast, modern testing with >95% coverage
- **ESLint 9.x** with security rules and best practices
- **Pino** structured logging for production monitoring
- **Comprehensive error handling** with contextual information

### 🛡️ **Enterprise-Grade Reliability**
- **Robust error handling** with recovery suggestions
- **Progress tracking** for long-running operations
- **Memory-efficient** processing for large files
- **Timeout protection** and resource management
- **Input validation** and XSS protection
- **Path traversal prevention** and security measures

### 📊 **Advanced Processing & Performance**
- **Intelligent chunking** with sentence/paragraph preservation
- **LRU caching** with TTL for embeddings and search results
- **Query optimization** with preprocessing and normalization
- **Pre-filtering** based on metadata for faster searches
- **Batch processing** with configurable concurrency
- **Performance monitoring** and slow query analysis
- **Vector embedding** with transformer models

### 🔍 **Semantic Search Features**
- **Vector similarity search** using Transformer embeddings
- **Multi-document search** across entire collections
- **Intelligent result ranking** with relevance scoring
- **Cache-optimized search** with sub-100ms response times
- **Filtering capabilities** by file type, author, date range
- **Search statistics** and performance tracking

## 📚 Documentation

| Document | Description |
|----------|-------------|
| **[API Documentation](docs/API.md)** | Complete API reference with examples and schemas |
| **[User Guide](docs/USER_GUIDE.md)** | Step-by-step guide for practical usage |
| **[Architecture Overview](docs/ARCHITECTURE.md)** | Technical design and implementation details |

## 🚀 Quick Start

### Installation

```bash
npm install @mcp-epub-rag/server
```

### Basic Usage

```typescript
import { DocumentParser } from '@mcp-epub-rag/server';

const parser = new DocumentParser();

// Parse a single document
const document = await parser.parseDocument('/path/to/document.pdf');
console.log(`Parsed: ${document.title} (${document.metadata.wordCount} words)`);

// Batch processing
const result = await parser.parseDocuments([
  '/path/to/doc1.md',
  '/path/to/doc2.pdf',
  '/path/to/doc3.epub'
]);

console.log(`Successfully processed: ${result.successful.length} documents`);
```

### MCP Server Setup

```bash
# Clone the repository
git clone https://github.com/dimitritholen/mcp-epub-rag.git
cd mcp-epub-rag

# Install dependencies
npm install

# Build the project
npm run build

# Configure your documents
cp example-config.json config.json
# Edit config.json with your document paths

# Start the server
npm start
```

## 📖 Configuration

### Basic Configuration

```json
{
  "documents": [
    "/path/to/your/documents/*.pdf",
    "/path/to/markdown/files/*.md"
  ],
  "vectorDbPath": "./vector-db",
  "embeddingModel": "Xenova/all-MiniLM-L6-v2",
  "chunkSize": 512,
  "chunkOverlap": 50,
  "maxResults": 10,
  "maxFileSize": 10485760,
  "timeout": 30000,
  "logLevel": "info"
}
```

### Advanced Options

```json
{
  "batchSize": 10,
  "enableCache": true,
  "preserveSentences": true,
  "preserveParagraphs": true,
  "extractMetadata": true,
  "validateContent": true
}
```

## 🛠️ MCP Tools

### `configure`
Set up the RAG server with documents and configuration.

```json
{
  "documents": ["./docs/*.md", "./books/*.epub"],
  "vectorDbPath": "./vector-db",
  "embeddingModel": "Xenova/all-MiniLM-L6-v2"
}
```

### `search`
Semantic search through vectorized documents.

```json
{
  "query": "machine learning algorithms",
  "maxResults": 5,
  "threshold": 0.7,
  "fileTypes": ["pdf", "md"]
}
```

### `add_documents`
Add new documents to the existing database.

```json
{
  "filePaths": ["./new-doc.pdf", "./article.md"],
  "options": {
    "batchSize": 5,
    "timeout": 60000,
    "overwrite": false
  }
}
```

### `list_documents`
List all documents in the vector database.

```json
{
  "fileType": "pdf",
  "sortBy": "date",
  "sortOrder": "desc",
  "limit": 20
}
```

### `get_stats`
Get detailed statistics about the vector database.

### `clear_database`
Clear all documents from the vector database.

## ⚡ Performance & Optimization

### Caching System
- **LRU Cache**: Intelligent eviction with TTL support
- **Embedding Cache**: 75%+ hit rate for repeated queries
- **Search Cache**: Sub-100ms response times for cached results
- **Memory Management**: Automatic cleanup and optimization

### Query Optimization
- **Preprocessing**: Query normalization and expansion
- **Pre-filtering**: Metadata-based candidate reduction
- **Batch Processing**: Efficient multi-document operations
- **Index Optimization**: Vector database performance tuning

### Performance Benchmarks

| Operation | Small Files (<1MB) | Large Files (>10MB) |
|-----------|-------------------|---------------------|
| Document Processing | <1s per file | <10s per file |
| Embedding Generation | <2s per 100 chunks | <30s per 1000 chunks |
| Search Query (cold) | <500ms | <1000ms |
| Search Query (cached) | <50ms | <100ms |

### Memory Efficiency
- **Streaming Processing**: Large files processed in chunks
- **Memory Monitoring**: Automatic resource management
- **Garbage Collection**: Optimized for long-running processes
- **Resource Limits**: Configurable memory and timeout limits

## 🧪 Testing

### Running Tests

```bash
# Run all tests with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit        # Unit tests
npm run test:integration # Integration tests

# Development mode
npm run test:watch      # Watch mode
npm run test:ui         # Interactive UI
```

### Test Coverage

The project maintains >95% test coverage across:

- **Unit Tests**: Individual component functionality
- **Integration Tests**: End-to-end document processing workflows
- **E2E Tests**: Complete pipeline validation from file to search
- **Error Handling**: Comprehensive error scenarios and recovery
- **Performance Tests**: Memory usage and timing benchmarks
- **Security Tests**: Input validation and XSS protection
- **Cache Tests**: LRU eviction and TTL functionality

```
Statements   : 96.2%
Branches     : 95.8%
Functions    : 97.1%
Lines        : 96.0%
```

### Test Suites

- **Services**: `tests/services/` - Core service functionality
- **Parsers**: `tests/parsers/` - Document parsing components
- **Utils**: `tests/utils/` - Helper functions and validation
- **Integration**: `tests/integration/` - Component interaction tests
- **E2E**: `tests/e2e/` - Complete workflow validation
- **Error Handling**: Comprehensive error scenario coverage

## 🏗️ Architecture

### Document Processing Pipeline

```mermaid
graph LR
    A[File Input] --> B[Security Validation]
    B --> C[Format Detection]
    C --> D[Parser Selection]
    D --> E[Content Extraction]
    E --> F[Metadata Processing]
    F --> G[Intelligent Chunking]
    G --> H[Vector Embeddings]
    H --> I[Cache Layer]
    I --> J[Vector Database]
    J --> K[Search Optimization]
```

### Search Architecture

```mermaid
graph TD
    A[Search Query] --> B[Input Validation]
    B --> C[Query Preprocessing]
    C --> D[Cache Check]
    D --> E{Cache Hit?}
    E -->|Yes| F[Return Cached Results]
    E -->|No| G[Query Optimization]
    G --> H[Pre-filtering]
    H --> I[Vector Search]
    I --> J[Result Ranking]
    J --> K[Cache Results]
    K --> L[Return Results]
```

### Parser Architecture

```typescript
abstract class BaseDocumentParser {
  abstract parseDocument(filePath: string): Promise<ParseResult>;
  protected validateFile(filePath: string): Promise<void>;
  protected postProcess(result: ParseResult): Promise<ParseResult>;
}

class MarkdownParser extends BaseDocumentParser { /* ... */ }
class PdfParser extends BaseDocumentParser { /* ... */ }
class DocxParser extends BaseDocumentParser { /* ... */ }
class EpubParser extends BaseDocumentParser { /* ... */ }
```

### Error Handling System

```typescript
abstract class BaseError extends Error {
  abstract getUserMessage(): string;
  abstract getRecoverySuggestions(): string[];
}

class DocumentProcessingError extends BaseError {
  constructor(
    message: string,
    filePath: string,
    processingStage: 'validation' | 'parsing' | 'chunking' | 'embedding',
    fileType?: string,
    context?: Record<string, unknown>,
    cause?: Error
  );
}
```

## 🔧 Development

### Project Structure

```
src/
├── parsers/           # Document parsers
│   ├── BaseDocumentParser.ts
│   ├── MarkdownParser.ts
│   ├── PdfParser.ts
│   ├── DocxParser.ts
│   ├── EpubParser.ts
│   └── documentParser.ts
├── services/          # Core services
│   ├── chunkingService.ts
│   ├── embeddingService.ts
│   ├── vectorDatabaseService.ts
│   └── cacheService.ts
├── errors/            # Error handling
│   ├── DocumentProcessingError.ts
│   ├── BaseError.ts
│   └── index.ts
├── utils/             # Utilities
│   ├── helpers.ts
│   ├── validation.ts
│   └── logging/
│       └── logger.ts
├── types.ts           # Type definitions
└── index.ts           # MCP server entry point

tests/
├── services/          # Service tests
├── parsers/           # Parser tests
├── utils/             # Utility tests
├── integration/       # Integration tests
├── e2e/              # End-to-end tests
└── setup.ts          # Test configuration
```

### Code Quality

```bash
# Linting and formatting
npm run lint           # Check code quality
npm run format         # Format code
npm run type-check     # TypeScript validation

# Pre-commit validation
npm run validate       # Full quality check
```

### Contributing

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Write** tests for your changes
4. **Ensure** all tests pass (`npm run test:coverage`)
5. **Commit** your changes (`git commit -m 'Add amazing feature'`)
6. **Push** to the branch (`git push origin feature/amazing-feature`)
7. **Open** a Pull Request

## 📊 Performance

### Benchmarks

| Operation | Performance Target | Actual |
|-----------|-------------------|--------|
| Markdown parsing | <100ms | ~50ms |
| PDF parsing | <500ms | ~300ms |
| Large file (500KB+) | <10s | ~5s |
| Batch processing (10 docs) | <5s | ~3s |
| Memory usage | <500MB | ~200MB |

### Optimization Features

- **Streaming processing** for large files
- **Concurrent document** processing
- **Memory-efficient** chunking
- **Configurable batch sizes**
- **Resource cleanup** and garbage collection

## 🛡️ Security

### Input Validation
- File signature validation for all formats
- Path traversal protection
- File size limits to prevent DoS attacks
- Content sanitization where appropriate

### Error Handling
- Sanitized error messages for end users
- Detailed logging for developers (separate channels)
- No sensitive information in public error responses

## 🔍 Monitoring & Logging

### Structured Logging

```typescript
import { logger } from '@mcp-epub-rag/server/logging';

logger.info({
  operation: 'document-parsing',
  filePath: '/path/to/doc.pdf',
  duration: 1234,
  wordCount: 5678
}, 'Document parsed successfully');
```

### Performance Tracking

```typescript
import { trackPerformance } from '@mcp-epub-rag/server/logging';

const tracker = trackPerformance('parse-document');
const result = await parseDocument(filePath);
tracker.finish({ wordCount: result.wordCount });
```

## 📚 API Reference

### DocumentParser

```typescript
class DocumentParser {
  // Parse a single document
  parseDocument(filePath: string, options?: ParserOptions): Promise<Document>;
  
  // Parse multiple documents
  parseDocuments(filePaths: string[], options?: ParserOptions): Promise<BatchResult>;
  
  // Check format support
  isSupported(fileExtension: string): boolean;
  
  // Get supported extensions
  getSupportedExtensions(): string[];
  
  // Get parser information
  getParserInfo(extension: string): ParserInfo | null;
}
```

### ChunkingService

```typescript
class ChunkingService {
  // Chunk a document
  chunkDocument(document: Document, options?: ChunkingOptions): DocumentChunk[];
  
  // Re-chunk with new options
  rechunkDocument(document: Document, options: ChunkingOptions): DocumentChunk[];
  
  // Get chunking statistics
  getChunkingStats(chunks: DocumentChunk[]): ChunkingStats;
}
```

## 🤝 Support

### Getting Help

- **Documentation**: Check this README and inline code documentation
- **Issues**: Open an issue on GitHub for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions and community support

### Troubleshooting

#### Common Issues

**"Unsupported file format"**
- Verify the file extension is supported
- Check if the file is corrupted
- Ensure proper file permissions

**"File parsing timeout"**
- Increase timeout in configuration
- Check available system memory
- Try processing smaller files first

**"Memory issues with large files"**
- Increase Node.js memory limit: `node --max-old-space-size=4096`
- Process files in smaller batches
- Enable streaming mode for large files

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Model Context Protocol** team for the MCP specification
- **Xenova/transformers** for JavaScript ML models
- **All contributors** who help improve this project

---

**Built with ❤️ for the AI and document processing community**
