import { expect } from 'vitest';
import { VERSION } from '../src/index.js';

it('should export a VERSION', async () => {
    expect(VERSION).toBeDefined();
    expect(typeof VERSION).toBe('string');
});
