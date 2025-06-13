import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from 'fs-extra';
import path from 'path';
import { DocumentParser } from '../../src/parsers/documentParser';
import { DocumentProcessingError } from '../../src/errors/DocumentProcessingError';
import { testPaths } from '../setup';

// Mock external dependencies (ESM-compatible)
vi.mock('pdf-parse-debugging-disabled', () => ({ default: vi.fn() }));
vi.mock('epub2', () => ({ default: vi.fn() }));
vi.mock('mammoth', () => ({
  default: {
    extractRawText: vi.fn(),
    images: { ignoreAll: vi.fn() }
  }
}));

describe('DocumentParser', () => {
  let parser: DocumentParser;
  let testFile: string;

  beforeEach(() => {
    parser = new DocumentParser();
  });

  afterEach(async () => {
    if (testFile) {
      try {
        await fs.remove(testFile);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('parseDocument', () => {
    it('should throw error for non-existent files', async () => {
      const nonExistentFile = path.join(testPaths.dataDir, 'non-existent.txt');
      
      await expect(parser.parseDocument(nonExistentFile))
        .rejects
        .toThrow(DocumentProcessingError);
    });

    it('should throw error for unsupported file types', async () => {
      testFile = path.join(testPaths.dataDir, 'test.txt');
      await fs.writeFile(testFile, 'test content');
      
      await expect(parser.parseDocument(testFile))
        .rejects
        .toThrow(DocumentProcessingError);
    });

    it('should parse markdown files successfully', async () => {
      const markdownFile = path.join(testPaths.dataDir, 'sample.md');
      
      const result = await parser.parseDocument(markdownFile);
      
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.title).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.fileType).toBe('md');
      expect(result.metadata.filePath).toBe(markdownFile);
      expect(result.chunks).toEqual([]);
    });

    it('should extract title from markdown content', async () => {
      testFile = path.join(testPaths.dataDir, 'titled.md');
      const content = '# Test Title\n\nThis is test content.';
      await fs.writeFile(testFile, content);
      
      const result = await parser.parseDocument(testFile);
      
      expect(result.title).toBe('Test Title');
    });

    it('should use filename as title when no title found in markdown', async () => {
      testFile = path.join(testPaths.dataDir, 'notitle.md');
      const content = 'This is content without a title.';
      await fs.writeFile(testFile, content);
      
      const result = await parser.parseDocument(testFile);
      
      expect(result.title).toBe('notitle');
    });

    it('should include correct metadata', async () => {
      const markdownFile = path.join(testPaths.dataDir, 'sample.md');
      const stats = await fs.stat(markdownFile);
      
      const result = await parser.parseDocument(markdownFile);
      
      expect(result.metadata.filePath).toBe(markdownFile);
      expect(result.metadata.fileType).toBe('md');
      expect(result.metadata.fileSize).toBe(stats.size);
      expect(result.metadata.createdAt).toEqual(stats.birthtime);
      expect(result.metadata.lastModified).toEqual(stats.mtime);
    });

    it('should handle PDF files with mocked parser', async () => {
      testFile = path.join(testPaths.dataDir, 'test.pdf');
      // Write valid PDF signature
      await fs.writeFile(testFile, '%PDF-');
      // Mock PDF parser
      const mod = await vi.importActual<typeof import('pdf-parse-debugging-disabled')>('pdf-parse-debugging-disabled');
      const mockPdfParse = (await import('pdf-parse-debugging-disabled')).default as typeof mod.default & { mockResolvedValue: any };
      mockPdfParse.mockResolvedValue({
        text: 'Parsed PDF content',
        info: { Title: 'PDF Title' }
      });
      const result = await parser.parseDocument(testFile);
      expect(result.metadata.fileType).toBe('pdf');
      expect(result.content).toBe('Parsed PDF content');
      expect(result.title).toBe('PDF Title');
    });

    it('should handle DOCX files with mocked parser', async () => {
      testFile = path.join(testPaths.dataDir, 'test.docx');
      // Write valid DOCX signature (PK)
      await fs.writeFile(testFile, Buffer.from([0x50, 0x4B]));
      // Mock mammoth parser
      const mammoth = (await import('mammoth')).default;
      (mammoth.extractRawText as any).mockResolvedValue({
        value: 'Parsed DOCX content'
      });
      const result = await parser.parseDocument(testFile);
      expect(result.metadata.fileType).toBe('docx');
      expect(result.content).toBe('Parsed DOCX content');
    });

    it('should handle EPUB files with mocked parser', async () => {
      testFile = path.join(testPaths.dataDir, 'test.epub');
      // Write valid EPUB signature (PK)
      await fs.writeFile(testFile, Buffer.from([0x50, 0x4B]));
      // Mock EPUB parser
      const mod = await vi.importActual<typeof import('epub2')>('epub2');
      const EPub = (await import('epub2')).default as typeof mod.default & { mockReturnValue: any };
      const mockEpub = {
        on: vi.fn(),
        parse: vi.fn(),
        getChapter: vi.fn()
      } as any;
      EPub.mockReturnValue(mockEpub);
      // Store event callbacks
      const eventCallbacks: Record<string, Function> = {};
      mockEpub.on.mockImplementation((event: string, callback: Function) => {
        eventCallbacks[event] = callback;
      });
      mockEpub.parse.mockImplementation(() => {
        // Simulate async end event
        setTimeout(() => {
          mockEpub.metadata = { title: 'EPUB Title' };
          mockEpub.flow = [
            { id: 'chapter1' },
            { id: 'chapter2' }
          ];
          if (eventCallbacks['end']) eventCallbacks['end']();
        }, 0);
      });
      mockEpub.getChapter
        .mockResolvedValueOnce('Chapter 1 content')
        .mockResolvedValueOnce('Chapter 2 content');
      const result = await parser.parseDocument(testFile);
      expect(result.metadata.fileType).toBe('epub');
      expect(result.title).toBe('EPUB Title');
    });

    it('should handle parsing errors gracefully', async () => {
      testFile = path.join(testPaths.dataDir, 'corrupt.pdf');
      // Write valid PDF signature
      await fs.writeFile(testFile, '%PDF-');
      // Mock PDF parser to throw error
      const mod = await vi.importActual<typeof import('pdf-parse-debugging-disabled')>('pdf-parse-debugging-disabled');
      const mockPdfParse = (await import('pdf-parse-debugging-disabled')).default as typeof mod.default & { mockRejectedValue: any };
      mockPdfParse.mockRejectedValue(new Error('Corrupt PDF'));
      await expect(parser.parseDocument(testFile))
        .rejects
        .toThrow(DocumentProcessingError);
    });

    it('should handle minimal EPUB (no chapters, no metadata)', async () => {
      testFile = path.join(testPaths.dataDir, 'minimal.epub');
      await fs.writeFile(testFile, Buffer.from([0x50, 0x4B]));
      const mod = await vi.importActual<typeof import('epub2')>('epub2');
      const EPub = (await import('epub2')).default as typeof mod.default & { mockReturnValue: any };
      const mockEpub = {
        on: vi.fn(),
        parse: vi.fn(),
      } as any;
      EPub.mockReturnValue(mockEpub);
      const eventCallbacks: Record<string, Function> = {};
      mockEpub.on.mockImplementation((event: string, callback: Function) => {
        eventCallbacks[event] = callback;
      });
      mockEpub.parse.mockImplementation(() => {
        setTimeout(() => {
          mockEpub.metadata = undefined;
          mockEpub.flow = [];
          if (eventCallbacks['end']) eventCallbacks['end']();
        }, 0);
      });
      const result = await parser.parseDocument(testFile);
      expect(result.metadata.fileType).toBe('epub');
      expect(result.title).toBe('');
      expect(result.content).toBe('');
    });

    it('should handle EPUB with one chapter', async () => {
      testFile = path.join(testPaths.dataDir, 'onechapter.epub');
      await fs.writeFile(testFile, Buffer.from([0x50, 0x4B]));
      const mod = await vi.importActual<typeof import('epub2')>('epub2');
      const EPub = (await import('epub2')).default as typeof mod.default & { mockReturnValue: any };
      const mockEpub = {
        on: vi.fn(),
        parse: vi.fn(),
        getChapter: vi.fn()
      } as any;
      EPub.mockReturnValue(mockEpub);
      const eventCallbacks: Record<string, Function> = {};
      mockEpub.on.mockImplementation((event: string, callback: Function) => {
        eventCallbacks[event] = callback;
      });
      mockEpub.parse.mockImplementation(() => {
        setTimeout(() => {
          mockEpub.metadata = { title: 'Single Chapter Book' };
          mockEpub.flow = [{ id: 'ch1' }];
          if (eventCallbacks['end']) eventCallbacks['end']();
        }, 0);
      });
      mockEpub.getChapter.mockResolvedValueOnce('Only chapter content');
      const result = await parser.parseDocument(testFile);
      expect(result.title).toBe('Single Chapter Book');
      expect(result.content).toContain('Only chapter content');
    });

    it('should handle EPUB with missing title/author', async () => {
      testFile = path.join(testPaths.dataDir, 'notitle.epub');
      await fs.writeFile(testFile, Buffer.from([0x50, 0x4B]));
      const mod = await vi.importActual<typeof import('epub2')>('epub2');
      const EPub = (await import('epub2')).default as typeof mod.default & { mockReturnValue: any };
      const mockEpub = {
        on: vi.fn(),
        parse: vi.fn(),
        getChapter: vi.fn()
      } as any;
      EPub.mockReturnValue(mockEpub);
      const eventCallbacks: Record<string, Function> = {};
      mockEpub.on.mockImplementation((event: string, callback: Function) => {
        eventCallbacks[event] = callback;
      });
      mockEpub.parse.mockImplementation(() => {
        setTimeout(() => {
          mockEpub.metadata = {};
          mockEpub.flow = [{ id: 'ch1' }];
          if (eventCallbacks['end']) eventCallbacks['end']();
        }, 0);
      });
      mockEpub.getChapter.mockResolvedValueOnce('Chapter content');
      const result = await parser.parseDocument(testFile);
      expect(result.title).toBe('');
      expect(result.author).toBe('');
    });

    it('should handle EPUB with extra/unknown fields', async () => {
      testFile = path.join(testPaths.dataDir, 'extrafields.epub');
      await fs.writeFile(testFile, Buffer.from([0x50, 0x4B]));
      const mod = await vi.importActual<typeof import('epub2')>('epub2');
      const EPub = (await import('epub2')).default as typeof mod.default & { mockReturnValue: any };
      const mockEpub = {
        on: vi.fn(),
        parse: vi.fn(),
        getChapter: vi.fn()
      } as any;
      EPub.mockReturnValue(mockEpub);
      const eventCallbacks: Record<string, Function> = {};
      mockEpub.on.mockImplementation((event: string, callback: Function) => {
        eventCallbacks[event] = callback;
      });
      mockEpub.parse.mockImplementation(() => {
        setTimeout(() => {
          mockEpub.metadata = { title: 'Book', foo: 'bar', baz: 123 };
          mockEpub.flow = [{ id: 'ch1' }];
          if (eventCallbacks['end']) eventCallbacks['end']();
        }, 0);
      });
      mockEpub.getChapter.mockResolvedValueOnce('Chapter content');
      const result = await parser.parseDocument(testFile);
      expect(result.title).toBe('Book');
      expect(result.metadata.foo).toBeUndefined(); // Only known fields are extracted
    });

    it('should handle EPUB with empty chapter content', async () => {
      testFile = path.join(testPaths.dataDir, 'emptychapter.epub');
      await fs.writeFile(testFile, Buffer.from([0x50, 0x4B]));
      const mod = await vi.importActual<typeof import('epub2')>('epub2');
      const EPub = (await import('epub2')).default as typeof mod.default & { mockReturnValue: any };
      const mockEpub = {
        on: vi.fn(),
        parse: vi.fn(),
        getChapter: vi.fn()
      } as any;
      EPub.mockReturnValue(mockEpub);
      const eventCallbacks: Record<string, Function> = {};
      mockEpub.on.mockImplementation((event: string, callback: Function) => {
        eventCallbacks[event] = callback;
      });
      mockEpub.parse.mockImplementation(() => {
        setTimeout(() => {
          mockEpub.metadata = { title: 'Empty Chapter Book' };
          mockEpub.flow = [{ id: 'ch1' }];
          if (eventCallbacks['end']) eventCallbacks['end']();
        }, 0);
      });
      mockEpub.getChapter.mockResolvedValueOnce('   ');
      const result = await parser.parseDocument(testFile);
      expect(result.title).toBe('Empty Chapter Book');
      expect(result.content).toBe('');
    });

    it('should handle EPUB with missing flow', async () => {
      testFile = path.join(testPaths.dataDir, 'noflow.epub');
      await fs.writeFile(testFile, Buffer.from([0x50, 0x4B]));
      const mod = await vi.importActual<typeof import('epub2')>('epub2');
      const EPub = (await import('epub2')).default as typeof mod.default & { mockReturnValue: any };
      const mockEpub = {
        on: vi.fn(),
        parse: vi.fn(),
      } as any;
      EPub.mockReturnValue(mockEpub);
      const eventCallbacks: Record<string, Function> = {};
      mockEpub.on.mockImplementation((event: string, callback: Function) => {
        eventCallbacks[event] = callback;
      });
      mockEpub.parse.mockImplementation(() => {
        setTimeout(() => {
          mockEpub.metadata = { title: 'No Flow Book' };
          mockEpub.flow = undefined;
          if (eventCallbacks['end']) eventCallbacks['end']();
        }, 0);
      });
      const result = await parser.parseDocument(testFile);
      expect(result.title).toBe('No Flow Book');
      expect(result.content).toBe('');
    });

    it('should handle EPUB with missing metadata', async () => {
      testFile = path.join(testPaths.dataDir, 'nometadata.epub');
      await fs.writeFile(testFile, Buffer.from([0x50, 0x4B]));
      const mod = await vi.importActual<typeof import('epub2')>('epub2');
      const EPub = (await import('epub2')).default as typeof mod.default & { mockReturnValue: any };
      const mockEpub = {
        on: vi.fn(),
        parse: vi.fn(),
        getChapter: vi.fn()
      } as any;
      EPub.mockReturnValue(mockEpub);
      const eventCallbacks: Record<string, Function> = {};
      mockEpub.on.mockImplementation((event: string, callback: Function) => {
        eventCallbacks[event] = callback;
      });
      mockEpub.parse.mockImplementation(() => {
        setTimeout(() => {
          mockEpub.metadata = undefined;
          mockEpub.flow = [{ id: 'ch1' }];
          if (eventCallbacks['end']) eventCallbacks['end']();
        }, 0);
      });
      mockEpub.getChapter.mockResolvedValueOnce('Chapter content');
      const result = await parser.parseDocument(testFile);
      expect(result.title).toBe('');
      expect(result.content).toContain('Chapter content');
    });
  });
});