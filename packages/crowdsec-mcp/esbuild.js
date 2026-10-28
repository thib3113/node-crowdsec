import esbuild from 'esbuild';
import path from 'node:path';
import fs from 'node:fs';
import * as url from 'node:url';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

//create pkg file
fs.writeFileSync(
    path.join(__dirname, 'src', 'pkg.ts'),
    `export const pkg = { name: '${process.env.npm_package_name}', version: '${process.env.npm_package_version}' };\n`
);

let makeAllPackagesExternalPlugin = {
    name: 'make-all-packages-external',
    setup(build) {
        let filter = /^[^./]|^\.[^./]|^\.\.[^/]/; // Must not start with "/" or "./" or "../"
        build.onResolve({ filter }, (args) => ({ path: args.path, external: true }));
    }
};

const buildOptions = {
    entryPoints: ['src/index.ts'],
    outfile: path.join(__dirname, 'dist', 'index.js'),
    bundle: true,
    sourcemap: true,
    minify: false,
    platform: 'node',
    format: 'esm',
    target: ['esnext'],
    plugins: [makeAllPackagesExternalPlugin]
};

if (process.argv.includes('--watch')) {
    const context = await esbuild.context(buildOptions);
    await context.watch();
    console.log('watching crowdsec-mcp...');
} else {
    await esbuild.build(buildOptions).catch(() => process.exit(1));
}
