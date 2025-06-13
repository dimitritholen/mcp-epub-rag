import fs from 'fs-extra';
import EPub from 'epub2';
import { parse as parseHtml } from 'node-html-parser';
import { BaseDocumentParser, ParserOptions, ParseResult } from './BaseDocumentParser.js';
import { DocumentProcessingError } from '@/errors/DocumentProcessingError';

/**
 * EPUB document parser with enhanced error handling and metadata extraction
 */
export class EpubParser extends BaseDocumentParser {
  constructor() {
    super(['.epub'], 'EPUB');
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
          'epub',
          { fileSize: stats.size, maxFileSize: options.maxFileSize }
        );
      }

      // Check if file is readable
      await fs.access(filePath, fs.constants.R_OK);
      
      // Validate EPUB file signature (ZIP file starting with PK)
      const buffer = await fs.readFile(filePath);
      if (!this.isValidEpubSignature(buffer)) {
        throw new DocumentProcessingError(
          'Invalid EPUB file signature',
          filePath,
          'validation',
          'epub'
        );
      }
    } catch (error) {
      if (error instanceof DocumentProcessingError) {
        throw error;
      }
      
      throw new DocumentProcessingError(
        `EPUB validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath,
        'validation',
        'epub',
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
    return new Promise((resolve, reject) => {
      const epub = new EPub(filePath);
      let timeoutId: NodeJS.Timeout | undefined;
      
      // Set up timeout if specified
      if (options.timeout) {
        timeoutId = setTimeout(() => {
          reject(new DocumentProcessingError(
            `EPUB parsing timeout after ${options.timeout}ms`,
            filePath,
            'parsing',
            'epub'
          ));
        }, options.timeout);
      }

      epub.on('error', (error: Error) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(new DocumentProcessingError(
          `EPUB parsing error: ${error.message}`,
          filePath,
          'parsing',
          'epub',
          {},
          error
        ));
      });

      epub.on('end', async () => {
        try {
          if (timeoutId) clearTimeout(timeoutId);
          // Extract metadata (handle missing metadata gracefully)
          const metadata = this.extractEpubMetadata(epub) || {};
          const title = metadata['title'] || epub.metadata?.title || '';
          const author = metadata['author'] || epub.metadata?.creator || '';
          // Extract all chapters with progress tracking (handle missing/empty flow)
          const chapters: string[] = [];
          const totalChapters = Array.isArray(epub.flow) ? epub.flow.length : 0;
          if (totalChapters > 0) {
            for (let i = 0; i < totalChapters; i++) {
              const chapter = epub.flow[i];
              if (!chapter?.id) continue;
              // Update progress
              options.progressCallback?.({
                stage: 'parsing',
                percentage: 25 + (i / totalChapters) * 50,
                message: `Processing chapter ${i + 1} of ${totalChapters}...`
              });
              try {
                const chapterContent = await this.getChapterContent(epub, chapter.id);
                if (chapterContent && chapterContent.trim()) {
                  chapters.push(chapterContent);
                }
              } catch (chapterError) {
                // Log chapter error but continue with other chapters
                console.warn(`Failed to extract chapter ${chapter?.id}:`, chapterError);
              }
            }
          }
          // If no chapters, still return a valid document
          const content = this.cleanEpubText(chapters.join('\n\n'));
          resolve({
            content,
            title: title as string,
            author: author as string,
            metadata: {
              ...metadata,
              chapterCount: chapters.length,
              filePath,
              fileExtension
            }
          });
        } catch (error) {
          if (timeoutId) clearTimeout(timeoutId);
          reject(new DocumentProcessingError(
            `EPUB content extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            filePath,
            'parsing',
            'epub',
            {},
            error instanceof Error ? error : undefined
          ));
        }
      });

      epub.parse();
    });
  }

  private isValidEpubSignature(buffer: Buffer): boolean {
    // EPUB files are ZIP archives, should start with PK
    const signature = buffer.subarray(0, 2);
    return signature[0] === 0x50 && signature[1] === 0x4B; // PK
  }

  private async getChapterContent(epub: any, chapterId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      epub.getChapter(chapterId, (error: Error | null, text: string | undefined) => {
        if (error) {
          reject(error);
        } else {
          // Parse HTML and extract text
          const parsed = parseHtml(text || '');
          const textContent = parsed.text;
          resolve(textContent);
        }
      });
    });
  }

  private extractEpubMetadata(epub: any): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};
    // Defensive: handle missing metadata object
    if (epub.metadata && typeof epub.metadata === 'object') {
      metadata['title'] = epub.metadata.title || '';
      metadata['author'] = epub.metadata.creator || epub.metadata.author || '';
      metadata['publisher'] = epub.metadata.publisher || '';
      metadata['description'] = epub.metadata.description || '';
      metadata['language'] = epub.metadata.language || '';
      metadata['rights'] = epub.metadata.rights || '';
      metadata['date'] = epub.metadata.date || '';
      metadata['identifier'] = epub.metadata.identifier || '';
      metadata['subject'] = epub.metadata.subject || '';
    }
    // Defensive: handle missing spine/manifest
    if (epub.spine && Array.isArray(epub.spine)) {
      metadata['spineItems'] = epub.spine.length;
    } else {
      metadata['spineItems'] = 0;
    }
    if (epub.manifest && typeof epub.manifest === 'object') {
      metadata['manifestItems'] = Object.keys(epub.manifest).length;
    } else {
      metadata['manifestItems'] = 0;
    }
    return metadata;
  }

  private cleanEpubText(text: string): string {
    return text
      // Remove HTML entities that might have been missed
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x?[0-9a-fA-F]+;/g, ' ')
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Normalize line breaks
      .replace(/\n{3,}/g, '\n\n')
      // Clean up spacing
      .replace(/[ \t]+/g, ' ')
      .replace(/[ \t]*\n[ \t]*/g, '\n')
      .trim();
  }
}
