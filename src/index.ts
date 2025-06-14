#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import path from 'path';

import { DocumentParser } from './parsers/documentParser.js';
import { ChunkingService } from './services/chunkingService.js';
import { EmbeddingService } from './services/embeddingService.js';
import { VectorDatabaseService } from './services/vectorDatabaseService.js';
import {
  Config,
  ConfigSchema,
  SearchToolArgsSchema,
  AddDocumentsToolArgsSchema,
  ListDocumentsToolArgsSchema
} from './types.js';
import {
  validateFilePath,
  isSupportedFileType,
  formatFileSize,
  formatDuration,
  getCurrentTimestamp,
  SECURITY_LIMITS,
  validateSearchQuery,
  sanitizeContent
} from './utils/helpers.js';

class MCPEpubRAGServer {
  private server: Server;
  private config: Config | null = null;
  private documentParser: DocumentParser;
  private chunkingService: ChunkingService;
  private embeddingService: EmbeddingService | null = null;
  private vectorDbService: VectorDatabaseService | null = null;
  private isInitialized = false;

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-epub-rag',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.documentParser = new DocumentParser();
    this.chunkingService = new ChunkingService();

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'configure',
            description: 'Configure the RAG server with document paths and settings',
            inputSchema: {
              type: 'object',
              properties: {
                documents: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of file paths to documents (*.epub, *.pdf, *.mobi, *.docx, *.md)'
                },
                vectorDbPath: {
                  type: 'string',
                  description: 'Path where the vector database will be stored'
                },
                embeddingModel: {
                  type: 'string',
                  default: 'Xenova/all-MiniLM-L6-v2',
                  description: 'Hugging Face model for embeddings'
                },
                chunkSize: {
                  type: 'number',
                  default: 512,
                  description: 'Size of text chunks for vectorization'
                },
                chunkOverlap: {
                  type: 'number',
                  default: 50,
                  description: 'Overlap between chunks'
                },
                maxResults: {
                  type: 'number',
                  default: 10,
                  description: 'Maximum number of search results to return'
                }
              },
              required: ['documents', 'vectorDbPath']
            }
          },
          {
            name: 'search',
            description: 'Search through the vectorized documents using semantic similarity',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query text'
                },
                maxResults: {
                  type: 'number',
                  default: 10,
                  description: 'Maximum number of results to return'
                },
                threshold: {
                  type: 'number',
                  description: 'Minimum similarity threshold (0-1)'
                },
                fileTypes: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filter by file types (epub, pdf, mobi, docx, md)'
                }
              },
              required: ['query']
            }
          },
          {
            name: 'add_documents',
            description: 'Add new documents to the vector database',
            inputSchema: {
              type: 'object',
              properties: {
                filePaths: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of file paths to add'
                }
              },
              required: ['filePaths']
            }
          },
          {
            name: 'list_documents',
            description: 'List all documents in the vector database',
            inputSchema: {
              type: 'object',
              properties: {
                fileType: {
                  type: 'string',
                  description: 'Filter by file type (epub, pdf, mobi, docx, md)'
                }
              }
            }
          },
          {
            name: 'get_stats',
            description: 'Get statistics about the vector database',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'clear_database',
            description: 'Clear all documents from the vector database',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'configure':
            return await this.handleConfigure(args);
          case 'search':
            return await this.handleSearch(args);
          case 'add_documents':
            return await this.handleAddDocuments(args);
          case 'list_documents':
            return await this.handleListDocuments(args);
          case 'get_stats':
            return await this.handleGetStats();
          case 'clear_database':
            return await this.handleClearDatabase();
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new McpError(ErrorCode.InternalError, errorMessage);
      }
    });
  }

  private async handleConfigure(args: any) {
    try {
      // Validate configuration
      this.config = ConfigSchema.parse(args);
      
      // Validate batch size
      if (this.config.documents.length > SECURITY_LIMITS.MAX_BATCH_SIZE) {
        throw new Error(`Too many documents (max ${SECURITY_LIMITS.MAX_BATCH_SIZE})`);
      }
      
      // Validate document paths
      const invalidPaths: string[] = [];
      const validPaths: string[] = [];
      
      for (const filePath of this.config.documents) {
        const validation = await validateFilePath(filePath);
        if (!validation.isValid || !validation.exists || !validation.isFile) {
          invalidPaths.push(`${filePath}: ${validation.error}`);
        } else if (!isSupportedFileType(filePath)) {
          invalidPaths.push(`${filePath}: Unsupported file type`);
        } else {
          validPaths.push(filePath);
        }
      }
      
      if (invalidPaths.length > 0) {
        throw new Error(`Invalid document paths:\n${invalidPaths.join('\n')}`);
      }
      
      // Initialize services
      await this.initializeServices();
      
      // Process documents
      const results = await this.processDocuments(validPaths);
      
      this.isInitialized = true;
      
      return {
        content: [
          {
            type: 'text',
            text: `RAG server configured successfully!\n\n` +
                  `Configuration:\n` +
                  `- Documents: ${this.config.documents.length}\n` +
                  `- Vector DB Path: ${this.config.vectorDbPath}\n` +
                  `- Embedding Model: ${this.config.embeddingModel}\n` +
                  `- Chunk Size: ${this.config.chunkSize}\n` +
                  `- Chunk Overlap: ${this.config.chunkOverlap}\n\n` +
                  `Processing Results:\n` +
                  `- Successfully processed: ${results.successful}\n` +
                  `- Failed: ${results.failed}\n` +
                  `- Total chunks: ${results.totalChunks}\n` +
                  `- Processing time: ${formatDuration(results.processingTime)}`
          }
        ]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Configuration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async handleSearch(args: unknown) {
    this.ensureInitialized();
    
    try {
      // Validate arguments using Zod schema
      const validatedArgs = SearchToolArgsSchema.parse(args);
      
      // Additional query validation and sanitization
      const queryValidation = validateSearchQuery(validatedArgs.query);
      if (!queryValidation.isValid) {
        throw new McpError(ErrorCode.InvalidParams, queryValidation.error || 'Invalid query');
      }
      
      // Validate maxResults if provided
      if (validatedArgs.maxResults && validatedArgs.maxResults > SECURITY_LIMITS.MAX_BATCH_SIZE) {
        throw new McpError(ErrorCode.InvalidParams, `Max results cannot exceed ${SECURITY_LIMITS.MAX_BATCH_SIZE}`);
      }
      
      const startTime = Date.now();
      const searchQuery: any = {
        query: queryValidation.sanitized,
        maxResults: validatedArgs.maxResults || this.config!.maxResults
      };
      
      if (validatedArgs.threshold !== undefined) {
        searchQuery.threshold = validatedArgs.threshold;
      }
      
      if (validatedArgs.fileTypes) {
        searchQuery.filters = { fileTypes: validatedArgs.fileTypes };
      }
      
      const results = await this.vectorDbService!.search(searchQuery);
      
      const searchTime = Date.now() - startTime;
      
      const resultText = results.length > 0 
        ? results.map((result, index) => 
            `**Result ${index + 1}** (Score: ${result.score.toFixed(3)})\n` +
            `Document: ${sanitizeContent(result.document.title)}\n` +
            `File: ${path.basename(result.document.metadata.filePath)}\n` +
            `Content: ${sanitizeContent(result.relevantText)}\n`
          ).join('\n---\n\n')
        : 'No results found.';
      
      return {
        content: [
          {
            type: 'text',
            text: `Search Results for: "${sanitizeContent(queryValidation.sanitized)}"\n\n` +
                  `Found ${results.length} results in ${searchTime}ms\n\n` +
                  resultText
          }
        ]
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new McpError(ErrorCode.InvalidParams, 
          `Validation failed: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  private async handleAddDocuments(args: unknown) {
    this.ensureInitialized();
    
    try {
      // Validate arguments using Zod schema
      const validatedArgs = AddDocumentsToolArgsSchema.parse(args);
      
      // Validate batch size
      if (validatedArgs.filePaths.length > SECURITY_LIMITS.MAX_BATCH_SIZE) {
        throw new McpError(ErrorCode.InvalidParams, 
          `Too many files (max ${SECURITY_LIMITS.MAX_BATCH_SIZE})`);
      }
      
      const results = await this.processDocuments(validatedArgs.filePaths);
      
      return {
        content: [
          {
            type: 'text',
            text: `Document Addition Results:\n\n` +
                  `- Successfully processed: ${results.successful}\n` +
                  `- Failed: ${results.failed}\n` +
                  `- Total chunks added: ${results.totalChunks}\n` +
                  `- Processing time: ${formatDuration(results.processingTime)}`
          }
        ]
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new McpError(ErrorCode.InvalidParams, 
          `Validation failed: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  private async handleListDocuments(args: unknown) {
    this.ensureInitialized();
    
    try {
      // Validate arguments using Zod schema
      const validatedArgs = ListDocumentsToolArgsSchema.parse(args);
      
      const documents = await this.vectorDbService!.getDocuments();
      const filteredDocs = validatedArgs.fileType 
        ? documents.filter(doc => doc.metadata.fileType === validatedArgs.fileType)
        : documents;
      
      // Apply limit if specified
      const limitedDocs = validatedArgs.limit 
        ? filteredDocs.slice(validatedArgs.offset || 0, (validatedArgs.offset || 0) + validatedArgs.limit)
        : filteredDocs;
      
      const docList = limitedDocs.map(doc => 
        `- **${sanitizeContent(doc.title)}**\n` +
        `  File: ${path.basename(doc.metadata.filePath)}\n` +
        `  Type: ${doc.metadata.fileType}\n` +
        `  Size: ${formatFileSize(doc.metadata.fileSize)}\n` +
        `  Chunks: ${doc.chunks.length}\n` +
        `  Modified: ${doc.metadata.lastModified.toLocaleDateString()}`
      ).join('\n\n');
      
      return {
        content: [
          {
            type: 'text',
            text: `Documents in Database (${limitedDocs.length}${validatedArgs.limit ? ` of ${filteredDocs.length}` : ''} total):\n\n` +
                  (docList || 'No documents found.')
          }
        ]
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new McpError(ErrorCode.InvalidParams, 
          `Validation failed: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  private async handleGetStats() {
    this.ensureInitialized();
    
    const stats = await this.vectorDbService!.getStats();
    const modelInfo = this.embeddingService!.getModelInfo();
    
    return {
      content: [
        {
          type: 'text',
          text: `Vector Database Statistics:\n\n` +
                `- Total Documents: ${stats.totalDocuments}\n` +
                `- Total Chunks: ${stats.totalChunks}\n` +
                `- Index Size: ${formatFileSize(stats.indexSize)}\n` +
                `- Embedding Model: ${modelInfo.name}\n` +
                `- Model Status: ${modelInfo.isInitialized ? 'Ready' : 'Not Initialized'}\n` +
                `- Database Path: ${this.config?.vectorDbPath}\n` +
                `- Last Updated: ${getCurrentTimestamp()}`
        }
      ]
    };
  }

  private async handleClearDatabase() {
    this.ensureInitialized();
    
    await this.vectorDbService!.clear();
    
    return {
      content: [
        {
          type: 'text',
          text: 'Vector database cleared successfully. All documents and embeddings have been removed.'
        }
      ]
    };
  }

  private async initializeServices(): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration not set');
    }
    
    // Initialize embedding service
    this.embeddingService = new EmbeddingService({
      modelName: this.config.embeddingModel,
      batchSize: 10,
      normalize: true
    });
    
    await this.embeddingService.initialize();
    
    // Initialize vector database service
    this.vectorDbService = new VectorDatabaseService(
      {
        indexPath: this.config.vectorDbPath
      },
      this.embeddingService
    );
    
    await this.vectorDbService.initialize();
  }

  private async processDocuments(filePaths: string[]): Promise<{
    successful: number;
    failed: number;
    totalChunks: number;
    processingTime: number;
  }> {
    const startTime = Date.now();
    let successful = 0;
    let failed = 0;
    let totalChunks = 0;
    
    for (const filePath of filePaths) {
      try {
        console.log(`Processing: ${filePath}`);
        
        // Parse document
        const document = await this.documentParser.parseDocument(filePath);
        
        // Chunk document
        const chunks = this.chunkingService.chunkDocument(document, {
          chunkSize: this.config!.chunkSize,
          chunkOverlap: this.config!.chunkOverlap
        });
        
        // Generate embeddings
        const embeddedChunks = await this.embeddingService!.embedChunks(chunks);
        
        // Add to vector database
        document.chunks = embeddedChunks;
        await this.vectorDbService!.addDocument(document, embeddedChunks);
        
        successful++;
        totalChunks += embeddedChunks.length;
        
        console.log(`✓ Processed: ${document.title} (${embeddedChunks.length} chunks)`);
      } catch (error) {
        failed++;
        console.error(`✗ Failed to process ${filePath}:`, error);
      }
    }
    
    const processingTime = Date.now() - startTime;
    
    return {
      successful,
      failed,
      totalChunks,
      processingTime
    };
  }

  private ensureInitialized(): void {
    if (!this.isInitialized || !this.config || !this.vectorDbService || !this.embeddingService) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'Server not configured. Please call configure tool first.'
      );
    }
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP EPUB RAG Server running on stdio');
  }
}

// Start the server
const server = new MCPEpubRAGServer();
server.run().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});