#!/usr/bin/env node
import debug from 'debug';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig, parseCliArgs, printHelp, printVersion } from './config.js';
import { createContext, createPassthroughContext } from './client.js';
import { createServer, selectTools } from './registry.js';
import { allTools } from './tools/index.js';
import { startHttpServer } from './transports/http.js';
import type { AppContext } from './types.js';

const log = debug('crowdsec-mcp');

async function main(): Promise<void> {
    const { values } = parseCliArgs();

    if (values.help) {
        printHelp();
        return;
    }

    if (values.version) {
        printVersion();
        return;
    }

    const config = loadConfig(values);
    let context: AppContext | undefined;
    let stdioServer: ReturnType<typeof createServer> | undefined;

    let stopping = false;
    const shutdown = async (signal: string): Promise<void> => {
        if (stopping) {
            return;
        }

        stopping = true;
        log('received %s, shutting down', signal);
        try {
            await context?.stop();
            await stdioServer?.close();
        } finally {
            process.exit(0);
        }
    };

    process.once('SIGINT', () => {
        void shutdown('SIGINT');
    });
    process.once('SIGTERM', () => {
        void shutdown('SIGTERM');
    });

    if (config.transport === 'http') {
        if (config.passthrough) {
            await startHttpServer(async (headers) => {
                const requestContext = await createPassthroughContext(config, headers);
                const requestTools = selectTools(allTools(), requestContext);
                return {
                    server: createServer(requestTools, requestContext),
                    cleanup: () => requestContext.stop()
                };
            }, config);
        } else {
            context = await createContext(config);
            const tools = selectTools(allTools(), context);
            await startHttpServer(() => ({ server: createServer(tools, context!) }), config);
        }
        log('HTTP transport listening on %s:%d', config.http.host, config.http.port);
        return;
    }

    context = await createContext(config);
    const tools = selectTools(allTools(), context);
    stdioServer = createServer(tools, context);
    const transport = new StdioServerTransport();
    await stdioServer.connect(transport);
    log('stdio transport ready');
}

try {
    await main();
} catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`crowdsec-mcp: ${message}\n`);
    process.exit(1);
}
