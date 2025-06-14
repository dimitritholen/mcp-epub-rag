import { logger } from '../utils/logging/logger.js';

/**
 * Cache entry interface
 */
export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  size: number;
  accessCount: number;
  lastAccessed: number;
}

/**
 * Cache statistics interface
 */
export interface CacheStats {
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  cacheSize: number;
  memoryUsage: number;
  entryCount: number;
  oldestEntry?: number;
  newestEntry?: number;
}

/**
 * Cache configuration interface
 */
export interface CacheConfig {
  maxSize: number; // Maximum number of entries
  maxMemory: number; // Maximum memory usage in bytes
  defaultTtl: number; // Default TTL in milliseconds
  cleanupInterval: number; // Cleanup interval in milliseconds
  enableStats: boolean; // Enable statistics tracking
}

/**
 * In-memory caching service for frequently accessed data
 * Implements LRU eviction policy with TTL support
 */
export class CacheService {
  private cache = new Map<string, CacheEntry>();
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    memoryUsage: 0
  };
  private cleanupTimer?: NodeJS.Timeout;

  constructor(private config: CacheConfig) {
    this.startCleanupTimer();
    
    logger.info({
      maxSize: config.maxSize,
      maxMemory: config.maxMemory,
      defaultTtl: config.defaultTtl
    }, 'Cache service initialized');
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      if (this.config.enableStats) {
        logger.debug({ key, result: 'miss' }, 'Cache access');
      }
      return null;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.delete(key);
      this.stats.misses++;
      if (this.config.enableStats) {
        logger.debug({ key, result: 'expired' }, 'Cache access');
      }
      return null;
    }

    // Update access information
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;

    if (this.config.enableStats) {
      logger.debug({ 
        key, 
        result: 'hit',
        accessCount: entry.accessCount,
        age: Date.now() - entry.timestamp
      }, 'Cache access');
    }

    return entry.value as T;
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const entryTtl = ttl ?? this.config.defaultTtl;
    const size = this.calculateSize(value);

    // Check if we need to evict entries
    this.evictIfNecessary(size);

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: now,
      ttl: entryTtl,
      size,
      accessCount: 0,
      lastAccessed: now
    };

    // Remove existing entry if present
    const existingEntry = this.cache.get(key);
    if (existingEntry) {
      this.stats.memoryUsage -= existingEntry.size;
    }

    this.cache.set(key, entry);
    this.stats.memoryUsage += size;

    logger.debug({
      key,
      size,
      ttl: entryTtl,
      cacheSize: this.cache.size,
      memoryUsage: this.stats.memoryUsage
    }, 'Cache entry set');
  }

  /**
   * Check if key exists in cache (without updating access stats)
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    return entry !== undefined && !this.isExpired(entry);
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.stats.memoryUsage -= entry.size;
      this.cache.delete(key);
      logger.debug({ key, size: entry.size }, 'Cache entry deleted');
      return true;
    }
    return false;
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    const entryCount = this.cache.size;
    const memoryUsage = this.stats.memoryUsage;
    
    this.cache.clear();
    this.stats.memoryUsage = 0;
    
    logger.info({ 
      entriesCleared: entryCount,
      memoryFreed: memoryUsage
    }, 'Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalAccess = this.stats.hits + this.stats.misses;
    const entries = Array.from(this.cache.values());
    
    const stats: CacheStats = {
      hitRate: totalAccess > 0 ? this.stats.hits / totalAccess : 0,
      missRate: totalAccess > 0 ? this.stats.misses / totalAccess : 0,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      cacheSize: this.cache.size,
      memoryUsage: this.stats.memoryUsage,
      entryCount: this.cache.size
    };

    if (entries.length > 0) {
      stats.oldestEntry = Math.min(...entries.map(e => e.timestamp));
      stats.newestEntry = Math.max(...entries.map(e => e.timestamp));
    }
    
    return stats;
  }

  /**
   * Get or set pattern with loader function
   */
  async getOrSet<T>(
    key: string,
    loader: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await loader();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Get multiple keys at once
   */
  getMultiple<T>(keys: string[]): Map<string, T | null> {
    const result = new Map<string, T | null>();
    for (const key of keys) {
      result.set(key, this.get<T>(key));
    }
    return result;
  }

  /**
   * Set multiple entries at once
   */
  setMultiple<T>(entries: Array<{ key: string; value: T; ttl?: number }>): void {
    for (const entry of entries) {
      this.set(entry.key, entry.value, entry.ttl);
    }
  }

  /**
   * Invalidate entries by pattern
   */
  invalidatePattern(pattern: string | RegExp): number {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
    }

    logger.debug({ 
      pattern: pattern.toString(),
      deletedKeys: keysToDelete.length
    }, 'Cache pattern invalidation');

    return keysToDelete.length;
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.delete(key);
    }

    if (expiredKeys.length > 0) {
      logger.debug({ expiredKeys: expiredKeys.length }, 'Cache cleanup completed');
    }

    return expiredKeys.length;
  }

  /**
   * Destroy cache service and cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
    logger.info('Cache service destroyed');
  }

  /**
   * Check if entry has expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Calculate approximate size of value in bytes
   */
  private calculateSize(value: unknown): number {
    if (value === null || value === undefined) {
      return 8;
    }

    if (typeof value === 'string') {
      return value.length * 2; // Approximate UTF-16 encoding
    }

    if (typeof value === 'number') {
      return 8;
    }

    if (typeof value === 'boolean') {
      return 4;
    }

    if (typeof value === 'object') {
      try {
        return JSON.stringify(value).length * 2; // Approximate size
      } catch {
        return 1024; // Fallback for non-serializable objects
      }
    }

    return 64; // Default fallback
  }

  /**
   * Evict entries if necessary to make room
   */
  private evictIfNecessary(newEntrySize: number): void {
    // Check size limit
    while (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    // Check memory limit
    while (this.stats.memoryUsage + newEntrySize > this.config.maxMemory) {
      this.evictLRU();
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.delete(lruKey);
      this.stats.evictions++;
      logger.debug({ 
        evictedKey: lruKey,
        lastAccessed: lruTime,
        evictions: this.stats.evictions
      }, 'LRU eviction');
    }
  }

  /**
   * Start periodic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }
}

/**
 * Default cache configuration
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxSize: 1000,
  maxMemory: 100 * 1024 * 1024, // 100MB
  defaultTtl: 30 * 60 * 1000, // 30 minutes
  cleanupInterval: 5 * 60 * 1000, // 5 minutes
  enableStats: true
};

/**
 * Global cache instance
 */
let globalCacheInstance: CacheService | null = null;

/**
 * Get or create global cache instance
 */
export function getGlobalCache(config: Partial<CacheConfig> = {}): CacheService {
  if (!globalCacheInstance) {
    globalCacheInstance = new CacheService({ ...DEFAULT_CACHE_CONFIG, ...config });
  }
  return globalCacheInstance;
}

/**
 * Destroy global cache instance
 */
export function destroyGlobalCache(): void {
  if (globalCacheInstance) {
    globalCacheInstance.destroy();
    globalCacheInstance = null;
  }
}