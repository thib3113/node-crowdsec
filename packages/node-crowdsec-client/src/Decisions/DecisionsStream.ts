import { TypedEventEmitter } from '../EventEmitter.js';
import { Decision } from './Decision.js';
import { DecisionsStreamResponse } from 'crowdsec-types';

type DecisionsStreamEvents = {
    added: (decision: Decision) => void;
    deleted: (decision: Decision) => void;
    error: (error: any) => void;
    pause: () => void;
    resume: () => void;
    close: () => void;
};

export class DecisionsStream extends TypedEventEmitter<DecisionsStreamEvents> {
    private looping: boolean = false;
    public get paused(): boolean {
        return this._paused;
    }
    private _paused: boolean = true;

    private decisions: { added: Array<Decision>; deleted: Array<Decision> } = {
        added: [],
        deleted: []
    };

    public push(decisions: DecisionsStreamResponse): void {
        (decisions.new || []).forEach((decision) => this.decisions.added.push(new Decision(decision)));
        (decisions.deleted || []).forEach((decision) => this.decisions.deleted.push(new Decision(decision)));

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
        this._paused = true;
        this.emit('pause');
    }
    public resume(): void {
        this._paused = false;
        this.emit('resume');
        this.loop();
    }
}
