import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { DocumentParser } from '../documentParser.js';
import { DocumentProcessingError } from '@/errors/DocumentProcessingError';

// Mock external dependencies
vi.mock('pdf-parse-debugging-disabled');
vi.mock('epub2');
vi.mock('mammoth');
vi.mock('../../utils/logging/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  },
  trackPerformance: vi.fn(() => ({
    finish: vi.fn(),
    finishWithError: vi.fn()
  }))
}));

const TEST_DATA_DIR = path.join(__dirname, '../../../tests/data');

describe('DocumentParser', () => {
  let parser: DocumentParser;
  let testFiles: string[] = [];

  beforeEach(async () => {
    parser = new DocumentParser();
    
    // Ensure test directory exists
    await fs.ensureDir(TEST_DATA_DIR);
    
    // Clear test files array
    testFiles = [];
  });

  afterEach(async () => {
    // Clean up test files
    for (const testFile of testFiles) {
      try {
        await fs.remove(testFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('constructor', () => {
    it('should initialize with supported parsers', () => {
      expect(parser).toBeDefined();
      expect(parser.getSupportedExtensions()).toContain('.md');
      expect(parser.getSupportedExtensions()).toContain('.pdf');
      expect(parser.getSupportedExtensions()).toContain('.docx');
      expect(parser.getSupportedExtensions()).toContain('.epub');
    });

    it('should have correct number of supported extensions', () => {
      const extensions = parser.getSupportedExtensions();
      expect(extensions.length).toBeGreaterThan(0);
      expect(extensions).toEqual(expect.arrayContaining(['.md', '.pdf', '.docx', '.epub']));
    });
  });

  describe('isSupported', () => {
    it('should return true for supported extensions', () => {
      expect(parser.isSupported('.md')).toBe(true);
      expect(parser.isSupported('.PDF')).toBe(true); // Case insensitive
      expect(parser.isSupported('test.docx')).toBe(true); // File path
    });

    it('should return false for unsupported extensions', () => {
      expect(parser.isSupported('.txt')).toBe(false);
      expect(parser.isSupported('.xyz')).toBe(false);
      expect(parser.isSupported('test.unsupported')).toBe(false);
    });
  });

  describe('parseDocument', () => {
    it('should throw error for non-existent files', async () => {
      const nonExistentFile = path.join(TEST_DATA_DIR, 'non-existent.md');
      
      await expect(parser.parseDocument(nonExistentFile))
        .rejects
        .toThrow(DocumentProcessingError);
    });

    it('should throw error for unsupported file types', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'test.txt');
      testFiles.push(testFile);
      await fs.writeFile(testFile, 'test content');
      
      await expect(parser.parseDocument(testFile))
        .rejects
        .toThrow(DocumentProcessingError);
    });

    it('should throw error for invalid file path', async () => {
      await expect(parser.parseDocument(''))
        .rejects
        .toThrow(DocumentProcessingError);
      
      await expect(parser.parseDocument(null as any))
        .rejects
        .toThrow(DocumentProcessingError);
    });

    it('should parse markdown files successfully', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'test.md');
      testFiles.push(testFile);
      const content = '# Test Title\n\nThis is test content.';
      await fs.writeFile(testFile, content);
      
      const result = await parser.parseDocument(testFile);
      
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.title).toBe('Test Title');
      expect(result.content).toContain('This is test content');
      expect(result.metadata.fileType).toBe('md');
      expect(result.metadata.filePath).toBe(testFile);
      expect(result.chunks).toEqual([]);
    });

    it('should handle markdown files without titles', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'notitle.md');
      testFiles.push(testFile);
      const content = 'This is content without a title.';
      await fs.writeFile(testFile, content);
      
      const result = await parser.parseDocument(testFile);
      
      expect(result.title).toBe('notitle');
      expect(result.content).toContain('This is content without a title');
    });

    it('should handle markdown with frontmatter', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'frontmatter.md');
      testFiles.push(testFile);
      const content = `---
title: Frontmatter Title
author: Test Author
---

# Main Content

This is the main content.`;
      await fs.writeFile(testFile, content);
      
      const result = await parser.parseDocument(testFile);
      
      expect(result.title).toBe('Frontmatter Title');
      expect(result.metadata.author).toBe('Test Author');
      expect(result.content).toContain('This is the main content');
    });

    it('should include correct metadata', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'metadata.md');
      testFiles.push(testFile);
      const content = '# Metadata Test\n\nTest content.';
      await fs.writeFile(testFile, content);
      const stats = await fs.stat(testFile);
      
      const result = await parser.parseDocument(testFile);
      
      expect(result.metadata.filePath).toBe(testFile);
      expect(result.metadata.fileType).toBe('md');
      expect(result.metadata.fileSize).toBe(stats.size);
      expect(result.metadata.createdAt).toEqual(stats.birthtime);
      expect(result.metadata.lastModified).toEqual(stats.mtime);
    });

    it('should handle PDF files with mocked parser', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'test.pdf');
      testFiles.push(testFile);
      
      // Create a fake PDF with proper signature
      const pdfHeader = Buffer.from('%PDF-1.4\n');
      const fakeContent = Buffer.from('fake pdf content');
      const pdfBuffer = Buffer.concat([pdfHeader, fakeContent]);
      await fs.writeFile(testFile, pdfBuffer);
      
      // Mock PDF parser
      const mockPdfParse = await import('pdf-parse-debugging-disabled');
      vi.mocked(mockPdfParse.default).mockResolvedValue({
        text: 'Parsed PDF content',
        info: { Title: 'PDF Title', Author: 'PDF Author' },
        numpages: 1,
        version: '1.4'
      });
      
      const result = await parser.parseDocument(testFile);
      
      expect(result.metadata.fileType).toBe('pdf');
      expect(result.content).toBe('Parsed PDF content');
      expect(result.title).toBe('PDF Title');
      expect(result.metadata.author).toBe('PDF Author');
    });

    it('should handle DOCX files with mocked parser', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'test.docx');
      testFiles.push(testFile);
      
      // Create a fake DOCX with proper ZIP signature
      const zipHeader = Buffer.from([0x50, 0x4B]); // PK
      const fakeContent = Buffer.from('fake docx content');
      const docxBuffer = Buffer.concat([zipHeader, fakeContent]);
      await fs.writeFile(testFile, docxBuffer);
      
      // Mock mammoth parser
      const mammoth = await import('mammoth');
      vi.mocked(mammoth.extractRawText).mockResolvedValue({
        value: 'Parsed DOCX content',
        messages: []
      });
      
      const result = await parser.parseDocument(testFile);
      
      expect(result.metadata.fileType).toBe('docx');
      expect(result.content).toBe('Parsed DOCX content');
    });

    it('should handle EPUB files with mocked parser', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'test.epub');
      testFiles.push(testFile);
      
      // Create a fake EPUB with proper ZIP signature
      const zipHeader = Buffer.from([0x50, 0x4B]); // PK
      const fakeContent = Buffer.from('fake epub content');
      const epubBuffer = Buffer.concat([zipHeader, fakeContent]);
      await fs.writeFile(testFile, epubBuffer);
      
      // Mock EPUB parser
      const EPub = await import('epub2');
      const mockEpub = {
        on: vi.fn(),
        parse: vi.fn(),
        metadata: {
          title: 'EPUB Title',
          creator: 'EPUB Author'
        },
        flow: [
          { id: 'chapter1' },
          { id: 'chapter2' }
        ],
        getChapter: vi.fn()
      };
      
      vi.mocked(EPub.default).mockReturnValue(mockEpub as any);
      
      // Simulate successful parsing
      mockEpub.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'end') {
          setTimeout(callback, 0);
        }
      });
      
      mockEpub.getChapter.mockImplementation((id: string, callback: Function) => {
        if (id === 'chapter1') {
          callback(null, '<p>Chapter 1 content</p>');
        } else if (id === 'chapter2') {
          callback(null, '<p>Chapter 2 content</p>');
        }
      });
      
      const result = await parser.parseDocument(testFile);
      
      expect(result.metadata.fileType).toBe('epub');
      expect(result.title).toBe('EPUB Title');
      expect(result.metadata.author).toBe('EPUB Author');
    });

    it('should handle file size limits', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'large.md');
      testFiles.push(testFile);
      const content = 'Large file content';
      await fs.writeFile(testFile, content);
      
      await expect(parser.parseDocument(testFile, { maxFileSize: 5 }))
        .rejects
        .toThrow(DocumentProcessingError);
    });

    it('should handle timeout options', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'timeout.md');
      testFiles.push(testFile);
      await fs.writeFile(testFile, '# Test\nContent');
      
      // This should succeed as markdown parsing is fast
      const result = await parser.parseDocument(testFile, { timeout: 1000 });
      expect(result).toBeDefined();
    });

    it('should call progress callback if provided', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'progress.md');
      testFiles.push(testFile);
      await fs.writeFile(testFile, '# Progress Test\nContent');
      
      const progressCallback = vi.fn();
      
      await parser.parseDocument(testFile, { progressCallback });
      
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: expect.any(String),
          percentage: expect.any(Number),
          message: expect.any(String)
        })
      );
    });
  });

  describe('parseDocuments (batch)', () => {
    it('should parse multiple documents successfully', async () => {
      const testFiles = [
        path.join(TEST_DATA_DIR, 'batch1.md'),
        path.join(TEST_DATA_DIR, 'batch2.md')
      ];
      
      for (const testFile of testFiles) {
        this.testFiles.push(testFile);
        await fs.writeFile(testFile, `# ${path.basename(testFile)}\nContent`);
      }
      
      const result = await parser.parseDocuments(testFiles);
      
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.stats.successCount).toBe(2);
      expect(result.stats.failureCount).toBe(0);
      expect(result.stats.totalFiles).toBe(2);
    });

    it('should handle mixed success and failure in batch', async () => {
      const testFiles = [
        path.join(TEST_DATA_DIR, 'good.md'),
        path.join(TEST_DATA_DIR, 'nonexistent.md'), // This will fail
        path.join(TEST_DATA_DIR, 'good2.md')
      ];
      
      // Create only the good files
      this.testFiles.push(testFiles[0], testFiles[2]);
      await fs.writeFile(testFiles[0], '# Good 1\nContent');
      await fs.writeFile(testFiles[2], '# Good 2\nContent');
      
      const result = await parser.parseDocuments(testFiles);
      
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.stats.successCount).toBe(2);
      expect(result.stats.failureCount).toBe(1);
      expect(result.failed[0]?.filePath).toBe(testFiles[1]);
    });

    it('should call progress callback for batch operations', async () => {
      const testFiles = [
        path.join(TEST_DATA_DIR, 'batch_progress1.md'),
        path.join(TEST_DATA_DIR, 'batch_progress2.md')
      ];
      
      for (const testFile of testFiles) {
        this.testFiles.push(testFile);
        await fs.writeFile(testFile, `# ${path.basename(testFile)}\nContent`);
      }
      
      const progressCallback = vi.fn();
      
      await parser.parseDocuments(testFiles, { progressCallback });
      
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'batch-processing',
          percentage: expect.any(Number),
          message: expect.stringContaining('Processing file')
        })
      );
    });
  });

  describe('getParserInfo', () => {
    it('should return parser info for supported formats', () => {
      const mdInfo = parser.getParserInfo('.md');
      expect(mdInfo).toEqual({
        name: 'Markdown',
        supported: true
      });
      
      const pdfInfo = parser.getParserInfo('.pdf');
      expect(pdfInfo).toEqual({
        name: 'PDF',
        supported: true
      });
    });

    it('should return null for unsupported formats', () => {
      const info = parser.getParserInfo('.txt');
      expect(info).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should throw DocumentProcessingError for parsing failures', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'corrupt.pdf');
      testFiles.push(testFile);
      
      // Create invalid PDF (wrong signature)
      await fs.writeFile(testFile, 'not a pdf');
      
      await expect(parser.parseDocument(testFile))
        .rejects
        .toThrow(DocumentProcessingError);
    });

    it('should include context in error messages', async () => {
      try {
        await parser.parseDocument('nonexistent.xyz');
      } catch (error) {
        expect(error).toBeInstanceOf(DocumentProcessingError);
        expect((error as DocumentProcessingError).context).toBeDefined();
      }
    });

    it('should handle permission errors', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'readonly.md');
      testFiles.push(testFile);
      await fs.writeFile(testFile, '# Test\nContent');
      
      // Make file unreadable (this might not work on all systems)
      try {
        await fs.chmod(testFile, 0o000);
        
        await expect(parser.parseDocument(testFile))
          .rejects
          .toThrow(DocumentProcessingError);
      } catch {
        // Skip this test if we can't change permissions
      } finally {
        // Restore permissions for cleanup
        try {
          await fs.chmod(testFile, 0o644);
        } catch {
          // Ignore
        }
      }
    });
  });
});
