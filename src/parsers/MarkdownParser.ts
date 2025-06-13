import fs from 'fs-extra';
import path from 'path';
import { marked } from 'marked';
import { parse as parseHtml } from 'node-html-parser';
import { BaseDocumentParser, ParserOptions, ParseResult } from './BaseDocumentParser.js';
import { DocumentProcessingError } from '@/errors/DocumentProcessingError';

/**
 * Markdown document parser with enhanced error handling and metadata extraction
 */
export class MarkdownParser extends BaseDocumentParser {
  constructor() {
    super(['.md', '.markdown', '.mdown', '.mkd'], 'Markdown');
  }

  protected async validateFile(filePath: string, options: ParserOptions): Promise<void> {
    try {
      const stats = await fs.stat(filePath);
      
      // Check file size limits
      if (options.maxFileSize && stats.size > options.maxFileSize) {
        throw new DocumentProcessingError(
          `File size (${stats.size} bytes) exceeds maximum allowed size (${options.maxFileSize} bytes)`,
          filePath,
          'validation',
          'md',
          { fileSize: stats.size, maxFileSize: options.maxFileSize }
        );
      }

      // Check if file is readable
      await fs.access(filePath, fs.constants.R_OK);
    } catch (error) {
      if (error instanceof DocumentProcessingError) {
        throw error;
      }
      
      throw new DocumentProcessingError(
        `File validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath,
        'validation',
        'md',
        {},
        error instanceof Error ? error : undefined
      );
    }
  }

  protected async parseInternal(
    filePath: string,
    fileExtension: string,
    options: ParserOptions
  ): Promise<ParseResult> {
    try {
      // Read file with timeout
      const content = await this.readFileWithTimeout(filePath, options.timeout);
      
      // Extract metadata from frontmatter if present
      const { content: markdownContent, metadata } = this.extractFrontmatter(content);
      
      // Extract title from content or frontmatter
      const title = this.extractTitle(markdownContent, metadata);
      
      // Convert markdown to plain text
      const plainText = await this.convertToPlainText(markdownContent, options);
      
      return {
        content: plainText,
        title,
        author: metadata.author as string,
        metadata: {
          ...metadata,
          originalMarkdown: options.preserveFormatting ? markdownContent : undefined,
          filePath,
          fileExtension
        }
      };
    } catch (error) {
      throw new DocumentProcessingError(
        `Markdown parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath,
        'parsing',
        'md',
        {},
        error instanceof Error ? error : undefined
      );
    }
  }

  private async readFileWithTimeout(filePath: string, timeout?: number): Promise<string> {
    const readPromise = fs.readFile(filePath, 'utf-8');
    
    if (!timeout) {
      return readPromise;
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`File reading timeout after ${timeout}ms`));
      }, timeout);
    });

    return Promise.race([readPromise, timeoutPromise]);
  }

  private extractFrontmatter(content: string): { content: string; metadata: Record<string, unknown> } {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    
    if (!match) {
      return { content, metadata: {} };
    }

    const [, frontmatterYaml, markdownContent] = match;
    
    try {
      // Simple YAML-like parsing for common frontmatter fields
      const metadata: Record<string, unknown> = {};
      const lines = frontmatterYaml.split('\n');
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) continue;
        
        const colonIndex = trimmedLine.indexOf(':');
        if (colonIndex === -1) continue;
        
        const key = trimmedLine.slice(0, colonIndex).trim();
        const value = trimmedLine.slice(colonIndex + 1).trim();
        
        // Remove quotes if present
        const cleanValue = value.replace(/^["']|["']$/g, '');
        metadata[key] = cleanValue;
      }
      
      return { content: markdownContent, metadata };
    } catch (error) {
      // If frontmatter parsing fails, return original content without metadata
      return { content, metadata: {} };
    }
  }

  private extractTitle(content: string, metadata: Record<string, unknown>): string | undefined {
    // First try to get title from frontmatter
    if (metadata.title && typeof metadata.title === 'string') {
      return metadata.title;
    }

    // Then try to extract from first heading
    const headingMatch = content.match(/^#+\s+(.+)$/m);
    if (headingMatch) {
      return headingMatch[1]?.trim();
    }

    return undefined;
  }

  private async convertToPlainText(markdownContent: string, options: ParserOptions): Promise<string> {
    try {
      // Configure marked options
      const markedOptions: marked.MarkedOptions = {
        breaks: true,
        gfm: true,
        sanitize: false,
        smartypants: false
      };

      // Convert markdown to HTML
      const html = await marked(markdownContent, markedOptions);
      
      // Parse HTML and extract text
      const parsed = parseHtml(html);
      let plainText = parsed.text;

      // Clean up the extracted text
      plainText = plainText
        .replace(/\n\s*\n\s*\n/g, '\n\n')  // Normalize multiple line breaks
        .replace(/[ \t]+/g, ' ')           // Normalize spaces
        .trim();

      return plainText;
    } catch (error) {
      throw new Error(`Markdown to text conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
