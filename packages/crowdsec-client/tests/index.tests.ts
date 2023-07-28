import { expect } from '@jest/globals';
import { VERSION } from '../src/index.js';

it('should export a VERSION', async () => {
    expect(VERSION).toBeDefined();
    expect(typeof VERSION).toBe('string');
});
