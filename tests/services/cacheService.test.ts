import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheService, DEFAULT_CACHE_CONFIG, getGlobalCache, destroyGlobalCache } from '../../src/services/cacheService.js';

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService({
      ...DEFAULT_CACHE_CONFIG,
      maxSize: 10,
      maxMemory: 1024, // 1KB for testing
      defaultTtl: 1000, // 1 second
      cleanupInterval: 500 // 0.5 seconds
    });
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('Basic Operations', () => {
    it('should set and get values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return null for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should check if key exists', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should delete entries', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeNull();
      expect(cache.delete('nonexistent')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should respect custom TTL', async () => {
      cache.set('key1', 'value1', 100); // 100ms TTL
      expect(cache.get('key1')).toBe('value1');
      
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(cache.get('key1')).toBeNull();
    });

    it('should use default TTL when not specified', async () => {
      cache.set('key1', 'value1'); // Uses default 1000ms TTL
      expect(cache.get('key1')).toBe('value1');
      
      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(cache.get('key1')).toBeNull();
    });

    it('should not return expired entries', async () => {
      cache.set('key1', 'value1', 50);
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(cache.has('key1')).toBe(false);
    });
  });

  describe('Size and Memory Limits', () => {
    it('should evict entries when size limit exceeded', () => {
      // Fill cache to capacity
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      
      // Add one more to trigger eviction
      cache.set('newkey', 'newvalue');
      
      const stats = cache.getStats();
      expect(stats.cacheSize).toBe(10); // Should maintain max size
    });

    it('should evict LRU entries when memory limit exceeded', () => {
      // Set large values to exceed memory limit
      const largeValue = 'x'.repeat(200); // 400 bytes per entry
      
      cache.set('key1', largeValue);
      cache.set('key2', largeValue);
      cache.set('key3', largeValue); // Should trigger eviction
      
      // key1 should be evicted (least recently used)
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBe(largeValue);
      expect(cache.get('key3')).toBe(largeValue);
    });

    it('should track memory usage accurately', () => {
      cache.set('small', 'x');
      const statsAfterSmall = cache.getStats();
      
      cache.set('large', 'x'.repeat(100));
      const statsAfterLarge = cache.getStats();
      
      expect(statsAfterLarge.memoryUsage).toBeGreaterThan(statsAfterSmall.memoryUsage);
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used entries', () => {
      // Fill cache
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      
      // Access key0 to make it recently used
      cache.get('key0');
      
      // Add new entry to trigger eviction
      cache.set('newkey', 'newvalue');
      
      // key0 should still exist (recently accessed)
      expect(cache.get('key0')).toBe('value0');
      // key1 should be evicted (least recently used)
      expect(cache.get('key1')).toBeNull();
    });

    it('should update access time on get', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      // Access key1 to make it more recently used
      cache.get('key1');
      
      // Fill cache to trigger eviction
      for (let i = 3; i < 12; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      
      // key1 should survive (recently accessed)
      expect(cache.get('key1')).toBe('value1');
      // key2 should be evicted
      expect(cache.get('key2')).toBeNull();
    });
  });

  describe('Batch Operations', () => {
    it('should get multiple keys at once', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      const results = cache.getMultiple(['key1', 'key2', 'nonexistent']);
      expect(results.get('key1')).toBe('value1');
      expect(results.get('key2')).toBe('value2');
      expect(results.get('nonexistent')).toBeNull();
    });

    it('should set multiple entries at once', () => {
      const entries = [
        { key: 'key1', value: 'value1', ttl: 2000 },
        { key: 'key2', value: 'value2' },
        { key: 'key3', value: 'value3', ttl: 500 }
      ];
      
      cache.setMultiple(entries);
      
      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
    });
  });

  describe('Pattern Operations', () => {
    it('should invalidate entries by string pattern', () => {
      cache.set('user:1', 'data1');
      cache.set('user:2', 'data2');
      cache.set('admin:1', 'admin-data');
      
      const deleted = cache.invalidatePattern('user:');
      expect(deleted).toBe(2);
      
      expect(cache.get('user:1')).toBeNull();
      expect(cache.get('user:2')).toBeNull();
      expect(cache.get('admin:1')).toBe('admin-data');
    });

    it('should invalidate entries by regex pattern', () => {
      cache.set('cache:item:1', 'data1');
      cache.set('cache:item:2', 'data2');
      cache.set('other:item:1', 'data3');
      
      const deleted = cache.invalidatePattern(/^cache:/);
      expect(deleted).toBe(2);
      
      expect(cache.get('cache:item:1')).toBeNull();
      expect(cache.get('cache:item:2')).toBeNull();
      expect(cache.get('other:item:1')).toBe('data3');
    });
  });

  describe('getOrSet Pattern', () => {
    it('should return cached value if exists', async () => {
      cache.set('key1', 'cached-value');
      
      const loader = vi.fn().mockResolvedValue('new-value');
      const result = await cache.getOrSet('key1', loader);
      
      expect(result).toBe('cached-value');
      expect(loader).not.toHaveBeenCalled();
    });

    it('should call loader and cache result if not exists', async () => {
      const loader = vi.fn().mockResolvedValue('loaded-value');
      const result = await cache.getOrSet('key1', loader, 2000);
      
      expect(result).toBe('loaded-value');
      expect(loader).toHaveBeenCalledOnce();
      expect(cache.get('key1')).toBe('loaded-value');
    });

    it('should handle loader errors gracefully', async () => {
      const loader = vi.fn().mockRejectedValue(new Error('Load failed'));
      
      await expect(cache.getOrSet('key1', loader)).rejects.toThrow('Load failed');
      expect(cache.get('key1')).toBeNull();
    });
  });

  describe('Statistics', () => {
    it('should track hit and miss rates', () => {
      cache.set('key1', 'value1');
      
      // Generate hits and misses
      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('nonexistent'); // miss
      cache.get('nonexistent'); // miss
      
      const stats = cache.getStats();
      expect(stats.totalHits).toBe(2);
      expect(stats.totalMisses).toBe(2);
      expect(stats.hitRate).toBe(0.5);
      expect(stats.missRate).toBe(0.5);
    });

    it('should track cache size and memory usage', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      const stats = cache.getStats();
      expect(stats.cacheSize).toBe(2);
      expect(stats.entryCount).toBe(2);
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });

    it('should track oldest and newest entries', () => {
      const now = Date.now();
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      const stats = cache.getStats();
      expect(stats.oldestEntry).toBeGreaterThanOrEqual(now);
      expect(stats.newestEntry).toBeGreaterThanOrEqual(stats.oldestEntry!);
    });
  });

  describe('Cleanup', () => {
    it('should automatically cleanup expired entries', async () => {
      cache.set('key1', 'value1', 100); // 100ms TTL
      cache.set('key2', 'value2', 2000); // 2s TTL
      
      await new Promise(resolve => setTimeout(resolve, 600)); // Wait for cleanup
      
      expect(cache.get('key1')).toBeNull(); // Should be cleaned up
      expect(cache.get('key2')).toBe('value2'); // Should still exist
    });

    it('should return number of cleaned up entries', async () => {
      cache.set('key1', 'value1', 50);
      cache.set('key2', 'value2', 50);
      cache.set('key3', 'value3', 2000);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const cleaned = cache.cleanup();
      expect(cleaned).toBe(2); // key1 and key2 should be expired
      expect(cache.get('key3')).toBe('value3');
    });
  });

  describe('Global Cache Instance', () => {
    afterEach(() => {
      destroyGlobalCache();
    });

    it('should create and return global cache instance', () => {
      const cache1 = getGlobalCache();
      const cache2 = getGlobalCache();
      
      expect(cache1).toBe(cache2); // Should be same instance
    });

    it('should apply custom config to global cache', () => {
      const customConfig = { maxSize: 500 };
      const globalCache = getGlobalCache(customConfig);
      
      globalCache.set('test', 'value');
      expect(globalCache.get('test')).toBe('value');
    });

    it('should destroy global cache instance', () => {
      const globalCache = getGlobalCache();
      globalCache.set('test', 'value');
      
      destroyGlobalCache();
      
      const newCache = getGlobalCache();
      expect(newCache.get('test')).toBeNull(); // Should be new instance
    });
  });

  describe('Edge Cases', () => {
    it('should handle null and undefined values', () => {
      cache.set('null-key', null);
      cache.set('undefined-key', undefined);
      
      expect(cache.get('null-key')).toBeNull();
      expect(cache.get('undefined-key')).toBeUndefined();
    });

    it('should handle complex objects', () => {
      const complexObject = {
        nested: { data: [1, 2, 3] },
        date: new Date(),
        map: new Map([['key', 'value']])
      };
      
      cache.set('complex', complexObject);
      expect(cache.get('complex')).toEqual(complexObject);
    });

    it('should handle concurrent access safely', async () => {
      const promises = [];
      
      // Concurrent sets
      for (let i = 0; i < 20; i++) {
        promises.push(
          new Promise<void>(resolve => {
            cache.set(`key${i}`, `value${i}`);
            resolve();
          })
        );
      }
      
      await Promise.all(promises);
      
      // Verify some entries exist (may be fewer due to eviction)
      const stats = cache.getStats();
      expect(stats.cacheSize).toBeGreaterThan(0);
      expect(stats.cacheSize).toBeLessThanOrEqual(10); // Respects max size
    });

    it('should handle very large cache keys', () => {
      const largeKey = 'x'.repeat(1000);
      cache.set(largeKey, 'value');
      expect(cache.get(largeKey)).toBe('value');
    });
  });
});