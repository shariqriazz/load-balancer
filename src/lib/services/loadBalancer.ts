import { ApiKey } from '../models/ApiKey';
import { readSettings } from '../settings';

/**
 * Load balancing strategies for API key selection
 */

interface KeyWithConnections extends ApiKey {
  activeConnections?: number;
}

// In-memory connection tracking (in production, use Redis or database)
const connectionCounts = new Map<string, number>();

export class LoadBalancer {
  /**
   * Select the best API key based on the configured strategy
   */
  static async selectKey(availableKeys: ApiKey[]): Promise<ApiKey | null> {
    if (availableKeys.length === 0) return null;
    if (availableKeys.length === 1) return availableKeys[0];

    const settings = await readSettings();
    const strategy = settings.loadBalancingStrategy || 'round-robin';

    switch (strategy) {
      case 'random':
        return this.selectRandom(availableKeys);
      case 'least-connections':
        return this.selectLeastConnections(availableKeys);
      case 'round-robin':
      default:
        return this.selectRoundRobin(availableKeys);
    }
  }

  /**
   * Random selection strategy
   */
  private static selectRandom(keys: ApiKey[]): ApiKey {
    const randomIndex = Math.floor(Math.random() * keys.length);
    return keys[randomIndex];
  }

  /**
   * Round-robin selection strategy (based on last used time)
   */
  private static selectRoundRobin(keys: ApiKey[]): ApiKey {
    // Sort by lastUsed (null values first, then oldest first)
    const sortedKeys = keys.sort((a, b) => {
      if (!a.lastUsed && !b.lastUsed) return 0;
      if (!a.lastUsed) return -1;
      if (!b.lastUsed) return 1;
      return new Date(a.lastUsed).getTime() - new Date(b.lastUsed).getTime();
    });
    
    return sortedKeys[0];
  }

  /**
   * Least connections strategy
   */
  private static selectLeastConnections(keys: ApiKey[]): ApiKey {
    let selectedKey = keys[0];
    let minConnections = this.getConnectionCount(selectedKey._id);

    for (const key of keys) {
      const connections = this.getConnectionCount(key._id);
      if (connections < minConnections) {
        minConnections = connections;
        selectedKey = key;
      }
    }

    return selectedKey;
  }

  /**
   * Increment connection count for a key
   */
  static incrementConnections(keyId: string): void {
    const current = connectionCounts.get(keyId) || 0;
    connectionCounts.set(keyId, current + 1);
  }

  /**
   * Decrement connection count for a key
   */
  static decrementConnections(keyId: string): void {
    const current = connectionCounts.get(keyId) || 0;
    if (current > 0) {
      connectionCounts.set(keyId, current - 1);
    }
  }

  /**
   * Get current connection count for a key
   */
  static getConnectionCount(keyId: string): number {
    return connectionCounts.get(keyId) || 0;
  }

  /**
   * Reset connection counts (useful for testing or cleanup)
   */
  static resetConnectionCounts(): void {
    connectionCounts.clear();
  }

  /**
   * Get all connection counts (for monitoring)
   */
  static getAllConnectionCounts(): Map<string, number> {
    return new Map(connectionCounts);
  }
}

// Cleanup connections periodically to prevent memory leaks
let loadBalancerCleanupRegistered = false;

function initializeLoadBalancerCleanup() {
  if (loadBalancerCleanupRegistered || typeof process === 'undefined') return;
  
  loadBalancerCleanupRegistered = true;
  
  const cleanupInterval = setInterval(() => {
    // Remove keys with 0 connections to prevent memory leaks
    for (const [keyId, count] of connectionCounts.entries()) {
      if (count <= 0) {
        connectionCounts.delete(keyId);
      }
    }
  }, 5 * 60 * 1000); // Every 5 minutes

  process.on('beforeExit', () => {
    clearInterval(cleanupInterval);
  });
}

// Initialize cleanup when module is first used
initializeLoadBalancerCleanup();