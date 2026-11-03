import { BaseSubObject } from '../BaseSubObject.js';
import { LapiCapability } from '../Capabilities.js';
import type { decisionOrigin, Decisions } from '../types/index.js';
import { createDebugger, forceArray } from '../utils.js';
import { DecisionsStream } from './DecisionsStream.js';
import { Decision } from './Decision.js';
import axios from 'axios';
import { AxiosError } from '../Errors/index.js';

const debug = createDebugger('DecisionsBouncer');

export type CallBackParams<Scopes extends string = 'ip', Origins extends string = decisionOrigin> = {
    decision: Decision<Scopes, Origins>;
    type: 'added' | 'deleted';
};
export type CallBack<Scopes extends string = 'ip', Origins extends string = decisionOrigin> = (
    err?: any,
    data?: CallBackParams<Scopes, Origins>
) => any;

export type commaSeparatedParams = 'scopes' | 'origins' | 'scenarios_containing' | 'scenarios_not_containing';

export class DecisionsBouncer extends BaseSubObject {
    private runningStreams: Array<DecisionsStream<any>> = [];

    /** Per-stream timer: pausing/closing one stream must not stop another. */
    private streamTimeouts = new WeakMap<DecisionsStream<any>, NodeJS.Timeout>();
    private streamRunning = new WeakSet<DecisionsStream<any>>();

    /**
     * Fetch one page of the decisions stream.
     * @since CrowdSec 1.0.0
     * @remarks `scopes` requires CrowdSec LAPI 1.1.0; `origins` and `scenarios_*` require 1.3.3.
     * @throws {FeatureNotSupportedError} when a used filter is not supported by the connected LAPI.
     */
    public async getRawStream(options?: {
        startup?: boolean;
        scopes?: string | Array<string>;
        origins?: string | Array<string>;
        scenarios_containing?: string | Array<string>;
        scenarios_not_containing?: string | Array<string>;
    }): Promise<Decisions.GetDecisionsStream.ResponseBody> {
        debug('getRawStream(%o)', options);

        if (options?.scopes !== undefined) {
            this.requireCapability(LapiCapability.streamScopes);
        }
        if (
            options?.origins !== undefined ||
            options?.scenarios_containing !== undefined ||
            options?.scenarios_not_containing !== undefined
        ) {
            this.requireCapability(LapiCapability.decisionOriginsFilter);
        }

        const params = ((): Decisions.GetDecisionsStream.RequestQuery => ({
            ...options,
            scopes: options?.scopes ? forceArray<string>(options.scopes).join(',') : undefined,
            origins: options?.origins ? forceArray<string>(options.origins).join(',') : undefined,
            scenarios_containing: options?.scenarios_containing ? forceArray<string>(options.scenarios_containing).join(',') : undefined,
            scenarios_not_containing: options?.scenarios_not_containing
                ? forceArray<string>(options.scenarios_not_containing).join(',')
                : undefined
        }))();

        try {
            return (
                await this.http.get<Decisions.GetDecisionsStream.ResponseBody>('/v1/decisions/stream', {
                    params
                })
            ).data;
        } catch (e) {
            if (axios.isAxiosError(e)) {
                throw new AxiosError(e);
            }
            throw e;
        }
    }

    /**
     * Start a decision stream that polls the LAPI.
     * @since CrowdSec 1.0.0
     * @remarks `scopes` requires CrowdSec LAPI 1.1.0; `origins` and `scenarios_*` require 1.3.3.
     * @throws {FeatureNotSupportedError} when a used filter is not supported by the connected LAPI.
     */
    public getStream<Scopes extends string = 'ip', Origins extends string = decisionOrigin>(
        optionsParam?: {
            interval?: number;
            scopes?: Scopes | Array<Scopes>;
            origins?: Origins | Array<Origins>;
            scenarios_containing?: string | Array<string>;
            scenarios_not_containing?: string | Array<string>;
        },
        cb?: CallBack<Scopes, Origins>
    ): DecisionsStream<Scopes, Origins> {
        const localDebug = debug.extend('getStream');
        localDebug('(%o) with cb %o', optionsParam, !!cb);

        if (optionsParam?.scopes !== undefined) {
            this.requireCapability(LapiCapability.streamScopes);
        }
        if (
            optionsParam?.origins !== undefined ||
            optionsParam?.scenarios_containing !== undefined ||
            optionsParam?.scenarios_not_containing !== undefined
        ) {
            this.requireCapability(LapiCapability.decisionOriginsFilter);
        }

        const interval = optionsParam?.interval ?? 10000;
        const options = ((): Omit<Decisions.GetDecisionsStream.RequestQuery, 'startup'> => ({
            scopes: optionsParam?.scopes ? forceArray<string>(optionsParam.scopes).join(',') : undefined,
            origins: optionsParam?.origins ? forceArray<string>(optionsParam.origins).join(',') : undefined,
            scenarios_containing: optionsParam?.scenarios_containing
                ? forceArray<string>(optionsParam.scenarios_containing).join(',')
                : undefined,
            scenarios_not_containing: optionsParam?.scenarios_not_containing
                ? forceArray<string>(optionsParam.scenarios_not_containing).join(',')
                : undefined
        }))();
        let first = true;

        const decisionStream = new DecisionsStream<Scopes, Origins>(JSON.stringify(options));

        this.runningStreams.push(decisionStream);

        decisionStream.once('close', () => {
            localDebug('receive close event');
            const timeout = this.streamTimeouts.get(decisionStream);
            if (timeout) {
                clearTimeout(timeout);
            }
            this.streamTimeouts.delete(decisionStream);
            this.streamRunning.delete(decisionStream);

            //remove from running streams
            this.runningStreams = this.runningStreams.filter((stream) => stream != decisionStream);
        });

        decisionStream.on('pause', () => {
            localDebug('receive pause event');
            const timeout = this.streamTimeouts.get(decisionStream);
            if (timeout) {
                clearTimeout(timeout);
            }
            this.streamTimeouts.delete(decisionStream);
        });

        decisionStream.on('resume', () => {
            localDebug('receive resume event');
            this.getStreamLoopWrapper<Scopes, Origins>(
                {
                    ...options,
                    startup: first
                },
                decisionStream,
                interval
            );
            first = false;
        });

        //more about this : https://nodejs.org/api/events.html#error-events
        decisionStream.on('error', (error) => {
            localDebug('stream emit error : %o', error);
        });

        if (cb) {
            this.streamToCallback(decisionStream, cb);
        }

        return decisionStream;
    }

