import { LoadBalancer } from '../loadBalancer';
import { ApiKey } from '../../models/ApiKey';
import { readSettings } from '../../settings';

// Mock dependencies
jest.mock('../../settings');
jest.mock('../../models/ApiKey');

const mockReadSettings = readSettings as jest.Mock;

describe('LoadBalancer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    LoadBalancer.resetConnectionCounts();
  });

  const createMockKey = (id: string, lastUsed?: string): ApiKey => {
    return {
      _id: id,
      key: `key-${id}`,
      name: `Key ${id}`,
      profile: '',
      isActive: true,
      lastUsed: lastUsed || null,
      rateLimitResetAt: null,
      failureCount: 0,
      requestCount: 0,
      dailyRateLimit: null,
      dailyRequestsUsed: 0,
      lastResetDate: null,
      isDisabledByRateLimit: false,
    } as ApiKey;
  };

  describe('selectKey', () => {
    it('should return null for empty array', async () => {
      const result = await LoadBalancer.selectKey([]);
      expect(result).toBeNull();
    });

    it('should return the only key for single key array', async () => {
      const key = createMockKey('1');
      const result = await LoadBalancer.selectKey([key]);
      expect(result).toBe(key);
    });

    it('should use round-robin strategy by default', async () => {
      mockReadSettings.mockResolvedValue({ loadBalancingStrategy: 'round-robin' });
      
      const key1 = createMockKey('1', '2023-01-01T00:00:00Z');
      const key2 = createMockKey('2', '2023-01-02T00:00:00Z');
      const key3 = createMockKey('3'); // Never used
      
      const result = await LoadBalancer.selectKey([key1, key2, key3]);
      expect(result).toBe(key3); // Should select never-used key first
    });

    it('should use random strategy when configured', async () => {
      mockReadSettings.mockResolvedValue({ loadBalancingStrategy: 'random' });
      
      const keys = [createMockKey('1'), createMockKey('2'), createMockKey('3')];
      
      // Mock Math.random to return predictable value
      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0.5); // Should select middle key
      
      const result = await LoadBalancer.selectKey(keys);
      expect(result).toBe(keys[1]);
      
      Math.random = originalRandom;
    });

    it('should use least-connections strategy when configured', async () => {
      mockReadSettings.mockResolvedValue({ loadBalancingStrategy: 'least-connections' });
      
      const key1 = createMockKey('1');
      const key2 = createMockKey('2');
      const key3 = createMockKey('3');
      
      // Set up connection counts
      LoadBalancer.incrementConnections('1'); // 1 connection
      LoadBalancer.incrementConnections('2'); // 1 connection
      LoadBalancer.incrementConnections('2'); // 2 connections total
      // key3 has 0 connections
      
      const result = await LoadBalancer.selectKey([key1, key2, key3]);
      expect(result).toBe(key3); // Should select key with least connections
    });
  });

  describe('connection tracking', () => {
    it('should increment and decrement connection counts', () => {
      expect(LoadBalancer.getConnectionCount('test-key')).toBe(0);
      
      LoadBalancer.incrementConnections('test-key');
      expect(LoadBalancer.getConnectionCount('test-key')).toBe(1);
      
      LoadBalancer.incrementConnections('test-key');
      expect(LoadBalancer.getConnectionCount('test-key')).toBe(2);
      
      LoadBalancer.decrementConnections('test-key');
      expect(LoadBalancer.getConnectionCount('test-key')).toBe(1);
      
      LoadBalancer.decrementConnections('test-key');
      expect(LoadBalancer.getConnectionCount('test-key')).toBe(0);
    });

    it('should not go below zero when decrementing', () => {
      LoadBalancer.decrementConnections('test-key');
      expect(LoadBalancer.getConnectionCount('test-key')).toBe(0);
    });

    it('should reset all connection counts', () => {
      LoadBalancer.incrementConnections('key1');
      LoadBalancer.incrementConnections('key2');
      
      expect(LoadBalancer.getConnectionCount('key1')).toBe(1);
      expect(LoadBalancer.getConnectionCount('key2')).toBe(1);
      
      LoadBalancer.resetConnectionCounts();
      
      expect(LoadBalancer.getConnectionCount('key1')).toBe(0);
      expect(LoadBalancer.getConnectionCount('key2')).toBe(0);
    });

    it('should return all connection counts', () => {
      LoadBalancer.incrementConnections('key1');
      LoadBalancer.incrementConnections('key2');
      LoadBalancer.incrementConnections('key2');
      
      const counts = LoadBalancer.getAllConnectionCounts();
      expect(counts.get('key1')).toBe(1);
      expect(counts.get('key2')).toBe(2);
    });
  });

  describe('round-robin selection', () => {
    it('should prioritize never-used keys', async () => {
      mockReadSettings.mockResolvedValue({ loadBalancingStrategy: 'round-robin' });
      
      const usedKey = createMockKey('1', '2023-01-01T00:00:00Z');
      const neverUsedKey = createMockKey('2'); // lastUsed is null
      
      const result = await LoadBalancer.selectKey([usedKey, neverUsedKey]);
      expect(result).toBe(neverUsedKey);
    });

    it('should select least recently used when all keys have been used', async () => {
      mockReadSettings.mockResolvedValue({ loadBalancingStrategy: 'round-robin' });
      
      const olderKey = createMockKey('1', '2023-01-01T00:00:00Z');
      const newerKey = createMockKey('2', '2023-01-02T00:00:00Z');
      
      const result = await LoadBalancer.selectKey([newerKey, olderKey]);
      expect(result).toBe(olderKey);
    });
  });
});