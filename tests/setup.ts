import { beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
export const TEST_CONFIG = {
  dataDir: path.join(__dirname, 'data'),
  tempDir: path.join(__dirname, 'temp'),
  vectorDbDir: path.join(__dirname, 'temp', 'vectordb'),
  cacheDir: path.join(__dirname, 'temp', 'cache'),
  logDir: path.join(__dirname, 'temp', 'logs'),
  timeout: 30000,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  chunkSize: 512,
  chunkOverlap: 50
};

// Mock console to reduce test noise
const mockConsole = {
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  trace: vi.fn(),
  table: vi.fn(),
  group: vi.fn(),
  groupEnd: vi.fn(),
  time: vi.fn(),
  timeEnd: vi.fn()
};

// Test data generators
export class TestDataGenerator {
  static generateMarkdown(options: {
    title?: string;
    content?: string;
    frontmatter?: Record<string, unknown>;
    sections?: number;
  } = {}): string {
    const {
      title = 'Test Document',
      content = 'This is test content.',
      frontmatter,
      sections = 1
    } = options;

    let markdown = '';

    // Add frontmatter if provided
    if (frontmatter) {
      markdown += '---\n';
      for (const [key, value] of Object.entries(frontmatter)) {
        markdown += `${key}: ${value}\n`;
      }
      markdown += '---\n\n';
    }

    // Add title
    markdown += `# ${title}\n\n`;

    // Add content sections
    for (let i = 0; i < sections; i++) {
      markdown += `## Section ${i + 1}\n\n`;
      markdown += `${content} Section ${i + 1} specific content.\n\n`;
    }

    return markdown;
  }

  static generateLargeText(sizeInKB: number): string {
    const baseText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ';
    const targetSize = sizeInKB * 1024;
    const repetitions = Math.ceil(targetSize / baseText.length);
    return baseText.repeat(repetitions).slice(0, targetSize);
  }

  static createFakePdfBuffer(content: string = 'fake pdf content'): Buffer {
    return Buffer.concat([
      Buffer.from('%PDF-1.4\n'),
      Buffer.from(content)
    ]);
  }

  static createFakeZipBuffer(content: string = 'fake zip content'): Buffer {
    return Buffer.concat([
      Buffer.from([0x50, 0x4B]), // PK signature
      Buffer.from(content)
    ]);
  }
}

// Mock data factory
export class MockDataFactory {
  static createDocument(overrides: Partial<any> = {}): any {
    return {
      id: 'test-doc-id',
      title: 'Test Document',
      content: 'This is test document content.',
      metadata: {
        filePath: '/test/path/document.md',
        fileType: 'md',
        createdAt: new Date('2023-01-01'),
        lastModified: new Date('2023-01-02'),
        fileSize: 1024,
        wordCount: 10,
        language: 'en'
      },
      chunks: [],
      ...overrides
    };
  }

  static createChunk(overrides: Partial<any> = {}): any {
    return {
      id: 'test-chunk-id',
      documentId: 'test-doc-id',
      content: 'This is a test chunk.',
      startIndex: 0,
      endIndex: 20,
      embedding: new Array(384).fill(0.1),
      metadata: {
        chunkIndex: 0,
        wordCount: 5
      },
      ...overrides
    };
  }

  static createSearchResult(overrides: Partial<any> = {}): any {
    return {
      chunk: MockDataFactory.createChunk(),
      document: MockDataFactory.createDocument(),
      score: 0.85,
      relevantText: 'This is relevant text.',
      highlights: ['relevant', 'text'],
      ...overrides
    };
  }
}

// Test file utilities
export class TestFileUtils {
  static async createTestFile(
    filePath: string, 
    content: string | Buffer
  ): Promise<void> {
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content);
  }

  static async createTestFiles(files: Array<{
    path: string;
    content: string | Buffer;
  }>): Promise<string[]> {
    const createdFiles: string[] = [];
    
    for (const file of files) {
      await TestFileUtils.createTestFile(file.path, file.content);
      createdFiles.push(file.path);
    }
    
    return createdFiles;
  }

  static async cleanupFiles(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      try {
        await fs.remove(filePath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  static async withTempFile<T>(
    filename: string,
    content: string | Buffer,
    callback: (filePath: string) => Promise<T>
  ): Promise<T> {
    const filePath = path.join(TEST_CONFIG.tempDir, filename);
    await TestFileUtils.createTestFile(filePath, content);
    
    try {
      return await callback(filePath);
    } finally {
      await TestFileUtils.cleanupFiles([filePath]);
    }
  }
}

// Performance testing utilities
export class PerformanceTestUtils {
  static async measureTime<T>(fn: () => Promise<T>): Promise<{
    result: T;
    duration: number;
  }> {
    const start = process.hrtime.bigint();
    const result = await fn();
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
    
    return { result, duration };
  }

  static async measureMemory<T>(fn: () => Promise<T>): Promise<{
    result: T;
    memoryDelta: number;
  }> {
    const startMemory = process.memoryUsage().heapUsed;
    const result = await fn();
    const endMemory = process.memoryUsage().heapUsed;
    const memoryDelta = endMemory - startMemory;
    
    return { result, memoryDelta };
  }
}

// Setup test data
async function setupTestData(): Promise<void> {
  await fs.ensureDir(TEST_CONFIG.dataDir);
  
  // Create sample markdown file
  const sampleMarkdown = TestDataGenerator.generateMarkdown({
    title: 'Sample Document',
    content: 'This is a sample markdown document for testing purposes.',
    frontmatter: {
      title: 'Sample Document',
      author: 'Test Author',
      date: '2023-01-01'
    },
    sections: 3
  });
  
  await fs.writeFile(
    path.join(TEST_CONFIG.dataDir, 'sample.md'),
    sampleMarkdown
  );

  // Create sample with code blocks
  const codeMarkdown = `# Code Examples

Here's some JavaScript:

\`\`\`javascript
function hello(name) {
  console.log(\`Hello, \${name}!\`);
}
\`\`\`

And some Python:

\`\`\`python
def greet(name):
    print(f"Hello, {name}!")
\`\`\`

Inline \`code\` is also supported.`;

  await fs.writeFile(
    path.join(TEST_CONFIG.dataDir, 'code-examples.md'),
    codeMarkdown
  );

  // Create large test file
  const largeContent = TestDataGenerator.generateLargeText(100); // 100KB
  await fs.writeFile(
    path.join(TEST_CONFIG.dataDir, 'large-document.md'),
    `# Large Document\n\n${largeContent}`
  );
}

// Global test setup
beforeAll(async () => {
  // Mock console methods
  Object.assign(global.console, mockConsole);

  // Setup test directories
  await fs.ensureDir(TEST_CONFIG.dataDir);
  await fs.ensureDir(TEST_CONFIG.tempDir);
  await fs.ensureDir(TEST_CONFIG.vectorDbDir);
  await fs.ensureDir(TEST_CONFIG.cacheDir);
  await fs.ensureDir(TEST_CONFIG.logDir);

  // Setup test data
  await setupTestData();

  // Set test environment
  process.env.NODE_ENV = 'test';
});

beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
});

afterAll(async () => {
  // Clean up test directories
  try {
    await fs.remove(TEST_CONFIG.tempDir);
  } catch {
    // Ignore cleanup errors
  }
});

// Export test utilities
export const testPaths = {
  dataDir: TEST_CONFIG.dataDir,
  tempDir: TEST_CONFIG.tempDir,
  vectorDbDir: TEST_CONFIG.vectorDbDir,
  cacheDir: TEST_CONFIG.cacheDir,
  logDir: TEST_CONFIG.logDir
};

// Error testing utilities
export class ErrorTestUtils {
  static expectDocumentProcessingError(
    error: unknown,
    expectedStage?: string,
    expectedFilePath?: string
  ): void {
    expect(error).toBeInstanceOf(Error);
    const err = error as any;
    expect(err.name).toBe('DocumentProcessingError');
    
    if (expectedStage) {
      expect(err.processingStage).toBe(expectedStage);
    }
    
    if (expectedFilePath) {
      expect(err.filePath).toBe(expectedFilePath);
    }
  }

  static expectErrorWithContext(
    error: unknown,
    expectedContext: Record<string, unknown>
  ): void {
    expect(error).toBeInstanceOf(Error);
    const err = error as any;
    expect(err.context).toBeDefined();
    
    for (const [key, value] of Object.entries(expectedContext)) {
      expect(err.context[key]).toBe(value);
    }
  }
}

// Async testing utilities
export class AsyncTestUtils {
  static async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }

  static async withTimeout<T>(
    promise: Promise<T>,
    timeout: number,
    timeoutMessage?: string
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(timeoutMessage || `Operation timed out after ${timeout}ms`));
      }, timeout);
    });

    return Promise.race([promise, timeoutPromise]);
  }
}

