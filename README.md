# MCP EPUB RAG Server

A Model Context Protocol (MCP) server that provides document RAG (Retrieval Augmented Generation) capabilities for EPUB, PDF, MOBI, DOCX, and Markdown files.

## Features

- **Multi-format support**: EPUB, PDF, MOBI, DOCX, and Markdown files
- **Vector search**: Semantic search using embeddings
- **Chunking**: Intelligent text chunking with configurable size and overlap
- **MCP integration**: Full Model Context Protocol compliance
- **Easy setup**: Install and run with npx

## Quick Start

### Using npx (Recommended)

```bash
npx @mcp-epub-rag/server
```

### Installation

```bash
npm install -g @mcp-epub-rag/server
mcp-epub-rag
```

## Configuration

The server requires configuration before use. Use the `configure` tool with the following parameters:

```json
{
  "documents": ["path/to/your/documents/*.epub", "path/to/your/documents/*.pdf"],
  "vectorDbPath": "./vector-db",
  "embeddingModel": "Xenova/all-MiniLM-L6-v2",
  "chunkSize": 512,
  "chunkOverlap": 50,
  "maxResults": 10
}
```

## Available Tools

### configure
Initialize the server with document paths and settings.

### search
Perform semantic search across your documents.

### add_documents
Add new documents to the vector database.

### list_documents
List all indexed documents with optional filtering.

### get_stats
Get statistics about the vector database.

### clear_database
Clear all documents from the vector database.

## Supported File Types

- **EPUB**: Electronic publication format
- **PDF**: Portable Document Format
- **MOBI**: Amazon Kindle format
- **DOCX**: Microsoft Word documents
- **MD**: Markdown files

## Requirements

- Node.js 18.0.0 or higher
- Sufficient disk space for vector database storage

## Development

```bash
# Clone the repository
git clone <repository-url>
cd mcp-epub-rag

# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev
```

## License

MIT License - see LICENSE file for details.