export class HttpRequestError extends Error {
    public constructor(
        public readonly status: number,
        public readonly code: number,
        message: string
    ) {
        super(message);
        this.name = 'HttpRequestError';
    }
}
