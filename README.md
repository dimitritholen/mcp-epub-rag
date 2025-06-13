# MCP EPUB RAG Server

A Model Context Protocol (MCP) server that provides document RAG (Retrieval Augmented Generation) capabilities for EPUB, PDF, MOBI, DOCX, and Markdown files.

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
  - [Using npx (Recommended)](#using-npx-recommended)
  - [Installation](#installation)
  - [MCP Client Configuration](#mcp-client-configuration)
- [Configuration](#configuration)
  - [Configuration Parameters](#configuration-parameters)
  - [Supported Embedding Models](#supported-embedding-models)
- [Available Tools](#available-tools)
- [Supported File Types](#supported-file-types)
- [Requirements](#requirements)
- [Development](#development)
- [What Gets Created Automatically](#what-gets-created-automatically)
- [Persistent Storage](#persistent-storage)
- [Zero Configuration Required](#zero-configuration-required)
- [What Happens During Configuration](#what-happens-during-configuration)
- [License](#license)

## Features

- **Multi-format support**: EPUB, PDF, MOBI, DOCX, and Markdown files
- **Vector search**: Semantic search using embeddings
- **Chunking**: Intelligent text chunking with configurable size and overlap
- **MCP integration**: Full Model Context Protocol compliance
- **Easy setup**: Install and run with npx

## Quick Start

### Using npx (Recommended)

```bash
npx @mcp-epub-rag/server@latest
```

### Installation

```bash
npm install -g @mcp-epub-rag/server
mcp-epub-rag
```

### MCP Client Configuration

Add this to your MCP client configuration file:

```json
{
  "mcpServers": {
    "mcp-epub-rag": {
      "command": "npx",
      "args": ["-y", "@mcp-epub-rag/server@latest"]
    }
  }
}
```

Or if you installed globally:

```json
{
  "mcpServers": {
    "mcp-epub-rag": {
      "command": "mcp-epub-rag"
    }
  }
}
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

### Configuration Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `documents` | `string[]` | ✅ Yes | - | Array of file paths or glob patterns to documents |
| `vectorDbPath` | `string` | ✅ Yes | - | Path where vector database will be stored |
| `embeddingModel` | `string` | ✅ Yes | - | Hugging Face model for embeddings |
| `chunkSize` | `number` | ❌ No | `512` | Size of text chunks for processing |
| `chunkOverlap` | `number` | ❌ No | `50` | Overlap between consecutive chunks |
| `maxResults` | `number` | ❌ No | `10` | Maximum search results to return |

### Supported Embedding Models

- `Xenova/all-MiniLM-L6-v2` (Recommended - Fast and efficient)
- `Xenova/all-mpnet-base-v2` (Higher quality, slower)
- `Xenova/distilbert-base-uncased`
- Any compatible Hugging Face embedding model

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