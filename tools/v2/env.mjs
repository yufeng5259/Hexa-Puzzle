import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);

/** Creator 3.8.8 ships TypeScript; no npm install is needed. */
export function creatorRoot() {
    const candidates = [process.env.COCOS_CREATOR_ROOT, 'C:/ProgramData/cocos/editors/Creator/3.8.8', 'G:/cocosCreator/Editor/Creator/3.8.8'];
    const found = candidates.find(dir => dir && fs.existsSync(path.join(dir, 'resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js')));
    if (!found) throw new Error('Cocos Creator 3.8.8 not found; set COCOS_CREATOR_ROOT');
    return found;
}
export const TYPESCRIPT_LIB = path.join(creatorRoot(), 'resources/app.asar.unpacked/node_modules/typescript/lib');
process.env.TYPESCRIPT_PATH ||= path.join(TYPESCRIPT_LIB, 'typescript.js');
export const ts = require(process.env.TYPESCRIPT_PATH);

/**
 * Loads pure TypeScript modules (no 'cc' imports) for node tests.
 * Relative imports resolve recursively; `stubs` supplies any bare module ids.
 */
export function loader(stubs = {}) {
    const cache = new Map();
    const load = filename => {
        const file = path.resolve(filename.endsWith('.ts') ? filename : filename + '.ts');
        if (cache.has(file)) return cache.get(file).exports;
        const module = { exports: {} };
        cache.set(file, module);
        const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true },
        }).outputText;
        vm.runInThisContext('(function(module,exports,require){' + output + '\n})', { filename: file })(module, module.exports, id => {
            if (id.startsWith('.')) return load(path.resolve(path.dirname(file), id));
            if (id in stubs) return stubs[id];
            throw new Error(`${path.relative(PROJECT, file)} imports '${id}', which is not available in node tests`);
        });
        return module.exports;
    };
    return rel => load(path.isAbsolute(rel) ? rel : path.join(PROJECT, rel));
}
