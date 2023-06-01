import { TypedEventEmitter } from '../EventEmitter.js';
import { Decision } from './Decision.js';
import { decisionOrigin, DecisionsStreamResponse } from '../types/index.js';
import { createDebugger } from '../utils.js';
import { Debugger } from 'debug';

type DecisionsStreamEvents<Scopes extends string = 'ip', Origins extends string = decisionOrigin> = {
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

    public push(decisions: DecisionsStreamResponse): void {
        (decisions.new ?? []).forEach((decision) => this.decisions.added.push(new Decision<Scopes, Origins>(decision)));
        (decisions.deleted ?? []).forEach((decision) => this.decisions.deleted.push(new Decision<Scopes, Origins>(decision)));

        this.loop();
    }

    private async emitDecisions(eventName: 'added' | 'deleted', decisions: Array<Decision<Scopes, Origins>>) {
        while (decisions.length > 0 && !this._paused) {
            const decision = decisions.shift();
            if (decision) {
                this.emit(eventName, decision);
            }
        }
    }

    private loop() {
        if (this.looping || this._paused) {
            return;
        }
        this.looping = true;
        (async () => {
            try {
                await Promise.all([
                    this.emitDecisions('deleted', this.decisions.deleted),
                    this.emitDecisions('added', this.decisions.added)
                ]);
            } catch (e) {
                this.emit('error', e);
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
        this.loop();
    }

    public close(): void {
        this.debug('closed');
        this._paused = true;
        this.emit('close');
    }
}
