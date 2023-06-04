import esbuild from 'esbuild';
import path from 'path';
import fs from 'fs';

const tsConfig = JSON.parse(fs.readFileSync('./tsconfig.json').toString());

const dist = path.join(process.cwd(), tsConfig.compilerOptions.outDir);

if (!fs.existsSync(dist)) {
    fs.mkdirSync(dist);
}

let makeAllPackagesExternalPlugin = {
    name: 'make-all-packages-external',
    setup(build) {
        let filter = /^[^.\/]|^\.[^.\/]|^\.\.[^\/]/; // Must not start with "/" or "./" or "../"
        build.onResolve({ filter }, (args) => ({ path: args.path, external: true }));
    }
};

const globalConfig = {
    entryPoints: ['src/index.ts', 'src/debug.ts'],
    bundle: true,
    sourcemap: true,
    minify: false,
    plugins: [makeAllPackagesExternalPlugin]
};

esbuild
    .build({
        ...globalConfig,
        outdir: path.join(dist, 'esm'),
        splitting: true,
        format: 'esm',
        outExtension: { '.js': '.mjs' },
        target: ['esnext']
    })
    .catch(() => process.exit(1));
esbuild
    .build({
        ...globalConfig,
        outdir: path.join(dist, 'cjs'),
        // outfile: path.join(dist, 'cjs', 'index.cjs.js'),
        format: 'cjs',
        outExtension: { '.js': '.cjs' },
        platform: 'node',
        target: ['node16']
    })
    .catch(() => process.exit(1));

// esbuild
//     .build({
//         ...globalConfig,
//         entryPoints: [...globSync('./tests/**/*.test.ts'), ...globSync('./src/**/*.ts')],
//         outdir: path.join(dist, 'jest'),
//         // outfile: path.join(dist, 'cjs', 'index.cjs.js'),
//         format: 'cjs',
//         platform: 'node',
//         target: ['node16'],
//         plugins: []
//     })
//     .catch(() => process.exit(1));

// an entry file for cjs at the root of the bundle
fs.writeFileSync(path.join(dist, 'index.mjs'), "export * from './esm/index.mjs';");

// an entry file for esm at the root of the bundle
fs.writeFileSync(path.join(dist, 'index.cjs'), "module.exports = require('./cjs/index.cjs');");
