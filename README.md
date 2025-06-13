# MCP EPUB RAG Server

A Model Context Protocol (MCP) server that provides Retrieval-Augmented Generation (RAG) capabilities for document collections. This server can process EPUB, PDF, MOBI, DOCX, and Markdown files, vectorize their content using local embeddings, and provide semantic search functionality.

## Features

- **Multi-format Support**: Process EPUB, PDF, MOBI, DOCX, and Markdown files
- **Local Vector Database**: Uses Vectra for fast, local vector storage
- **Local Embeddings**: Runs embedding models locally using Transformers.js
- **Semantic Search**: Find relevant content using natural language queries
- **Configurable Chunking**: Customizable text chunking with overlap
- **MCP Integration**: Seamlessly integrates with MCP-compatible AI assistants
- **TypeScript**: Fully typed for better development experience

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Vector Database**: Vectra (local)
- **Embeddings**: Transformers.js with Hugging Face models
- **Document Parsing**:
  - PDF: pdf-parse
  - EPUB: epub2
  - DOCX: mammoth
  - Markdown: marked
  - MOBI: Not yet supported (convert to EPUB)
- **MCP SDK**: @modelcontextprotocol/sdk

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd mcp-epub-rag
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the project**:
   ```bash
   npm run build
   ```

## Usage

### Running the Server

The server runs as an MCP server using stdio transport:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

### MCP Configuration

Add this server to your MCP client configuration. For example, in Claude Desktop:

```json
{
  "mcpServers": {
    "epub-rag": {
      "command": "node",
      "args": ["/path/to/mcp-epub-rag/dist/index.js"]
    }
  }
}
```

### Available Tools

#### 1. `configure`
Initialize the RAG server with your document collection.

**Parameters**:
- `documents` (required): Array of file paths to documents
- `vectorDbPath` (required): Path where vector database will be stored
- `embeddingModel` (optional): Hugging Face model name (default: "Xenova/all-MiniLM-L6-v2")
- `chunkSize` (optional): Text chunk size (default: 512)
- `chunkOverlap` (optional): Overlap between chunks (default: 50)
- `maxResults` (optional): Maximum search results (default: 10)

**Example**:
```json
{
  "documents": [
    "/path/to/book1.epub",
    "/path/to/document.pdf",
    "/path/to/notes.md"
  ],
  "vectorDbPath": "/path/to/vector-db",
  "embeddingModel": "Xenova/all-MiniLM-L6-v2",
  "chunkSize": 512,
  "chunkOverlap": 50
}
```

#### 2. `search`
Search through vectorized documents using semantic similarity.

**Parameters**:
- `query` (required): Search query text
- `maxResults` (optional): Maximum number of results
- `threshold` (optional): Minimum similarity threshold (0-1)
- `fileTypes` (optional): Filter by file types

**Example**:
```json
{
  "query": "machine learning algorithms",
  "maxResults": 5,
  "threshold": 0.7,
  "fileTypes": ["pdf", "md"]
}
```

#### 3. `add_documents`
Add new documents to the existing vector database.

**Parameters**:
- `filePaths` (required): Array of file paths to add

#### 4. `list_documents`
List all documents in the vector database.

**Parameters**:
- `fileType` (optional): Filter by file type

#### 5. `get_stats`
Get statistics about the vector database.

#### 6. `clear_database`
Clear all documents from the vector database.

## Supported File Formats

| Format | Extension | Status | Notes |
|--------|-----------|--------|---------|
| EPUB | `.epub` | ✅ Supported | Full text extraction |
| PDF | `.pdf` | ✅ Supported | Text extraction (no OCR) |
| DOCX | `.docx` | ✅ Supported | Full text extraction |
| Markdown | `.md` | ✅ Supported | Full text extraction |
| MOBI | `.mobi` | ❌ Not yet | Convert to EPUB |

## Configuration Options

### Embedding Models

Supported Hugging Face models (automatically downloaded):
- `Xenova/all-MiniLM-L6-v2` (default) - Fast, good quality
- `Xenova/all-mpnet-base-v2` - Higher quality, slower
- `Xenova/distilbert-base-uncased` - Lightweight option

### Chunking Strategy

- **Chunk Size**: Number of characters per chunk (default: 512)
- **Chunk Overlap**: Characters to overlap between chunks (default: 50)
- **Sentence Preservation**: Attempts to break at sentence boundaries
- **Paragraph Preservation**: Respects paragraph breaks when possible

## Development

### Project Structure

```
src/
├── index.ts                 # Main MCP server
├── types.ts                 # TypeScript type definitions
├── parsers/
│   └── documentParser.ts    # Document parsing logic
├── services/
│   ├── chunkingService.ts   # Text chunking
│   ├── embeddingService.ts  # Embedding generation
│   └── vectorDatabaseService.ts # Vector storage and search
└── utils/
    └── helpers.ts           # Utility functions
```

### Scripts

- `npm run build` - Build TypeScript to JavaScript
- `npm run dev` - Run in development mode with auto-reload
- `npm start` - Run the built server
- `npm test` - Run tests (when implemented)
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Adding New Document Formats

1. Add parser logic to `src/parsers/documentParser.ts`
2. Update supported extensions in the parser
3. Add the new format to type definitions
4. Update documentation

## Performance Considerations

- **First Run**: Initial model download and document processing can take time
- **Memory Usage**: Large document collections require more RAM
- **Storage**: Vector database size depends on document count and embedding dimensions
- **Search Speed**: Typically sub-second for collections under 10,000 chunks

## Troubleshooting

### Common Issues

1. **Model Download Fails**
   - Check internet connection
   - Ensure sufficient disk space
   - Try a different embedding model

2. **Document Parsing Errors**
   - Verify file paths are correct
   - Check file permissions
   - Ensure files are not corrupted

3. **Memory Issues**
   - Reduce chunk size
   - Process documents in smaller batches
   - Use a lighter embedding model

4. **Search Returns No Results**
   - Check if documents were processed successfully
   - Lower the similarity threshold
   - Try different query phrasing

### Debug Mode

Run with debug logging:

```bash
NODE_ENV=development npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Roadmap

- [ ] MOBI format support
- [ ] OCR support for scanned PDFs
- [ ] Multiple embedding model support
- [ ] Advanced filtering options
- [ ] Batch processing optimization
- [ ] Web interface for management
- [ ] Export/import functionality
- [ ] Incremental updates
- [ ] Multi-language support

## Support

For issues and questions:
1. Check the troubleshooting section
2. Search existing GitHub issues
3. Create a new issue with detailed information

---

**Note**: This server requires Node.js 18+ and works best with modern MCP-compatible AI assistants.