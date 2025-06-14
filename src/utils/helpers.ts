import crypto from 'crypto';
import path from 'path';
import fs from 'fs-extra';

/**
 * Generate a unique ID using crypto
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Generate a short ID (8 characters)
 */
export function generateShortId(): string {
  return crypto.randomBytes(4).toString('hex');
}

/**
 * Security limits for input validation
 */
export const SECURITY_LIMITS = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_QUERY_LENGTH: 1000,
  MAX_BATCH_SIZE: 50,
  MAX_PATH_LENGTH: 260,
  MAX_FILENAME_LENGTH: 255,
  TIMEOUT_MS: 30000
} as const;

/**
 * Validate file path and check if it exists with security protections
 */
export async function validateFilePath(filePath: string, allowedBaseDir?: string): Promise<{
  isValid: boolean;
  exists: boolean;
  isFile: boolean;
  error?: string;
}> {
  try {
    // Check if path is valid
    if (!filePath || typeof filePath !== 'string') {
      return {
        isValid: false,
        exists: false,
        isFile: false,
        error: 'Invalid file path'
      };
    }

    // Check path length
    if (filePath.length > SECURITY_LIMITS.MAX_PATH_LENGTH) {
      return {
        isValid: false,
        exists: false,
        isFile: false,
        error: 'File path too long'
      };
    }

    // Check for null bytes (directory traversal protection)
    if (filePath.includes('\0')) {
      return {
        isValid: false,
        exists: false,
        isFile: false,
        error: 'Invalid characters in path'
      };
    }

    // Normalize and resolve path to prevent directory traversal
    const normalizedPath = path.resolve(path.normalize(filePath));
    
    // Check against allowed base directory if provided
    const baseDir = allowedBaseDir ? path.resolve(allowedBaseDir) : process.cwd();
    if (!normalizedPath.startsWith(baseDir)) {
      return {
        isValid: false,
        exists: false,
        isFile: false,
        error: 'Path outside allowed directory'
      };
    }
    
    // Check if file exists
    const exists = await fs.pathExists(normalizedPath);
    if (!exists) {
      return {
        isValid: true,
        exists: false,
        isFile: false,
        error: 'File does not exist'
      };
    }

    // Check if it's a file (not directory)
    const stats = await fs.stat(normalizedPath);
    const isFile = stats.isFile();

    // Check file size
    if (isFile && stats.size > SECURITY_LIMITS.MAX_FILE_SIZE) {
      return {
        isValid: false,
        exists: true,
        isFile: true,
        error: `File too large (max ${formatFileSize(SECURITY_LIMITS.MAX_FILE_SIZE)})`
      };
    }

    return {
      isValid: true,
      exists: true,
      isFile,
      error: isFile ? undefined : 'Path is not a file'
    };
  } catch (error) {
    return {
      isValid: false,
      exists: false,
      isFile: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get file extension from path
 */
export function getFileExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/**
 * Check if file has supported extension
 */
export function isSupportedFileType(filePath: string): boolean {
  const supportedExtensions = ['.epub', '.pdf', '.mobi', '.docx', '.md'];
  const extension = getFileExtension(filePath);
  return supportedExtensions.includes(extension);
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format duration in human readable format
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Sanitize content to prevent XSS and injection attacks
 */
export function sanitizeContent(content: string): string {
  if (!content || typeof content !== 'string') {
    return '';
  }
  
  // Remove potentially harmful content
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/\0/g, '') // Remove null bytes
    .trim();
}

/**
 * Validate and sanitize search query
 */
export function validateSearchQuery(query: string): { isValid: boolean; sanitized: string; error?: string } {
  if (!query || typeof query !== 'string') {
    return {
      isValid: false,
      sanitized: '',
      error: 'Query must be a non-empty string'
    };
  }

  if (query.length > SECURITY_LIMITS.MAX_QUERY_LENGTH) {
    return {
      isValid: false,
      sanitized: '',
      error: `Query too long (max ${SECURITY_LIMITS.MAX_QUERY_LENGTH} characters)`
    };
  }

  const sanitized = sanitizeContent(query.trim());
  
  if (!sanitized) {
    return {
      isValid: false,
      sanitized: '',
      error: 'Query contains no valid content'
    };
  }

  return {
    isValid: true,
    sanitized
  };
}

/**
 * Sanitize filename for safe storage
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return 'unnamed_file';
  }

  // Check length
  if (filename.length > SECURITY_LIMITS.MAX_FILENAME_LENGTH) {
    filename = filename.substring(0, SECURITY_LIMITS.MAX_FILENAME_LENGTH);
  }

  return filename
    .replace(/[^a-z0-9.-]/gi, '_') // Replace invalid characters with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, '') // Remove leading/trailing underscores
    .replace(/^\.|\.$/g, '') // Remove leading/trailing dots
    .toLowerCase() || 'unnamed_file';
}

/**
 * Create a safe directory path
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.ensureDir(dirPath);
}

/**
 * Get relative path from base directory
 */
export function getRelativePath(filePath: string, baseDir: string): string {
  return path.relative(baseDir, filePath);
}

/**
 * Check if a string is a valid JSON
 */
export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Debounce function to limit function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function to limit function calls
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
  
  throw lastError!;
}

/**
 * Truncate text to specified length
 */
export function truncateText(text: string, maxLength: number, suffix: string = '...'): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Extract text preview from content
 */
export function extractPreview(content: string, maxLength: number = 200): string {
  // Remove extra whitespace and normalize
  const normalized = content
    .replace(/\s+/g, ' ')
    .trim();
  
  return truncateText(normalized, maxLength);
}

/**
 * Calculate percentage
 */
export function calculatePercentage(current: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((current / total) * 100);
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Get current timestamp
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Parse command line arguments
 */
export function parseCommandLineArgs(args: string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg && arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      
      if (nextArg && !nextArg.startsWith('--')) {
        parsed[key] = nextArg;
        i++; // Skip next argument as it's the value
      } else {
        parsed[key] = true;
      }
    }
  }
  
  return parsed;
}