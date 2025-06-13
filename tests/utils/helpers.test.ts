import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from 'fs-extra';
import path from 'path';
import { generateId, generateShortId, validateFilePath } from '../../src/utils/helpers';
import { testPaths } from '../setup';

describe('Helper Functions', () => {
  describe('generateId', () => {
    it('should generate a unique ID', () => {
      const id1 = generateId();
      const id2 = generateId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });

    it('should generate IDs with consistent format', () => {
      const id = generateId();
      // Should be a UUID-like format or timestamp-based
      expect(id).toMatch(/^[a-zA-Z0-9-_]+$/);
    });
  });

  describe('generateShortId', () => {
    it('should generate a short ID', () => {
      const shortId1 = generateShortId();
      const shortId2 = generateShortId();
      
      expect(shortId1).toBeDefined();
      expect(shortId2).toBeDefined();
      expect(shortId1).not.toBe(shortId2);
      expect(typeof shortId1).toBe('string');
      expect(shortId1.length).toBeLessThanOrEqual(12);
    });

    it('should generate IDs shorter than regular IDs', () => {
      const id = generateId();
      const shortId = generateShortId();
      
      expect(shortId.length).toBeLessThan(id.length);
    });
  });

  describe('validateFilePath', () => {
    let testFile: string;
    
    beforeEach(async () => {
      testFile = path.join(testPaths.dataDir, 'test-file.txt');
      await fs.writeFile(testFile, 'test content');
    });
    
    afterEach(async () => {
      try {
        await fs.remove(testFile);
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should return true for existing files', async () => {
      const result = await validateFilePath(testFile);
      expect(result.isValid).toBe(true);
      expect(result.exists).toBe(true);
      expect(result.isFile).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return false for non-existing files', async () => {
      const nonExistentFile = path.join(testPaths.dataDir, 'non-existent.txt');
      const result = await validateFilePath(nonExistentFile);
      expect(result.isValid).toBe(true);
      expect(result.exists).toBe(false);
      expect(result.isFile).toBe(false);
      expect(result.error).toBe('File does not exist');
    });

    it('should return false for directories', async () => {
      const result = await validateFilePath(testPaths.dataDir);
      expect(result.isValid).toBe(true);
      expect(result.exists).toBe(true);
      expect(result.isFile).toBe(false);
      expect(result.error).toBe('Path is not a file');
    });

    it('should handle invalid paths gracefully', async () => {
      const invalidPath = '';
      const result = await validateFilePath(invalidPath);
      expect(result.isValid).toBe(false);
      expect(result.exists).toBe(false);
      expect(result.isFile).toBe(false);
      expect(result.error).toBe('Invalid file path');
    });

    it('should normalize paths correctly', async () => {
      const unnormalizedPath = path.join(testPaths.dataDir, '..', path.basename(testPaths.dataDir), 'test-file.txt');
      const result = await validateFilePath(unnormalizedPath);
      expect(result.isValid).toBe(true);
      expect(result.exists).toBe(true);
      expect(result.isFile).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});