    private getStreamLoopWrapper<Scopes extends string = 'ip', Origins extends string = decisionOrigin>(
        options: Decisions.GetDecisionsStream.RequestQuery,
        decisionStream: DecisionsStream<Scopes, Origins>,
        interval: number
    ) {
        this.getStreamLoop<Scopes, Origins>(options, decisionStream, interval).catch((e) =>
            debug('uncatched error from getStreamLoop : %o', e)
        );
    }

    private async getStreamLoop<Scopes extends string = 'ip', Origins extends string = decisionOrigin>(
        options: Decisions.GetDecisionsStream.RequestQuery,
        decisionStream: DecisionsStream<Scopes, Origins>,
        interval: number
    ) {
        const localDebug = debug.extend('getStreamLoop');
        localDebug('start loop');

        if (this.streamRunning.has(decisionStream)) {
            localDebug('loop already running, skipping');
            return;
        }
        this.streamRunning.add(decisionStream);

        const existing = this.streamTimeouts.get(decisionStream);
        if (existing) {
            clearTimeout(existing);
            this.streamTimeouts.delete(decisionStream);
        }

        try {
            const res = await this.getRawStream(options);
            decisionStream.push(res);
        } catch (e) {
            localDebug('loop error %o', e);
            decisionStream.emit('error', e);
        } finally {
            this.streamRunning.delete(decisionStream);
        }

        localDebug('end loop');
        if (decisionStream.paused) {
            localDebug('stream paused => exit loop');
            return;
        }

        localDebug('prepare next loop');
        const timeout = setTimeout(() => {
            this.streamTimeouts.delete(decisionStream);
            this.getStreamLoopWrapper(
                {
                    ...options,
                    startup: false
                },
                decisionStream,
                interval
            );
        }, interval);
        this.streamTimeouts.set(decisionStream, timeout);
    }

    private streamToCallback<Scopes extends string = 'ip', Origins extends string = decisionOrigin>(
        decisionStream: DecisionsStream<Scopes, Origins>,
        cb: CallBack<Scopes, Origins>
    ) {
        decisionStream.on('added', (decision) => {
            cb(null, {
                decision,
                type: 'added'
            });
        });
        decisionStream.on('deleted', (decision) => {
            cb(null, {
                decision,
                type: 'deleted'
            });
        });
        decisionStream.on('error', (error) => {
            cb(error);
        });

        decisionStream.resume();
    }

    /**
     * stop running streams
     */
    public stop() {
        this.runningStreams.forEach((stream) => stream.close());
    }

    /**
     * Search decisions.
     * @since CrowdSec 1.0.0
     * @remarks
     * - `contains` requires CrowdSec LAPI 1.0.3; `origins` and `scenarios_*` require 1.3.3.
     * - The decision `scope` filter is silently ignored on LAPI 1.3.3-1.6.0. Use
     *   `Alerts.search` (watcher) or a LAPI version outside that range when the
     *   scope must be enforced.
     * @throws {FeatureNotSupportedError} when a used filter is not supported by the connected LAPI.
     */
    public async search(
        options?: Omit<Decisions.GetDecisions.RequestQuery, commaSeparatedParams> & {
            /** name of origins. If provided, then only the decisions originating from provided origins would be returned. */
            origins?: string | Array<string>;
            /** If provided, only the decisions created by scenarios containing any of the provided word would be returned. */
            scenarios_containing?: string | Array<string>;
            /** If provided, only the decisions created by scenarios, not containing any of the provided word would be returned. */
            scenarios_not_containing?: string | Array<string>;
            /**
             * Include simulated decisions. The LAPI excludes them by default and
             * does not return the `simulated` field on `/v1/decisions`.
             */
            simulated?: boolean;
        }
    ): Promise<Decisions.GetDecisions.ResponseBody> {
        debug('search(%o)', options);

        if (options?.contains !== undefined) {
            this.requireCapability(LapiCapability.containsFilter);
        }
        if (
            options?.origins !== undefined ||
            options?.scenarios_containing !== undefined ||
            options?.scenarios_not_containing !== undefined
        ) {
            this.requireCapability(LapiCapability.decisionOriginsFilter);
        }
        const params = ((): Omit<Decisions.GetDecisionsStream.RequestQuery, 'startup'> => ({
            ...options,
            origins: options?.origins ? forceArray<string>(options.origins).join(',') : undefined,
            scenarios_containing: options?.scenarios_containing ? forceArray<string>(options.scenarios_containing).join(',') : undefined,
            scenarios_not_containing: options?.scenarios_not_containing
                ? forceArray<string>(options.scenarios_not_containing).join(',')
                : undefined
        }))();

        try {
            return (
                (
                    await this.http.get<Decisions.GetDecisions.ResponseBody>('/v1/decisions', {
                        params
                    })
                )?.data || []
            ).map((d) => new Decision(d));
        } catch (e) {
            if (axios.isAxiosError(e)) {
                throw new AxiosError(e);
            }
            throw e;
        }
    }
}
