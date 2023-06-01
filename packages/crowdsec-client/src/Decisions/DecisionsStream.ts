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
        (decisions.new || []).forEach((decision) => this.decisions.added.push(new Decision<Scopes, Origins>(decision)));
        (decisions.deleted || []).forEach((decision) => this.decisions.deleted.push(new Decision<Scopes, Origins>(decision)));

        this.loop();
    }

    private loop() {
        if (this.looping || this._paused) {
            return;
        }
        this.looping = true;
        (async () => {
            try {
                while (this.decisions.deleted.length + this.decisions.added.length > 0 && !this._paused) {
                    const deletedDecision = this.decisions.deleted.shift();
                    const addedDecision = this.decisions.added.shift();
                    if (deletedDecision) {
                        this.emit('deleted', deletedDecision);
                    }

                    if (addedDecision) {
                        this.emit('added', addedDecision);
                    }
                }
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
