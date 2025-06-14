# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development Commands
```bash
# Build the project
npm run build

# Development with hot reload
npm run dev

# Start the built server
npm start

# Type checking
npm run type-check
```

### Testing Commands
```bash
# Run all tests with coverage (ALWAYS use this - maintains >95% coverage requirement)
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests  
npm run test:integration

# Watch mode for development
npm run test:watch

# Interactive test UI
npm run test:ui
```

### Code Quality Commands
```bash
# Lint and auto-fix (ALWAYS run before committing)
npm run lint

# Check formatting
npm run format:check

# Format code
npm run format

# Full validation (type-check + lint + format + test coverage)
npm run validate
```

## Project Architecture

This is a **Model Context Protocol (MCP) server** for document Retrieval-Augmented Generation (RAG) that processes EPUB, PDF, DOCX, and Markdown documents for semantic search.

### Core Pipeline Architecture
The system follows a **pipeline-based architecture** with these layers:

1. **Document Processing** (`src/parsers/`)
   - `BaseDocumentParser`: Abstract base with template method pattern
   - `DocumentParser`: Facade that orchestrates format-specific parsers
   - Format-specific parsers: `EpubParser`, `PdfParser`, `DocxParser`, `MarkdownParser`

2. **Text Processing** (`src/services/`)
   - `ChunkingService`: Converts documents into searchable chunks with intelligent segmentation
   - `EmbeddingService`: Generates vector embeddings using Hugging Face transformers
   - `VectorDatabaseService`: Manages vector storage and semantic search using Vectra

3. **MCP Server** (`src/index.ts`)
   - Main server implementing MCP protocol
   - Provides tools: configure, search, add_documents, list_documents, get_stats, clear_database

### Data Flow
```
Document Input → DocumentParser → ChunkingService → EmbeddingService → VectorDatabaseService → Search Results
```

### Key Design Patterns
- **Factory Pattern**: DocumentParser registry for format-specific parsers
- **Template Method**: BaseDocumentParser workflow (validate → parse → post-process)  
- **Strategy Pattern**: Configurable chunking strategies
- **Repository Pattern**: VectorDatabaseService abstracts storage operations

## Code Quality Standards

### File Size Limit
- **ALWAYS** split TypeScript files longer than 200 lines
- Current architecture supports this with clear service boundaries

### Test Coverage
- **ALWAYS** maintain >95% code coverage (enforced by vitest.config.ts)
- **ALWAYS** run full test suite after each task: `npm run test:coverage`

### Import Path Aliases
Use configured path aliases for clean imports:
```typescript
import { DocumentParser } from '@/parsers/documentParser';
import { ChunkingService } from '@/services/chunkingService';
import { validateFilePath } from '@/utils/helpers';
import { Config } from '@/types';
import { DocumentProcessingError } from '@/errors';
```

### Error Handling
Use typed error classes from `@/errors/`:
- `DocumentProcessingError`: Document parsing failures
- `EmbeddingError`: Vector generation issues  
- `VectorDatabaseError`: Index and search problems

### TypeScript Configuration
- **Strict mode enabled** with comprehensive type checking
- **No implicit any** - all types must be explicit
- **Exact optional properties** - strict object typing
- **No unused locals/parameters** - clean code enforcement

## MCP Protocol Implementation

### Available Tools
1. **configure**: Initialize server with document paths and settings
2. **search**: Semantic search through vectorized documents
3. **add_documents**: Add new documents to vector database
4. **list_documents**: List all indexed documents  
5. **get_stats**: Get database statistics
6. **clear_database**: Remove all documents

### Testing MCP Server
The server runs on stdio transport and can be tested with MCP clients or through integration tests in `tests/integration/`.

## Dependencies and Services

### Core Dependencies
- `@modelcontextprotocol/sdk`: MCP protocol implementation
- `@xenova/transformers`: Hugging Face transformers for embeddings
- `vectra`: Local vector database
- `pino`: Structured logging
- `zod`: Runtime type validation

### Document Processing
- `epub2`: EPUB parsing
- `pdf-parse-debugging-disabled`: PDF text extraction
- `mammoth`: DOCX to HTML conversion
- `marked`: Markdown parsing

### Development Quality
- `vitest`: Fast testing framework with coverage
- `eslint`: Comprehensive linting with security rules
- `typescript`: Strict type checking
- `prettier`: Code formatting