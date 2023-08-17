import { TypedEventEmitter } from '../EventEmitter.js';
import { Decision } from './Decision.js';
import type { decisionOrigin, DecisionsStreamResponse } from '../types/index.js';
import { createDebugger, nonBlockingLoop } from '../utils.js';
import type { Debugger } from 'debug';
import { CrowdsecClientError, EErrorsCodes } from '../Errors/index.js';

export type DecisionsStreamEvents<Scopes extends string = 'ip', Origins extends string = decisionOrigin> = {
    raw: (decisions: DecisionsStreamResponse) => void;
    parsed: (decisions: Record<'added' | 'deleted', Array<Decision<Scopes, Origins>>>) => void;
    added: (decision: Decision<Scopes, Origins>) => void;
    deleted: (decision: Decision<Scopes, Origins>) => void;
    error: (error: any) => void;
    pause: () => void;
    resume: () => void;
    close: () => void;
};

const debug = createDebugger('DecisionsStream');

export class DecisionsStream<Scopes extends string = 'ip', Origins extends string = decisionOrigin> extends TypedEventEmitter<
    DecisionsStreamEvents<Scopes, Origins>
> {
    private looping: boolean = false;

    private readonly debug: Debugger;

    public get paused(): boolean {
        return this._paused;
    }
    private _paused: boolean = true;

    private decisions: { added: Array<Decision<Scopes, Origins>>; deleted: Array<Decision<Scopes, Origins>> } = {
        added: [],
        deleted: []
    };

    constructor(public readonly name: string) {
        super();

        this.debug = debug.extend(this.name);
    }

    public push(rawDecisions: DecisionsStreamResponse): void {
        const localDebug = this.debug.extend('push');

        localDebug('start emitting raw');
        this.emit('raw', rawDecisions);
        localDebug('end emitting raw');

        localDebug('push new raw decisions %o added, %o deleted', rawDecisions.new?.length || 0, rawDecisions.deleted?.length || 0);
        const receivedDecisions: Record<'added' | 'deleted', Array<Decision<Scopes, Origins>>> = {
            added: [],
            deleted: []
        };

        const addedPromise = nonBlockingLoop(rawDecisions.new ?? [], (d) => {
            const decision = new Decision<Scopes, Origins>(d);
            receivedDecisions.added.push(decision);
            this.decisions.added.push(decision);
        });
        const deletedPromise = nonBlockingLoop(rawDecisions.deleted ?? [], (d) => {
            const decision = new Decision<Scopes, Origins>(d);
            receivedDecisions.deleted.push(decision);
            this.decisions.deleted.push(decision);
        });

        Promise.all([addedPromise, deletedPromise])
            .then(() => {
                localDebug('end to add decisions');
                localDebug('emit parsed');
                this.emit('parsed', receivedDecisions);
            })
            .catch((e) => this.handleError(new CrowdsecClientError('fail to parse received decisions', EErrorsCodes.UNKNOWN_ERROR, e)));

        this.loopWrapper();
    }

    private async emitDecisions(eventName: 'added' | 'deleted', decisions: Array<Decision<Scopes, Origins>>) {
        await nonBlockingLoop(decisions, (decision, stopFunction) => {
            if (this._paused) {
                stopFunction();
                return decision;
            }

            if (decision) {
                this.emit(eventName, decision);
            }

            return undefined;
        });

        //delete empty decisions, keep new decisions
        decisions.forEach((_, index, array) => {
            const i = array.length - index;
            if (!array[i]) {
                array.splice(i, 1);
            }
        });
    }

    private loopWrapper() {
        this.debug('loopWrapper()');
        this.loop().catch((e) => this.handleError(new CrowdsecClientError('uncatched promise from loop', EErrorsCodes.UNKNOWN_ERROR, e)));
    }

    private handleError(error: CrowdsecClientError) {
        this.debug('%O', error);
        this.emit('error', error);
    }

    private async loop() {
        if (this.looping || this._paused) {
            return;
        }
        this.looping = true;
        return (async () => {
            try {
                await Promise.all([
                    this.emitDecisions('deleted', this.decisions.deleted),
                    this.emitDecisions('added', this.decisions.added)
                ]);
            } catch (e) {
                this.handleError(new CrowdsecClientError('loop error', EErrorsCodes.UNKNOWN_ERROR, e as Error));
            } finally {
                this.looping = false;
            }
        })();
    }

    public pause(): void {
        this.debug('paused');
        this._paused = true;
        this.emit('pause');
    }

    /**
     * an alias of resume
     */
    public start(): void {
        this.resume();
    }
    public resume(): void {
        this.debug('resumed');
        this._paused = false;
        this.emit('resume');
        this.loopWrapper();
    }

    public close(): void {
        this.debug('closed');
        this._paused = true;
        this.emit('close');
    }
}
