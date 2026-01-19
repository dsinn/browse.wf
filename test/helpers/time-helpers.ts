/**
 * Time-freezing utilities for predictable time-dependent tests
 */

import { vi } from 'vitest';
import { MOCK_TIMESTAMP } from './test-constants';

export { MOCK_TIMESTAMP };

/**
 * Freezes time to a specific timestamp for predictable tests
 */
export function freezeTime(timestamp: number = MOCK_TIMESTAMP) {
  // Mock Date.now() to return our frozen timestamp
  vi.spyOn(Date, 'now').mockReturnValue(timestamp);

  // Mock Date constructor to return frozen date
  const OriginalDate = Date;
  global.Date = class extends OriginalDate {
    constructor(...args: any[]) {
      if (args.length === 0) {
        super(timestamp);
      } else {
        super(...args);
      }
    }

    static now() {
      return timestamp;
    }
  } as any;
}

/**
 * Advances frozen time by a duration in milliseconds
 */
export function advanceTime(ms: number) {
  const currentTime = Date.now();
  freezeTime(currentTime + ms);
}
