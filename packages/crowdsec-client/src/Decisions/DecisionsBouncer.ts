import { BaseSubObject } from '../BaseSubObject.js';
import type { Decisions } from '../types/index.js';
import { clearTimeout } from 'timers';
import { createDebugger, forceArray } from '../utils.js';
import { DecisionsStream } from './DecisionsStream.js';
import { Decision } from './Decision.js';

const debug = createDebugger('DecisionsBouncer');

export type CallBackParams = { decision: Decision; type: 'added' | 'deleted' };
export type CallBack = (err: any | undefined, data?: CallBackParams) => any;

export class DecisionsBouncer extends BaseSubObject {
    private async getRawStream(options: {
        startup?: boolean;
        scopes?: string | Array<string>;
        origins?: string | Array<string>;
        scenarios_containing?: string | Array<string>;
        scenarios_not_containing?: string | Array<string>;
    }): Promise<Decisions.GetDecisionsStream.ResponseBody> {
        debug('getRawStream(%o)', options);

        const params = ((): Decisions.GetDecisionsStream.RequestQuery => ({
            ...options,
            scopes: forceArray(options.scopes).join(','),
            origins: forceArray(options.origins).join(','),
            scenarios_containing: forceArray(options.scenarios_containing).join(','),
            scenarios_not_containing: forceArray(options.scenarios_not_containing).join(',')
        }))();

        return (
            await this.http.get<Decisions.GetDecisionsStream.ResponseBody>('/v1/decisions/stream', {
                params
            })
        ).data;
    }

    public getStream(
        optionsParam: {
            interval: number;
            scopes?: string | Array<string>;
            origins?: string | Array<string>;
            scenarios_containing?: string | Array<string>;
            scenarios_not_containing?: string | Array<string>;
        },
        cb?: CallBack
    ): DecisionsStream {
        const localDebug = debug.extend('getStream');
        localDebug('(%o) with cb %o', optionsParam, !!cb);

        const interval = optionsParam.interval;
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

        const decisionStream = new DecisionsStream();

        let getStreamTimeout: NodeJS.Timeout | undefined;

        const getStreamFn = async (startup = false) => {
            localDebug('start loop');
            if (getStreamTimeout) {
                clearTimeout(getStreamTimeout);
            }

            try {
                const res = await this.getRawStream({ ...options, startup });
                first = false;
                decisionStream.push(res);
            } catch (e) {
                decisionStream.emit('error', e);
            }

            localDebug('end loop');
            getStreamTimeout = setTimeout(() => getStreamFn(false), interval);
        };

        decisionStream.once('close', () => {
            localDebug('receive close event');
            clearTimeout(getStreamTimeout);
        });

        decisionStream.on('pause', () => {
            localDebug('receive pause event');
            clearTimeout(getStreamTimeout);
        });

        decisionStream.on('resume', () => {
            localDebug('receive resume event');
            getStreamFn(first);
        });

        if (cb) {
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

        return decisionStream;
    }

    public async search(
        options?: Decisions.GetDecisions.RequestQuery & {
            origins: string | Array<string>;
            scenarios_containing: string | Array<string>;
            scenarios_not_containing: string | Array<string>;
        }
    ): Promise<Decisions.GetDecisions.ResponseBody> {
        debug('search(%o)', options);
        const params = ((): Omit<Decisions.GetDecisionsStream.RequestQuery, 'startup'> => ({
            ...options,
            origins: options?.origins ? forceArray<string>(options.origins).join(',') : undefined,
            scenarios_containing: options?.scenarios_containing ? forceArray<string>(options.scenarios_containing).join(',') : undefined,
            scenarios_not_containing: options?.scenarios_not_containing
                ? forceArray<string>(options.scenarios_not_containing).join(',')
                : undefined
        }))();

        return (
            (
                await this.http.get<Decisions.GetDecisions.ResponseBody>('/v1/decisions', {
                    params
                })
            ).data || []
        ).map((d) => new Decision(d));
    }
}
