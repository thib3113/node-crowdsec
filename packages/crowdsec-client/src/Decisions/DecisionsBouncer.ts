import { BaseSubObject } from '../BaseSubObject.js';
import type { Decisions } from '../types/index.js';
import { clearTimeout } from 'timers';
import { createDebugger } from '../utils.js';
import { DecisionsStream } from './DecisionsStream.js';
import { Decision } from './Decision.js';

const debug = createDebugger('DecisionsBouncer');

export type CallBackParams = { decision: Decision; type: 'added' | 'deleted' };
export type CallBack = (err: any | undefined, data?: CallBackParams) => any;

export class DecisionsBouncer extends BaseSubObject {
    private async getRawStream(options: Decisions.GetDecisionsStream.RequestQuery): Promise<Decisions.GetDecisionsStream.ResponseBody> {
        debug('getRawStream(%o)', options);
        return (
            await this.http.get<Decisions.GetDecisionsStream.ResponseBody>('/v1/decisions/stream', {
                params: options
            })
        ).data;
    }

    public getStream(
        optionsParam: Omit<Decisions.GetDecisionsStream.RequestQuery, 'startup'> & { interval: number },
        cb?: CallBack
    ): DecisionsStream {
        const localDebug = debug.extend('getStream');
        localDebug('(%o) with cb %o', optionsParam, !!cb);

        const interval = optionsParam.interval;
        const options = { ...optionsParam, interval: undefined };
        let first = true;

        delete options.interval;

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

    public async search(options?: Decisions.GetDecisions.RequestQuery): Promise<Decisions.GetDecisions.ResponseBody> {
        debug('list(%o)', options);
        return (
            (
                await this.http.get<Decisions.GetDecisions.ResponseBody>('/v1/decisions', {
                    params: options
                })
            ).data || []
        ).map((d) => new Decision(d));
    }
}
