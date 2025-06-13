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

## What Gets Created Automatically

When you configure the server with vectorDbPath: "./vector-db" , it creates:

```
vector-db/
├── index.json          # Vector index data
├── metadata.json       # Document and 
chunk metadata
└── [other index files] # Additional Vectra 
index files
```

## Persistent Storage

The database automatically:

- Saves metadata after each document addition
  
- Persists vectors to disk
  
- Loads existing data on restart
  
- Maintains document relationships
  
## Zero Configuration Required
  
  Users don't need to:
  
- ❌ Create database schemas
  
- ❌ Set up tables or collections
  
- ❌ Configure database connections
  
- ❌ Manage database files manually
  
 ## What Happens During Configuration
  

1. User provides vectorDbPath in configuration
2. Server creates the directory automatically
3. Vector index is initialized
4. Documents are processed and stored
5. Database is ready for semantic search



## License

MIT License - see LICENSE file for details.