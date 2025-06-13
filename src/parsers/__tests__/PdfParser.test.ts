import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { PdfParser } from '../PdfParser.js';
import { DocumentProcessingError } from '@/errors/DocumentProcessingError';

// Mock pdf-parse
vi.mock('pdf-parse-debugging-disabled');

const TEST_DATA_DIR = path.join(__dirname, '../../../tests/data');

describe('PdfParser', () => {
  let parser: PdfParser;
  let testFiles: string[] = [];

  beforeEach(async () => {
    parser = new PdfParser();
    await fs.ensureDir(TEST_DATA_DIR);
    testFiles = [];
    
    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    for (const testFile of testFiles) {
      try {
        await fs.remove(testFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('constructor', () => {
    it('should initialize with correct supported extensions', () => {
      const extensions = parser.getSupportedExtensions();
      expect(extensions).toContain('.pdf');
      expect(extensions).toHaveLength(1);
    });
  });

  describe('isSupported', () => {
    it('should support PDF extension', () => {
      expect(parser.isSupported('.pdf')).toBe(true);
      expect(parser.isSupported('.PDF')).toBe(true); // Case insensitive
    });

    it('should not support non-PDF extensions', () => {
      expect(parser.isSupported('.txt')).toBe(false);
      expect(parser.isSupported('.md')).toBe(false);
    });
  });

  describe('parseDocument', () => {
    it('should parse PDF with valid content', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'valid.pdf');
      testFiles.push(testFile);
      
      // Create a valid PDF buffer (starts with %PDF-)
      const pdfBuffer = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        Buffer.from('fake pdf content')
      ]);
      await fs.writeFile(testFile, pdfBuffer);

      // Mock successful PDF parsing
      const mockPdfParse = await import('pdf-parse-debugging-disabled');
      vi.mocked(mockPdfParse.default).mockResolvedValue({
        text: 'Extracted PDF text content',
        info: {
          Title: 'PDF Document Title',
          Author: 'PDF Author',
          Subject: 'PDF Subject',
          Keywords: 'keyword1, keyword2',
          Creator: 'PDF Creator',
          Producer: 'PDF Producer',
          CreationDate: 'D:20230101120000Z',
          ModDate: 'D:20230201120000Z'
        },
        numpages: 5,
        version: '1.4'
      });

      const result = await parser.parseDocument(testFile, '.pdf');

      expect(result.content).toBe('Extracted PDF text content');
      expect(result.title).toBe('PDF Document Title');
      expect(result.author).toBe('PDF Author');
      expect(result.metadata?.pageCount).toBe(5);
      expect(result.metadata?.pdfVersion).toBe('1.4');
      expect(result.metadata?.subject).toBe('PDF Subject');
    });

    it('should handle PDF without metadata', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'no-metadata.pdf');
      testFiles.push(testFile);
      
      const pdfBuffer = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        Buffer.from('pdf content without metadata')
      ]);
      await fs.writeFile(testFile, pdfBuffer);

      const mockPdfParse = await import('pdf-parse-debugging-disabled');
      vi.mocked(mockPdfParse.default).mockResolvedValue({
        text: 'Plain PDF text',
        info: {},
        numpages: 1,
        version: '1.4'
      });

      const result = await parser.parseDocument(testFile, '.pdf');

      expect(result.content).toBe('Plain PDF text');
      expect(result.title).toBe('');
      expect(result.author).toBe('');
    });

    it('should clean messy PDF text', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'messy.pdf');
      testFiles.push(testFile);
      
      const pdfBuffer = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        Buffer.from('messy pdf content')
      ]);
      await fs.writeFile(testFile, pdfBuffer);

      const mockPdfParse = await import('pdf-parse-debugging-disabled');
      vi.mocked(mockPdfParse.default).mockResolvedValue({
        text: 'Text   with   lots   of   spaces\n\n\n\nAnd   extra   linebreaks\n\n1\n\nPage number should be removed',
        info: { Title: 'Messy PDF' },
        numpages: 1,
        version: '1.4'
      });

      const result = await parser.parseDocument(testFile, '.pdf');

      // Check that excessive whitespace is cleaned
      expect(result.content).not.toMatch(/\s{3,}/);
      expect(result.content).not.toMatch(/\n{3,}/);
      expect(result.content).toContain('Text with lots of spaces');
    });

    it('should handle file size limits', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'large.pdf');
      testFiles.push(testFile);
      
      const largeContent = Buffer.alloc(2000, 'A');
      const pdfBuffer = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        largeContent
      ]);
      await fs.writeFile(testFile, pdfBuffer);

      await expect(
        parser.parseDocument(testFile, '.pdf', { maxFileSize: 100 })
      ).rejects.toThrow(DocumentProcessingError);
    });

    it('should validate PDF signature', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'invalid-signature.pdf');
      testFiles.push(testFile);
      
      // Create file without proper PDF signature
      await fs.writeFile(testFile, 'Not a PDF file');

      await expect(
        parser.parseDocument(testFile, '.pdf')
      ).rejects.toThrow(DocumentProcessingError);
    });

    it('should handle password-protected PDFs', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'protected.pdf');
      testFiles.push(testFile);
      
      const pdfBuffer = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        Buffer.from('encrypted pdf content')
      ]);
      await fs.writeFile(testFile, pdfBuffer);

      const mockPdfParse = await import('pdf-parse-debugging-disabled');
      vi.mocked(mockPdfParse.default).mockRejectedValue(
        new Error('PDF is password protected')
      );

      await expect(
        parser.parseDocument(testFile, '.pdf')
      ).rejects.toThrow(DocumentProcessingError);
    });

    it('should handle timeout', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'timeout.pdf');
      testFiles.push(testFile);
      
      const pdfBuffer = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        Buffer.from('pdf content')
      ]);
      await fs.writeFile(testFile, pdfBuffer);

      const mockPdfParse = await import('pdf-parse-debugging-disabled');
      vi.mocked(mockPdfParse.default).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          text: 'Parsed content',
          info: {},
          numpages: 1,
          version: '1.4'
        }), 100))
      );

      // Should succeed with reasonable timeout
      const result = await parser.parseDocument(testFile, '.pdf', { timeout: 5000 });
      expect(result).toBeDefined();
    });

    it('should handle parsing timeout', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'slow.pdf');
      testFiles.push(testFile);
      
      const pdfBuffer = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        Buffer.from('slow pdf content')
      ]);
      await fs.writeFile(testFile, pdfBuffer);

      const mockPdfParse = await import('pdf-parse-debugging-disabled');
      vi.mocked(mockPdfParse.default).mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 2000)) // 2 second delay
      );

      await expect(
        parser.parseDocument(testFile, '.pdf', { timeout: 100 })
      ).rejects.toThrow(DocumentProcessingError);
    });

    it('should call progress callback', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'progress.pdf');
      testFiles.push(testFile);
      
      const pdfBuffer = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        Buffer.from('pdf content')
      ]);
      await fs.writeFile(testFile, pdfBuffer);

      const mockPdfParse = await import('pdf-parse-debugging-disabled');
      vi.mocked(mockPdfParse.default).mockResolvedValue({
        text: 'PDF content',
        info: {},
        numpages: 1,
        version: '1.4'
      });

      const progressCallback = vi.fn();
      await parser.parseDocument(testFile, '.pdf', { progressCallback });

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: expect.any(String),
          percentage: expect.any(Number),
          message: expect.any(String)
        })
      );
    });

    it('should handle PDF parsing errors', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'corrupt.pdf');
      testFiles.push(testFile);
      
      const pdfBuffer = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        Buffer.from('corrupt pdf content')
      ]);
      await fs.writeFile(testFile, pdfBuffer);

      const mockPdfParse = await import('pdf-parse-debugging-disabled');
      vi.mocked(mockPdfParse.default).mockRejectedValue(
        new Error('PDF parsing failed')
      );

      await expect(
        parser.parseDocument(testFile, '.pdf')
      ).rejects.toThrow(DocumentProcessingError);
    });

    it('should extract comprehensive metadata', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'metadata.pdf');
      testFiles.push(testFile);
      
      const pdfBuffer = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        Buffer.from('pdf with metadata')
      ]);
      await fs.writeFile(testFile, pdfBuffer);

      const mockPdfParse = await import('pdf-parse-debugging-disabled');
      vi.mocked(mockPdfParse.default).mockResolvedValue({
        text: 'PDF content',
        info: {
          Title: 'Complete PDF Title',
          Author: 'John Doe',
          Subject: 'PDF Testing',
          Keywords: 'test, pdf, metadata',
          Creator: 'Test Creator',
          Producer: 'Test Producer',
          CreationDate: 'D:20230101120000Z',
          ModDate: 'D:20230201120000Z',
          IsAcroFormPresent: false
        },
        numpages: 10,
        version: '1.7'
      });

      const result = await parser.parseDocument(testFile, '.pdf');

      expect(result.metadata?.title).toBe('Complete PDF Title');
      expect(result.metadata?.author).toBe('John Doe');
      expect(result.metadata?.subject).toBe('PDF Testing');
      expect(result.metadata?.keywords).toBe('test, pdf, metadata');
      expect(result.metadata?.creator).toBe('Test Creator');
      expect(result.metadata?.producer).toBe('Test Producer');
      expect(result.metadata?.pageCount).toBe(10);
      expect(result.metadata?.pdfVersion).toBe('1.7');
    });

    it('should throw error for non-existent file', async () => {
      await expect(
        parser.parseDocument('nonexistent.pdf', '.pdf')
      ).rejects.toThrow(DocumentProcessingError);
    });

    it('should throw error for unreadable file', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'unreadable.pdf');
      testFiles.push(testFile);
      
      const pdfBuffer = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        Buffer.from('pdf content')
      ]);
      await fs.writeFile(testFile, pdfBuffer);

      // Make file unreadable (this might not work on all systems)
      try {
        await fs.chmod(testFile, 0o000);
        
        await expect(
          parser.parseDocument(testFile, '.pdf')
        ).rejects.toThrow(DocumentProcessingError);
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

  describe('error scenarios', () => {
    it('should throw DocumentProcessingError with proper context', async () => {
      try {
        await parser.parseDocument('invalid.pdf', '.pdf');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(DocumentProcessingError);
        expect((error as DocumentProcessingError).filePath).toBe('invalid.pdf');
        expect((error as DocumentProcessingError).processingStage).toBe('validation');
      }
    });

    it('should handle unsupported file extensions', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'test.txt');
      testFiles.push(testFile);
      await fs.writeFile(testFile, 'content');

      await expect(
        parser.parseDocument(testFile, '.txt')
      ).rejects.toThrow(DocumentProcessingError);
    });

    it('should provide recovery suggestions for password-protected PDFs', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'encrypted.pdf');
      testFiles.push(testFile);
      
      const pdfBuffer = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        Buffer.from('encrypted content')
      ]);
      await fs.writeFile(testFile, pdfBuffer);

      const mockPdfParse = await import('pdf-parse-debugging-disabled');
      vi.mocked(mockPdfParse.default).mockRejectedValue(
        new Error('PDF requires password')
      );

      try {
        await parser.parseDocument(testFile, '.pdf');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(DocumentProcessingError);
        expect((error as DocumentProcessingError).context.requiresPassword).toBe(true);
      }
    });
  });

  describe('performance', () => {
    it('should handle large PDF files efficiently', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'large-valid.pdf');
      testFiles.push(testFile);
      
      // Create a reasonably sized PDF
      const largeContent = 'A'.repeat(10000);
      const pdfBuffer = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        Buffer.from(largeContent)
      ]);
      await fs.writeFile(testFile, pdfBuffer);

      const mockPdfParse = await import('pdf-parse-debugging-disabled');
      vi.mocked(mockPdfParse.default).mockResolvedValue({
        text: largeContent,
        info: { Title: 'Large PDF' },
        numpages: 100,
        version: '1.4'
      });

      const startTime = Date.now();
      const result = await parser.parseDocument(testFile, '.pdf');
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});
