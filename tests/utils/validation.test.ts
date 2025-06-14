import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  validateSearchQuery, 
  sanitizeContent, 
  SECURITY_LIMITS,
  validateFilePath 
} from '../../src/utils/helpers.js';
import fs from 'fs-extra';
import path from 'path';

vi.mock('fs-extra');

describe('Validation Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateSearchQuery', () => {
    it('should validate a proper search query', () => {
      const result = validateSearchQuery('machine learning algorithms');
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe('machine learning algorithms');
      expect(result.error).toBeUndefined();
    });

    it('should reject empty queries', () => {
      const result = validateSearchQuery('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Query must be a non-empty string');
    });

    it('should reject non-string queries', () => {
      const result = validateSearchQuery(null as any);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Query must be a non-empty string');
    });

    it('should reject queries that are too long', () => {
      const longQuery = 'a'.repeat(SECURITY_LIMITS.MAX_QUERY_LENGTH + 1);
      const result = validateSearchQuery(longQuery);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(`Query too long (max ${SECURITY_LIMITS.MAX_QUERY_LENGTH} characters)`);
    });

    it('should sanitize malicious content in queries', () => {
      const maliciousQuery = '<script>alert("xss")</script>search term';
      const result = validateSearchQuery(maliciousQuery);
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe('search term');
    });

    it('should reject queries with only malicious content', () => {
      const maliciousQuery = '<script>alert("xss")</script>';
      const result = validateSearchQuery(maliciousQuery);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Query contains no valid content');
    });

    it('should trim whitespace from queries', () => {
      const result = validateSearchQuery('  machine learning  ');
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe('machine learning');
    });
  });

  describe('sanitizeContent', () => {
    it('should remove script tags', () => {
      const malicious = 'Safe content <script>alert("xss")</script> more content';
      const result = sanitizeContent(malicious);
      expect(result).toBe('Safe content  more content');
    });

    it('should remove iframe tags', () => {
      const malicious = 'Content <iframe src="evil.com"></iframe> more content';
      const result = sanitizeContent(malicious);
      expect(result).toBe('Content  more content');
    });

    it('should remove javascript: URLs', () => {
      const malicious = 'Click <a href="javascript:alert(1)">here</a>';
      const result = sanitizeContent(malicious);
      expect(result).toBe('Click <a href="">here</a>');
    });

    it('should remove event handlers', () => {
      const malicious = '<div onclick="alert(1)">Click me</div>';
      const result = sanitizeContent(malicious);
      expect(result).toBe('<div >Click me</div>');
    });

    it('should remove null bytes', () => {
      const malicious = 'Safe content\0malicious';
      const result = sanitizeContent(malicious);
      expect(result).toBe('Safe contentmalicious');
    });

    it('should handle empty input', () => {
      expect(sanitizeContent('')).toBe('');
      expect(sanitizeContent(null as any)).toBe('');
      expect(sanitizeContent(undefined as any)).toBe('');
    });

    it('should preserve safe content', () => {
      const safe = 'This is safe content with <b>bold</b> text';
      const result = sanitizeContent(safe);
      expect(result).toBe(safe);
    });
  });

  describe('validateFilePath with security enhancements', () => {
    it('should reject paths that are too long', async () => {
      const longPath = '/'.repeat(SECURITY_LIMITS.MAX_PATH_LENGTH + 1);
      const result = await validateFilePath(longPath);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('File path too long');
    });

    it('should reject paths with null bytes', async () => {
      const maliciousPath = '/path/to/file\0.txt';
      const result = await validateFilePath(maliciousPath);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid characters in path');
    });

    it('should prevent directory traversal attacks', async () => {
      const traversalPath = '/allowed/../../etc/passwd';
      const baseDir = '/allowed';
      const result = await validateFilePath(traversalPath, baseDir);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Path outside allowed directory');
    });

    it('should reject files that are too large', async () => {
      const filePath = '/path/to/large-file.txt';
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => true,
        size: SECURITY_LIMITS.MAX_FILE_SIZE + 1
      } as any);

      const result = await validateFilePath(filePath);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('File too large');
    });

    it('should allow valid files within size limits', async () => {
      const filePath = '/path/to/valid-file.txt';
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => true,
        size: 1000
      } as any);

      const result = await validateFilePath(filePath);
      expect(result.isValid).toBe(true);
      expect(result.exists).toBe(true);
      expect(result.isFile).toBe(true);
    });

    it('should normalize paths correctly', async () => {
      const unnormalizedPath = '/path/./to/../to/file.txt';
      const baseDir = '/path';
      vi.mocked(fs.pathExists).mockResolvedValue(true);
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => true,
        size: 1000
      } as any);

      const result = await validateFilePath(unnormalizedPath, baseDir);
      expect(result.isValid).toBe(true);
    });

    it('should handle fs errors gracefully', async () => {
      const filePath = '/path/to/error-file.txt';
      vi.mocked(fs.pathExists).mockRejectedValue(new Error('Permission denied'));

      const result = await validateFilePath(filePath);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Permission denied');
    });
  });

  describe('SECURITY_LIMITS', () => {
    it('should have reasonable security limits', () => {
      expect(SECURITY_LIMITS.MAX_FILE_SIZE).toBe(100 * 1024 * 1024); // 100MB
      expect(SECURITY_LIMITS.MAX_QUERY_LENGTH).toBe(1000);
      expect(SECURITY_LIMITS.MAX_BATCH_SIZE).toBe(50);
      expect(SECURITY_LIMITS.MAX_PATH_LENGTH).toBe(260);
      expect(SECURITY_LIMITS.MAX_FILENAME_LENGTH).toBe(255);
      expect(SECURITY_LIMITS.TIMEOUT_MS).toBe(30000);
    });

    it('should be immutable', () => {
      expect(() => {
        (SECURITY_LIMITS as any).MAX_FILE_SIZE = 999;
      }).toThrow();
    });
  });
});