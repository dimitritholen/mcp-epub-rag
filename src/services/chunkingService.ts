import { Document, DocumentChunk, ChunkMetadata } from '../types.js';
import { generateId } from '../utils/helpers.js';

export interface ChunkingOptions {
  chunkSize: number;
  chunkOverlap: number;
  preserveSentences?: boolean;
  preserveParagraphs?: boolean;
}

export class ChunkingService {
  private defaultOptions: ChunkingOptions = {
    chunkSize: 512,
    chunkOverlap: 50,
    preserveSentences: true,
    preserveParagraphs: true
  };

  chunkDocument(document: Document, options?: Partial<ChunkingOptions>): DocumentChunk[] {
    const opts = { ...this.defaultOptions, ...options };
    const chunks: DocumentChunk[] = [];
    
    // Split content into paragraphs first if preserveParagraphs is enabled
    const paragraphs = opts.preserveParagraphs 
      ? this.splitIntoParagraphs(document.content)
      : [document.content];
    
    let globalStartIndex = 0;
    let chunkIndex = 0;
    
    for (const paragraph of paragraphs) {
      const paragraphChunks = this.chunkText(
        paragraph,
        opts,
        globalStartIndex,
        chunkIndex,
        document.id
      );
      
      chunks.push(...paragraphChunks);
      globalStartIndex += paragraph.length + 1; // +1 for paragraph separator
      chunkIndex += paragraphChunks.length;
    }
    
    return chunks;
  }

  private splitIntoParagraphs(text: string): string[] {
    // Split by double newlines (paragraph breaks) and filter out empty strings
    return text
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }

  private chunkText(
    text: string,
    options: ChunkingOptions,
    globalStartIndex: number,
    startingChunkIndex: number,
    documentId: string
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    
    if (text.length <= options.chunkSize) {
      // Text is small enough to be a single chunk
      chunks.push(this.createChunk(
        text,
        globalStartIndex,
        globalStartIndex + text.length,
        startingChunkIndex,
        documentId
      ));
      return chunks;
    }

    let currentIndex = 0;
    let chunkIndex = startingChunkIndex;
    
    while (currentIndex < text.length) {
      let endIndex = Math.min(currentIndex + options.chunkSize, text.length);
      
      // If we're preserving sentences, try to end at a sentence boundary
      if (options.preserveSentences && endIndex < text.length) {
        endIndex = this.findSentenceBoundary(text, currentIndex, endIndex);
      }
      
      const chunkText = text.slice(currentIndex, endIndex).trim();
      
      if (chunkText.length > 0) {
        chunks.push(this.createChunk(
          chunkText,
          globalStartIndex + currentIndex,
          globalStartIndex + endIndex,
          chunkIndex,
          documentId
        ));
        chunkIndex++;
      }
      
      // Move to next chunk with overlap
      currentIndex = Math.max(
        endIndex - options.chunkOverlap,
        currentIndex + 1 // Ensure we always make progress
      );
    }
    
    return chunks;
  }

  private findSentenceBoundary(text: string, start: number, preferredEnd: number): number {
    // Look for sentence endings near the preferred end
    const searchStart = Math.max(start, preferredEnd - 100); // Look back up to 100 chars
    const searchText = text.slice(searchStart, preferredEnd + 50); // Look ahead up to 50 chars
    
    // Sentence ending patterns
    const sentenceEndings = /[.!?]\s+/g;
    let lastMatch = -1;
    let match;
    
    while ((match = sentenceEndings.exec(searchText)) !== null) {
      const absolutePosition = searchStart + match.index + match[0].length;
      if (absolutePosition <= preferredEnd + 50) {
        lastMatch = absolutePosition;
      }
    }
    
    // If we found a good sentence boundary, use it
    if (lastMatch > start) {
      return Math.min(lastMatch, text.length);
    }
    
    // Otherwise, try to break at word boundaries
    return this.findWordBoundary(text, start, preferredEnd);
  }

  private findWordBoundary(text: string, start: number, preferredEnd: number): number {
    // Look for word boundaries near the preferred end
    const searchStart = Math.max(start, preferredEnd - 50);
    
    // Find the last whitespace before or at the preferred end
    for (let i = Math.min(preferredEnd, text.length - 1); i >= searchStart; i--) {
      const char = text[i];
      if (char && /\s/.test(char)) {
        return i + 1; // Return position after the whitespace
      }
    }
    
    // If no word boundary found, use the preferred end
    return Math.min(preferredEnd, text.length);
  }

  private createChunk(
    content: string,
    startIndex: number,
    endIndex: number,
    chunkIndex: number,
    documentId: string
  ): DocumentChunk {
    const metadata: ChunkMetadata = {
      chunkIndex,
      // Additional metadata can be added here based on document type
    };

    return {
      id: generateId(),
      documentId,
      content,
      startIndex,
      endIndex,
      metadata
    };
  }

  // Utility method to rechunk a document with new options
  rechunkDocument(document: Document, newOptions: Partial<ChunkingOptions>): DocumentChunk[] {
    return this.chunkDocument(document, newOptions);
  }

  // Get statistics about chunking
  getChunkingStats(chunks: DocumentChunk[]): {
    totalChunks: number;
    averageChunkSize: number;
    minChunkSize: number;
    maxChunkSize: number;
    totalCharacters: number;
  } {
    if (chunks.length === 0) {
      return {
        totalChunks: 0,
        averageChunkSize: 0,
        minChunkSize: 0,
        maxChunkSize: 0,
        totalCharacters: 0
      };
    }

    const sizes = chunks.map(chunk => chunk.content.length);
    const totalCharacters = sizes.reduce((sum, size) => sum + size, 0);

    return {
      totalChunks: chunks.length,
      averageChunkSize: Math.round(totalCharacters / chunks.length),
      minChunkSize: Math.min(...sizes),
      maxChunkSize: Math.max(...sizes),
      totalCharacters
    };
  }
}