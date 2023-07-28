import { APITypes } from 'crowdsec-client';
import type { Response } from 'mmdb-lib';
import maxmind, { OpenOpts, Reader } from 'maxmind';
import * as fs from 'fs';
import { createDebugger } from '../../../utils.js';

const debug = createDebugger('MaxMind:InternalBaseEnricher');
export abstract class InternalBaseEnricher<T extends Response> implements IInternalEnricher {
    protected abstract databaseType: string;
    protected database?: Reader<T>;
    protected databasePath: string;
    protected debug = debug;

    public constructor(databasePath: string, maxmindOpts: OpenOpts) {
        this.databasePath = databasePath;

        if (!fs.existsSync(this.databasePath)) {
            throw new Error(`database "${this.databasePath}" seems to doesn't exist`);
        }
    }

    async load(): Promise<void> {
        const database = await maxmind.open<T>(this.databasePath);

        const { metadata } = database;
        this.debug('load database %o with languages %o builded at %o', metadata.databaseType, metadata.languages, metadata.buildEpoch);
        if (this.databaseType !== database.metadata.databaseType) {
            throw new Error(`bad mmdb loaded "${database.metadata}" . Expected "${this.databaseType}"`);
        }

        this.database = database;
    }

    public abstract enrichAlert(ip: string, alert: APITypes.Alert): APITypes.Alert;
    public abstract enrichEvent(ip: string, event: APITypes.Event, alert: APITypes.Alert): APITypes.Event;
}

export interface IInternalEnricher {
    load(): Promise<void>;
    enrichAlert: (ip: string, alert: APITypes.Alert) => APITypes.Alert;
    enrichEvent: (ip: string, event: APITypes.Event, alert: APITypes.Alert) => APITypes.Event;
}