// Mock service factories for testing
export class MockServiceFactory {
  static createMockEmbeddingService(): any {
    return {
      initialize: vi.fn().mockResolvedValue(undefined),
      embedChunks: vi.fn().mockResolvedValue([]),
      embedText: vi.fn().mockResolvedValue(new Array(384).fill(0.1)),
      getModelInfo: vi.fn().mockReturnValue({
        name: 'mock-model',
        isInitialized: true,
        loadTime: 1000,
        memoryUsage: 100000,
        version: '1.0.0'
      }),
      dispose: vi.fn().mockResolvedValue(undefined)
    };
  }

  static createMockVectorDatabase(): any {
    return {
      initialize: vi.fn().mockResolvedValue(undefined),
      addDocument: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue([]),
      getDocuments: vi.fn().mockResolvedValue([]),
      getStats: vi.fn().mockResolvedValue({
        totalDocuments: 0,
        totalChunks: 0,
        indexSize: 0,
        memoryUsage: 0,
        diskUsage: 0,
        lastUpdated: new Date()
      }),
      clear: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn().mockResolvedValue(undefined)
    };
  }

  static createMockChunkingService(): any {
    return {
      chunkDocument: vi.fn().mockReturnValue([MockDataFactory.createChunk()]),
      rechunkDocument: vi.fn().mockReturnValue([MockDataFactory.createChunk()]),
      getChunkingStats: vi.fn().mockReturnValue({
        totalChunks: 1,
        averageChunkSize: 100,
        minChunkSize: 50,
        maxChunkSize: 150,
        totalCharacters: 100
      })
    };
  }
}

