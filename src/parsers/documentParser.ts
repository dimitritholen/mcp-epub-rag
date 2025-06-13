import fs from 'fs-extra';
import path from 'path';
import { parse as parseHtml } from 'node-html-parser';
import { marked } from 'marked';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import EPub from 'epub2';
import { Document, DocumentMetadata, DocumentProcessingError } from '../types.js';
import { generateId } from '../utils/helpers.js';

export class DocumentParser {
  private supportedExtensions = ['.epub', '.pdf', '.mobi', '.docx', '.md'];

  async parseDocument(filePath: string): Promise<Document> {
    try {
      if (!await fs.pathExists(filePath)) {
        throw new DocumentProcessingError(`File not found: ${filePath}`, filePath);
      }

      const stats = await fs.stat(filePath);
      const extension = path.extname(filePath).toLowerCase();
      
      if (!this.supportedExtensions.includes(extension)) {
        throw new DocumentProcessingError(
          `Unsupported file type: ${extension}. Supported types: ${this.supportedExtensions.join(', ')}`,
          filePath
        );
      }

      const metadata: DocumentMetadata = {
        filePath,
        fileType: extension.slice(1) as any,
        createdAt: stats.birthtime,
        lastModified: stats.mtime,
        fileSize: stats.size
      };

      let content: string;
      let title: string;

      switch (extension) {
        case '.epub':
          ({ content, title } = await this.parseEpub(filePath));
          break;
        case '.pdf':
          ({ content, title } = await this.parsePdf(filePath));
          break;
        case '.mobi':
          ({ content, title } = await this.parseMobi(filePath));
          break;
        case '.docx':
          ({ content, title } = await this.parseDocx(filePath));
          break;
        case '.md':
          ({ content, title } = await this.parseMarkdown(filePath));
          break;
        default:
          throw new DocumentProcessingError(`Unsupported file type: ${extension}`, filePath);
      }

      const document: Document = {
        id: generateId(),
        title: title || path.basename(filePath, extension),
        content,
        metadata,
        chunks: [] // Will be populated by the chunking service
      };

      return document;
    } catch (error) {
      if (error instanceof DocumentProcessingError) {
        throw error;
      }
      throw new DocumentProcessingError(
        `Failed to parse document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath,
        error instanceof Error ? error : undefined
      );
    }
  }

  private async parseEpub(filePath: string): Promise<{ content: string; title: string }> {
    return new Promise((resolve, reject) => {
      const epub = new EPub(filePath);
      
      epub.on('error', (error) => {
        reject(new DocumentProcessingError(`EPUB parsing error: ${error.message}`, filePath, error));
      });

      epub.on('end', async () => {
        try {
          const title = epub.metadata?.title || path.basename(filePath, path.extname(filePath));
          const chapters: string[] = [];

          // Get all chapters
          for (const chapter of epub.flow) {
            const chapterContent = await new Promise<string>((resolveChapter, rejectChapter) => {
              epub.getChapter(chapter.id || '', (error: any, text: string | undefined) => {
                if (error) {
                  rejectChapter(error);
                } else {
                  resolveChapter(text || '');
                }
              });
            });
            
            // Parse HTML and extract text
            const parsed = parseHtml(chapterContent);
            const textContent = parsed.text;
            if (textContent.trim()) {
              chapters.push(textContent);
            }
          }

          const content = chapters.join('\n\n');
          resolve({ content, title });
        } catch (error) {
          reject(new DocumentProcessingError(
            `Error extracting EPUB content: ${error instanceof Error ? error.message : 'Unknown error'}`,
            filePath,
            error instanceof Error ? error : undefined
          ));
        }
      });

      epub.parse();
    });
  }

  private async parsePdf(filePath: string): Promise<{ content: string; title: string }> {
    try {
      const buffer = await fs.readFile(filePath);
      const data = await pdfParse(buffer);
      
      return {
        content: data.text,
        title: data.info?.Title || ''
      };
    } catch (error) {
      throw new DocumentProcessingError(
        `PDF parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath,
        error instanceof Error ? error : undefined
      );
    }
  }

  private async parseMobi(filePath: string): Promise<{ content: string; title: string }> {
    // Note: MOBI parsing is complex and would typically require a specialized library
    // For now, we'll throw an error suggesting conversion to EPUB
    throw new DocumentProcessingError(
      'MOBI format is not yet supported. Please convert to EPUB format.',
      filePath
    );
  }

  private async parseDocx(filePath: string): Promise<{ content: string; title: string }> {
    try {
      const buffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer });
      
      return {
        content: result.value,
        title: '' // DOCX doesn't have a standard title field in the content
      };
    } catch (error) {
      throw new DocumentProcessingError(
        `DOCX parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath,
        error instanceof Error ? error : undefined
      );
    }
  }

  private async parseMarkdown(filePath: string): Promise<{ content: string; title: string }> {
    try {
      const markdownContent = await fs.readFile(filePath, 'utf-8');
      
      // Extract title from first heading or filename
      const titleMatch = markdownContent.match(/^#\s+(.+)$/m);
      const title = titleMatch?.[1] || path.basename(filePath, path.extname(filePath));
      
      // Convert markdown to HTML then extract text
      const html = await marked(markdownContent);
      const parsed = parseHtml(html);
      const content = parsed.text;
      
      return { content, title };
    } catch (error) {
      throw new DocumentProcessingError(
        `Markdown parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath,
        error instanceof Error ? error : undefined
      );
    }
  }

  getSupportedExtensions(): string[] {
    return [...this.supportedExtensions];
  }

  isSupported(filePath: string): boolean {
    const extension = path.extname(filePath).toLowerCase();
    return this.supportedExtensions.includes(extension);
  }
}