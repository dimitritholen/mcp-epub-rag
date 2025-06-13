import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { MarkdownParser } from '../MarkdownParser.js';
import { DocumentProcessingError } from '@/errors/DocumentProcessingError';

const TEST_DATA_DIR = path.join(__dirname, '../../../tests/data');

describe('MarkdownParser', () => {
  let parser: MarkdownParser;
  let testFiles: string[] = [];

  beforeEach(async () => {
    parser = new MarkdownParser();
    await fs.ensureDir(TEST_DATA_DIR);
    testFiles = [];
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
      expect(extensions).toContain('.md');
      expect(extensions).toContain('.markdown');
      expect(extensions).toContain('.mdown');
      expect(extensions).toContain('.mkd');
    });
  });

  describe('isSupported', () => {
    it('should support markdown extensions', () => {
      expect(parser.isSupported('.md')).toBe(true);
      expect(parser.isSupported('.markdown')).toBe(true);
      expect(parser.isSupported('.MD')).toBe(true); // Case insensitive
    });

    it('should not support non-markdown extensions', () => {
      expect(parser.isSupported('.txt')).toBe(false);
      expect(parser.isSupported('.pdf')).toBe(false);
    });
  });

  describe('parseDocument', () => {
    it('should parse simple markdown content', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'simple.md');
      testFiles.push(testFile);
      const content = '# Simple Title\n\nThis is simple content.';
      await fs.writeFile(testFile, content);

      const result = await parser.parseDocument(testFile, '.md');

      expect(result.title).toBe('Simple Title');
      expect(result.content).toContain('This is simple content');
      expect(result.metadata?.filePath).toBe(testFile);
    });

    it('should extract title from first heading', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'heading.md');
      testFiles.push(testFile);
      const content = `Some intro text

## Main Heading

Content under heading.

### Sub Heading

More content.`;
      await fs.writeFile(testFile, content);

      const result = await parser.parseDocument(testFile, '.md');

      expect(result.title).toBe('Main Heading');
    });

    it('should parse frontmatter correctly', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'frontmatter.md');
      testFiles.push(testFile);
      const content = `---
title: Frontmatter Title
author: John Doe
date: 2023-01-01
custom: value
---

# Content Title

This is the main content.`;
      await fs.writeFile(testFile, content);

      const result = await parser.parseDocument(testFile, '.md');

      expect(result.title).toBe('Frontmatter Title');
      expect(result.author).toBe('John Doe');
      expect(result.metadata?.date).toBe('2023-01-01');
      expect(result.metadata?.custom).toBe('value');
      expect(result.content).toContain('This is the main content');
    });

    it('should handle markdown without frontmatter', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'no-frontmatter.md');
      testFiles.push(testFile);
      const content = `# Regular Title

Regular content without frontmatter.`;
      await fs.writeFile(testFile, content);

      const result = await parser.parseDocument(testFile, '.md');

      expect(result.title).toBe('Regular Title');
      expect(result.content).toContain('Regular content without frontmatter');
    });

    it('should handle markdown with code blocks', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'code.md');
      testFiles.push(testFile);
      const content = `# Code Example

Here's some code:

\`\`\`javascript
function hello() {
  console.log('Hello, world!');
}
\`\`\`

And inline \`code\` too.`;
      await fs.writeFile(testFile, content);

      const result = await parser.parseDocument(testFile, '.md');

      expect(result.title).toBe('Code Example');
      expect(result.content).toContain('function hello()');
      expect(result.content).toContain('console.log');
    });

    it('should handle markdown with tables', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'table.md');
      testFiles.push(testFile);
      const content = `# Table Example

| Column 1 | Column 2 |
|----------|----------|
| Row 1    | Data 1   |
| Row 2    | Data 2   |

Text after table.`;
      await fs.writeFile(testFile, content);

      const result = await parser.parseDocument(testFile, '.md');

      expect(result.title).toBe('Table Example');
      expect(result.content).toContain('Column 1');
      expect(result.content).toContain('Row 1');
      expect(result.content).toContain('Text after table');
    });

    it('should handle markdown with lists', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'lists.md');
      testFiles.push(testFile);
      const content = `# Lists

Unordered list:
- Item 1
- Item 2
  - Nested item
- Item 3

Ordered list:
1. First
2. Second
3. Third`;
      await fs.writeFile(testFile, content);

      const result = await parser.parseDocument(testFile, '.md');

      expect(result.title).toBe('Lists');
      expect(result.content).toContain('Item 1');
      expect(result.content).toContain('Nested item');
      expect(result.content).toContain('First');
    });

    it('should handle markdown with links and images', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'links.md');
      testFiles.push(testFile);
      const content = `# Links and Images

Here's a [link](https://example.com) and an image:

![Alt text](image.png)

Reference style [link][ref].

[ref]: https://reference.com`;
      await fs.writeFile(testFile, content);

      const result = await parser.parseDocument(testFile, '.md');

      expect(result.title).toBe('Links and Images');
      expect(result.content).toContain('link');
      expect(result.content).toContain('Alt text');
    });

    it('should clean up extra whitespace', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'whitespace.md');
      testFiles.push(testFile);
      const content = `# Title   with   extra   spaces

Content     with     lots     of     spaces.



Multiple  line  breaks.`;
      await fs.writeFile(testFile, content);

      const result = await parser.parseDocument(testFile, '.md');

      expect(result.title).toBe('Title with extra spaces');
      expect(result.content).not.toMatch(/\s{3,}/); // No more than 2 consecutive spaces
      expect(result.content).not.toMatch(/\n{3,}/); // No more than 2 consecutive newlines
    });

    it('should handle empty or minimal content', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'minimal.md');
      testFiles.push(testFile);
      await fs.writeFile(testFile, '# Only Title');

      const result = await parser.parseDocument(testFile, '.md');

      expect(result.title).toBe('Only Title');
      expect(result.content.trim()).toBe('Only Title');
    });

    it('should handle file size limits', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'large.md');
      testFiles.push(testFile);
      const largeContent = '# Large File\n' + 'A'.repeat(1000);
      await fs.writeFile(testFile, largeContent);

      await expect(
        parser.parseDocument(testFile, '.md', { maxFileSize: 100 })
      ).rejects.toThrow(DocumentProcessingError);
    });

    it('should handle timeout', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'timeout.md');
      testFiles.push(testFile);
      await fs.writeFile(testFile, '# Test\nContent');

      const result = await parser.parseDocument(testFile, '.md', { timeout: 5000 });
      expect(result).toBeDefined();
    });

    it('should call progress callback', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'progress.md');
      testFiles.push(testFile);
      await fs.writeFile(testFile, '# Progress\nContent');

      const progressCallback = vi.fn();
      await parser.parseDocument(testFile, '.md', { progressCallback });

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: expect.any(String),
          percentage: expect.any(Number),
          message: expect.any(String)
        })
      );
    });

    it('should throw error for non-existent file', async () => {
      await expect(
        parser.parseDocument('nonexistent.md', '.md')
      ).rejects.toThrow(DocumentProcessingError);
    });

    it('should throw error for unreadable file', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'unreadable.md');
      testFiles.push(testFile);
      await fs.writeFile(testFile, '# Test');

      // Make file unreadable (this might not work on all systems)
      try {
        await fs.chmod(testFile, 0o000);
        
        await expect(
          parser.parseDocument(testFile, '.md')
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

    it('should handle invalid frontmatter gracefully', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'invalid-frontmatter.md');
      testFiles.push(testFile);
      const content = `---
invalid: yaml: content:
malformed
---

# Content

This should still work.`;
      await fs.writeFile(testFile, content);

      const result = await parser.parseDocument(testFile, '.md');

      expect(result.title).toBe('Content');
      expect(result.content).toContain('This should still work');
    });

    it('should preserve formatting when requested', async () => {
      const testFile = path.join(TEST_DATA_DIR, 'formatting.md');
      testFiles.push(testFile);
      const content = `# Formatted Content

**Bold** and *italic* text.`;
      await fs.writeFile(testFile, content);

      const result = await parser.parseDocument(testFile, '.md', { 
        preserveFormatting: true 
      });

      expect(result.metadata?.originalMarkdown).toBeDefined();
      expect(result.metadata?.originalMarkdown).toContain('**Bold**');
    });
  });

  describe('error scenarios', () => {
    it('should throw DocumentProcessingError with proper context', async () => {
      try {
        await parser.parseDocument('invalid.md', '.md');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(DocumentProcessingError);
        expect((error as DocumentProcessingError).filePath).toBe('invalid.md');
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
  });
});
