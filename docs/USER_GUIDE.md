# MCP EPUB RAG Server User Guide

A comprehensive guide for using the MCP EPUB RAG Server for document processing and semantic search.

## Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [Document Processing](#document-processing)
- [Search Operations](#search-operations)
- [Advanced Features](#advanced-features)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [Use Cases](#use-cases)

## Quick Start

### 1. Basic Setup (5 minutes)

```bash
# Install the server
npm install -g mcp-epub-rag

# Prepare your documents
mkdir /path/to/documents
cp your-files.{epub,pdf,md,docx} /path/to/documents/

# Start the server
mcp-epub-rag
```

### 2. Initial Configuration

```json
{
  "tool": "configure",
  "arguments": {
    "documents": [
      "/path/to/documents/book1.epub",
      "/path/to/documents/research.pdf",
      "/path/to/documents/notes.md"
    ],
    "vectorDbPath": "/path/to/vector-database"
  }
}
```

### 3. Your First Search

```json
{
  "tool": "search", 
  "arguments": {
    "query": "artificial intelligence applications",
    "maxResults": 5
  }
}
```

## Installation

### Prerequisites

- **Node.js 18+**: Required for running the server
- **Memory**: Minimum 2GB RAM (4GB+ recommended for large document collections)
- **Storage**: Plan for ~10MB per 1000 document chunks for the vector database
- **Documents**: EPUB, PDF, DOCX, or Markdown files

### Installation Methods

#### Method 1: NPX (Recommended for testing)
```bash
npx mcp-epub-rag
```

#### Method 2: Global Installation
```bash
npm install -g mcp-epub-rag
mcp-epub-rag
```

#### Method 3: Local Development
```bash
git clone https://github.com/your-repo/mcp-epub-rag
cd mcp-epub-rag
npm install
npm start
```

### Verification

Test your installation:
```bash
# Check if server responds to tool listing
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | mcp-epub-rag
```

## Configuration

### Basic Configuration

The minimum required configuration:

```json
{
  "documents": ["/path/to/your/documents.epub"],
  "vectorDbPath": "/path/to/vector-db"
}
```

### Advanced Configuration

Full configuration with all options:

```json
{
  "documents": [
    "/home/user/books/fiction.epub",
    "/home/user/docs/research.pdf", 
    "/home/user/notes/summary.md"
  ],
  "vectorDbPath": "/home/user/vector-database",
  "embeddingModel": "Xenova/all-MiniLM-L6-v2",
  "chunkSize": 512,
  "chunkOverlap": 50,
  "maxResults": 10
}
```

### Configuration Parameters Explained

| Parameter | Default | Description | Recommendations |
|-----------|---------|-------------|-----------------|
| `documents` | Required | Array of document file paths | Use absolute paths |
| `vectorDbPath` | Required | Vector database storage location | Use SSD for better performance |
| `embeddingModel` | `Xenova/all-MiniLM-L6-v2` | Hugging Face model for embeddings | Faster models: `all-MiniLM-L6-v2`, Better quality: `all-mpnet-base-v2` |
| `chunkSize` | 512 | Characters per text chunk | 256-512 for precision, 1024+ for context |
| `chunkOverlap` | 50 | Character overlap between chunks | 10-20% of chunk size |
| `maxResults` | 10 | Default search result limit | Adjust based on use case |

### File Path Guidelines

- **Use absolute paths**: `/home/user/docs/file.pdf` instead of `./docs/file.pdf`
- **Avoid spaces**: Use underscores or hyphens instead of spaces in filenames
- **Check permissions**: Ensure the server can read all specified files
- **Organize logically**: Group related documents in the same directory

## Document Processing

### Supported Formats

#### EPUB Files
- **Best for**: Fiction, non-fiction books, structured content
- **Features**: Chapter extraction, metadata parsing, table of contents
- **Example**: Academic textbooks, novels, technical manuals

#### PDF Files  
- **Best for**: Research papers, reports, presentations
- **Features**: Text extraction, metadata parsing, handling of mixed content
- **Limitations**: Scanned PDFs require OCR (not included)

#### DOCX Files
- **Best for**: Microsoft Word documents, reports, articles
- **Features**: Text extraction, formatting preservation, metadata
- **Note**: Images and complex layouts are converted to text descriptions

#### Markdown Files
- **Best for**: Documentation, notes, technical writing
- **Features**: Header parsing, code block handling, link extraction
- **Formats**: `.md`, `.markdown`, `.mdown`, `.mkd`

### Processing Workflow

1. **Validation**: File existence, format, and security checks
2. **Parsing**: Content extraction and metadata collection
3. **Chunking**: Text segmentation with overlap
4. **Embedding**: Vector generation using transformer models
5. **Indexing**: Storage in vector database for search

### Monitoring Processing

Watch for these log messages during processing:

```
✓ Document parsed successfully: "Document Title"
✓ Generated embeddings for 45 chunks
✓ Document indexed: 45 chunks added to database
```

### Processing Performance

| Document Size | Processing Time | Memory Usage |
|---------------|-----------------|--------------|
| Small (< 1MB) | 5-15 seconds | 50-100MB |
| Medium (1-10MB) | 30-120 seconds | 100-200MB |
| Large (10-50MB) | 2-10 minutes | 200-500MB |

## Search Operations

### Basic Search

Simple text search across all documents:

```json
{
  "tool": "search",
  "arguments": {
    "query": "machine learning algorithms"
  }
}
```

### Advanced Search with Filters

Filter by file type and set result limits:

```json
{
  "tool": "search",
  "arguments": {
    "query": "neural networks deep learning",
    "maxResults": 15,
    "threshold": 0.7,
    "fileTypes": ["pdf", "epub"]
  }
}
```

### Search Parameters

#### Query (`query`)
- **Type**: String (required)
- **Max length**: 1000 characters
- **Tips**: 
  - Use natural language: "How do neural networks work?"
  - Include synonyms: "AI artificial intelligence machine learning"
  - Be specific: "Python pandas dataframe manipulation"

#### Max Results (`maxResults`)
- **Type**: Number (optional)
- **Default**: 10
- **Range**: 1-100
- **Tips**: Start with 5-10 results, increase for comprehensive searches

#### Threshold (`threshold`)
- **Type**: Number (optional)
- **Range**: 0.0-1.0
- **Purpose**: Minimum similarity score for results
- **Guidelines**:
  - 0.8+: Very similar content only
  - 0.6-0.8: Reasonably related content
  - 0.4-0.6: Loosely related content
  - <0.4: May include irrelevant results

#### File Types (`fileTypes`)
- **Type**: Array of strings (optional)
- **Values**: `["epub", "pdf", "docx", "md"]`
- **Example**: `["pdf", "epub"]` to search only academic papers and books

### Understanding Search Results

Each search result includes:

```json
{
  "score": 0.85,
  "document": {
    "title": "Introduction to Machine Learning",
    "filePath": "/docs/ml-book.pdf"
  },
  "relevantText": "Neural networks are computational models inspired by biological neural networks..."
}
```

- **Score**: Similarity confidence (0.0-1.0, higher is better)
- **Document**: Source document metadata
- **Relevant Text**: Most relevant excerpt from the chunk

### Search Optimization Tips

1. **Query Quality**:
   - Use complete thoughts: "What are the benefits of renewable energy?"
   - Include context: "Python machine learning scikit-learn"
   - Avoid very short queries: "AI" → "artificial intelligence applications"

2. **Result Filtering**:
   - Start broad, then narrow with filters
   - Use file type filters for domain-specific searches
   - Adjust threshold based on result quality

3. **Performance**:
   - Cache frequently used queries
   - Shorter queries generally perform faster
   - Results are cached for 30 minutes by default

## Advanced Features

### Batch Document Management

#### Adding New Documents
```json
{
  "tool": "add_documents",
  "arguments": {
    "filePaths": [
      "/new/documents/latest-research.pdf",
      "/new/documents/updated-manual.epub"
    ]
  }
}
```

#### Listing Documents
```json
{
  "tool": "list_documents",
  "arguments": {
    "fileType": "pdf"  // Optional filter
  }
}
```

#### Database Statistics
```json
{
  "tool": "get_stats",
  "arguments": {}
}
```

Example statistics output:
```
Database Statistics:
- Total Documents: 25
- Total Chunks: 2,847  
- Index Size: 127 MB
- Cache Hit Rate: 78%
- Average Search Time: 145 ms
- Memory Usage: 245 MB
```

### Performance Monitoring

Key metrics to monitor:

1. **Cache Hit Rate**: Should be >70% for good performance
2. **Average Search Time**: <500ms for responsive experience
3. **Memory Usage**: Monitor for memory leaks in long-running sessions
4. **Index Size**: Plan storage capacity (typically 10MB per 1000 chunks)

### Database Management

#### Clearing the Database
⚠️ **Warning**: This permanently deletes all processed documents and embeddings

```json
{
  "tool": "clear_database", 
  "arguments": {}
}
```

#### Backup and Recovery
- **Vector Database**: Back up the entire `vectorDbPath` directory
- **Configuration**: Save your configuration JSON for easy restoration
- **Documents**: Keep original source documents separately

## Best Practices

### Document Organization

1. **File Structure**:
   ```
   /documents/
   ├── books/
   │   ├── fiction/
   │   └── technical/
   ├── research/
   │   ├── papers/
   │   └── reports/
   └── notes/
       ├── meeting-notes/
       └── project-docs/
   ```

2. **Naming Conventions**:
   - Use descriptive names: `ml-textbook-2023.pdf`
   - Avoid special characters: use `-` or `_` instead of spaces
   - Include version numbers for updated documents

3. **Size Considerations**:
   - Keep individual files under 50MB for optimal performance
   - Split very large documents into logical sections
   - Consider processing time vs. search granularity

### Search Strategy

1. **Query Design**:
   - Start with broad queries, then refine
   - Use multiple related terms for better coverage
   - Include domain-specific terminology

2. **Result Evaluation**:
   - Review scores to gauge relevance quality
   - Adjust threshold based on result usefulness
   - Use file type filters for focused searches

3. **Iterative Refinement**:
   - Start with maxResults=5 for quick overview
   - Increase for comprehensive research
   - Combine multiple searches for complex topics

### Performance Optimization

1. **Hardware**:
   - Use SSD storage for vector database
   - Ensure adequate RAM (4GB+ for large collections)
   - Monitor CPU usage during initial processing

2. **Configuration**:
   - Adjust chunk size based on content type
   - Use smaller chunks (256) for precise searches
   - Use larger chunks (1024) for contextual searches

3. **Maintenance**:
   - Restart server periodically for memory cleanup
   - Monitor cache performance and adjust if needed
   - Clean up unused vector database files

## Troubleshooting

### Common Issues and Solutions

#### "File not found" Errors
```
Error: Invalid document paths: /path/to/file.pdf: File does not exist
```
**Solutions**:
- Verify file paths are absolute and correct
- Check file permissions (server needs read access)
- Ensure files haven't been moved or deleted

#### "Unsupported format" Errors
```
Error: File format '.txt' is not supported
```
**Solutions**:
- Convert to supported format (MD for text files)
- Check file extension matches content
- Verify file is not corrupted

#### Processing Timeout
```
Error: Processing timeout after 30 seconds
```
**Solutions**:
- Reduce batch size (fewer documents at once)
- Split large documents into smaller files
- Increase available memory
- Check system resources

#### Poor Search Results
**Symptoms**: Low scores, irrelevant results
**Solutions**:
- Lower similarity threshold (try 0.5 instead of 0.7)
- Rephrase query with more specific terms
- Check if documents were processed correctly
- Verify embedding model is appropriate for content type

#### Memory Issues
```
Error: JavaScript heap out of memory
```
**Solutions**:
- Process documents in smaller batches
- Restart server to clear memory
- Reduce chunk size to decrease memory usage
- Increase Node.js memory limit: `node --max-old-space-size=4096`

### Debug Mode

Enable detailed logging for troubleshooting:
```bash
NODE_ENV=development DEBUG=* mcp-epub-rag
```

This provides detailed information about:
- Document parsing steps
- Embedding generation progress
- Search query processing
- Cache hit/miss ratios
- Performance metrics

### Getting Help

1. **Check Logs**: Review console output for specific error messages
2. **Verify Configuration**: Ensure all required parameters are provided
3. **Test with Simple Cases**: Try with a single small document first
4. **Check Resources**: Monitor memory and disk space usage
5. **Consult Documentation**: Review API documentation for parameter details

## Use Cases

### 1. Research and Academia

**Scenario**: Academic researcher with collection of papers and books

```json
{
  "tool": "configure",
  "arguments": {
    "documents": [
      "/research/papers/ml-survey-2023.pdf",
      "/research/papers/neural-networks-review.pdf", 
      "/research/books/deep-learning-textbook.epub"
    ],
    "vectorDbPath": "/research/vector-db",
    "chunkSize": 1024,
    "chunkOverlap": 100
  }
}
```

**Search Examples**:
- "gradient descent optimization techniques"
- "convolutional neural network architectures"
- "transformer attention mechanisms"

### 2. Documentation Management

**Scenario**: Software team with technical documentation

```json
{
  "tool": "configure", 
  "arguments": {
    "documents": [
      "/docs/api-reference.md",
      "/docs/user-guide.md",
      "/docs/deployment-guide.pdf"
    ],
    "vectorDbPath": "/docs/vector-db",
    "chunkSize": 512,
    "chunkOverlap": 50
  }
}
```

**Search Examples**:
- "authentication middleware configuration"
- "database migration procedures"
- "error handling best practices"

### 3. Legal Document Analysis

**Scenario**: Law firm with contracts and legal documents

```json
{
  "tool": "configure",
  "arguments": {
    "documents": [
      "/legal/contracts/vendor-agreements/*.pdf",
      "/legal/policies/privacy-policy.docx",
      "/legal/precedents/case-law.epub"
    ],
    "vectorDbPath": "/legal/vector-db",
    "chunkSize": 2048,
    "chunkOverlap": 200
  }
}
```

**Search Examples**:
- "termination clauses liability"
- "data protection compliance requirements"
- "intellectual property licensing terms"

### 4. Personal Knowledge Management

**Scenario**: Individual with personal library and notes

```json
{
  "tool": "configure",
  "arguments": {
    "documents": [
      "/library/ebooks/*.epub",
      "/notes/meeting-notes/*.md",
      "/reference/manuals/*.pdf"
    ],
    "vectorDbPath": "/personal/vector-db",
    "chunkSize": 768,
    "chunkOverlap": 75
  }
}
```

**Search Examples**:
- "project management methodologies"
- "cooking techniques for beginners"
- "investment strategies retirement planning"

---

*This user guide covers practical usage of the MCP EPUB RAG Server. For technical details, see the [API Documentation](API.md).*