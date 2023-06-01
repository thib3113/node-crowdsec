import { jest, describe, it, afterEach, beforeEach, expect } from '@jest/globals';

import type { Decisions } from '../../src/types/index.js';
import type { DecisionsWatcher } from '../../src/index.js';

jest.unstable_mockModule('../../src/BaseSubObject.js', () => {});

describe('DecisionsWatcher', () => {
    const httpDeleteMock = jest.fn();
    let watcher: DecisionsWatcher;
    beforeEach(async () => {
        // @ts-ignore
        watcher = new (await import('../../src/Decisions/Decision.js'))();
        // @ts-ignore
        watcher.http = { delete: httpDeleteMock };
    });
    afterEach(() => {
        httpDeleteMock.mockReset();
    });
    it('should call delete with id', async () => {
        httpDeleteMock.mockImplementationOnce(() => ({ data: 'test' }));

        expect(await watcher.deleteById('123')).toBe('test');

        expect(httpDeleteMock).toHaveBeenCalledWith('/v1/decisions/123');
    });

    it('should call delete with options', async () => {
        httpDeleteMock.mockImplementationOnce(() => ({ data: 'test' }));
        const deleteOptions: Decisions.DeleteDecisions.RequestQuery = {
            ip: '1.2.3.4'
        };

        expect(await watcher.delete(deleteOptions)).toBe('test');

        expect(httpDeleteMock).toHaveBeenCalledWith('/v1/decisions/', { data: deleteOptions });
    });
});