// Integration test utilities
export class IntegrationTestUtils {
  static async createTestEnvironment(): Promise<{
    dataDir: string;
    vectorDbDir: string;
    configPath: string;
    cleanup: () => Promise<void>;
  }> {
    const testId = Math.random().toString(36).substring(7);
    const testDir = path.join(TEST_CONFIG.tempDir, `integration-${testId}`);
    const dataDir = path.join(testDir, 'data');
    const vectorDbDir = path.join(testDir, 'vectordb');
    const configPath = path.join(testDir, 'config.json');

    // Create directories
    await fs.ensureDir(dataDir);
    await fs.ensureDir(vectorDbDir);

    // Create test documents
    await TestFileUtils.createTestFiles([
      {
        path: path.join(dataDir, 'doc1.md'),
        content: TestDataGenerator.generateMarkdown({
          title: 'Document 1',
          content: 'Content for document 1'
        })
      },
      {
        path: path.join(dataDir, 'doc2.md'),
        content: TestDataGenerator.generateMarkdown({
          title: 'Document 2',
          content: 'Content for document 2'
        })
      }
    ]);

    // Create test config
    const config = {
      documents: [
        path.join(dataDir, 'doc1.md'),
        path.join(dataDir, 'doc2.md')
      ],
      vectorDbPath: vectorDbDir,
      embeddingModel: 'Xenova/all-MiniLM-L6-v2',
      chunkSize: 256,
      chunkOverlap: 25,
      maxResults: 5
    };

    await fs.writeJson(configPath, config);

    const cleanup = async () => {
      try {
        await fs.remove(testDir);
      } catch {
        // Ignore cleanup errors
      }
    };

    return { dataDir, vectorDbDir, configPath, cleanup };
  }
}

// Export commonly used test fixtures
export const SAMPLE_DOCUMENTS = {
  markdown: {
    simple: '# Simple Document\n\nThis is a simple markdown document.',
    withFrontmatter: `---
title: Document with Frontmatter
author: Test Author
tags: [test, sample]
---

# Main Content

This document has frontmatter.`,
    withCode: `# Code Document

\`\`\`javascript
console.log('Hello, world!');
\`\`\``,
    large: TestDataGenerator.generateLargeText(50) // 50KB
  },
  pdf: {
    valid: TestDataGenerator.createFakePdfBuffer('Valid PDF content'),
    invalid: Buffer.from('Not a PDF'),
    large: TestDataGenerator.createFakePdfBuffer(TestDataGenerator.generateLargeText(100))
  },
  docx: {
    valid: TestDataGenerator.createFakeZipBuffer('Valid DOCX content'),
    invalid: Buffer.from('Not a DOCX')
  },
  epub: {
    valid: TestDataGenerator.createFakeZipBuffer('Valid EPUB content'),
    invalid: Buffer.from('Not an EPUB')
  }
};
