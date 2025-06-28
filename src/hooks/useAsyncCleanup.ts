import { useEffect, useRef } from 'react';

/**
 * Hook to manage cleanup of async operations and prevent memory leaks
 */
export function useAsyncCleanup() {
  const isMountedRef = useRef(true);
  const timeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const intervalsRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const abortControllersRef = useRef<Set<AbortController>>(new Set());

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      
      // Clear all timeouts
      timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      timeoutsRef.current.clear();
      
      // Clear all intervals
      intervalsRef.current.forEach(interval => clearInterval(interval));
      intervalsRef.current.clear();
      
      // Abort all ongoing requests
      abortControllersRef.current.forEach(controller => {
        if (!controller.signal.aborted) {
          controller.abort();
        }
      });
      abortControllersRef.current.clear();
    };
  }, []);

  const safeSetTimeout = (callback: () => void, delay: number): NodeJS.Timeout => {
    const timeout = setTimeout(() => {
      if (isMountedRef.current) {
        callback();
      }
      timeoutsRef.current.delete(timeout);
    }, delay);
    
    timeoutsRef.current.add(timeout);
    return timeout;
  };

  const safeSetInterval = (callback: () => void, delay: number): NodeJS.Timeout => {
    const interval = setInterval(() => {
      if (isMountedRef.current) {
        callback();
      } else {
        clearInterval(interval);
        intervalsRef.current.delete(interval);
      }
    }, delay);
    
    intervalsRef.current.add(interval);
    return interval;
  };

  const createAbortController = (): AbortController => {
    const controller = new AbortController();
    abortControllersRef.current.add(controller);
    
    // Auto-cleanup when aborted
    controller.signal.addEventListener('abort', () => {
      abortControllersRef.current.delete(controller);
    });
    
    return controller;
  };

  const isMounted = () => isMountedRef.current;

  return {
    isMounted,
    safeSetTimeout,
    safeSetInterval,
    createAbortController,
  };
}