import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FlaxValidationError } from './diagnostics.mjs';
import { parseFlax } from './parse-flax.mjs';
import { summarizeFlax } from './summarize-flax.mjs';
import { validateFlax } from './validate-flax.mjs';

function argumentsMap(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 2) result[values[index]?.replace(/^--/, '')] = values[index + 1];
  return result;
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

const [command, ...rest] = process.argv.slice(2);
const options = argumentsMap(rest);

try {
  if (!['inspect', 'prepare'].includes(command)) throw new Error('Usage: cli.mjs <inspect|prepare> --input <game.json> [--output <directory>]');
  if (!options.input) throw new Error('--input is required');
  const sourcePath = resolve(options.input);
  let raw;
  try {
    raw = JSON.parse(await readFile(sourcePath, 'utf8'));
  } catch (error) {
    console.error(`JSON_INVALID ${sourcePath}: ${error.message}`);
    process.exitCode = 1;
    process.exit();
  }
  const document = validateFlax(parseFlax(raw));
  const summary = summarizeFlax(document);

  if (command === 'inspect') {
    console.log('Flax document valid');
    for (const [key, value] of Object.entries(summary)) console.log(`${key}: ${value}`);
  } else {
    if (!options.output) throw new Error('--output is required for prepare');
    const output = resolve(options.output);
    await mkdir(output, { recursive: true });
    const manifest = {
      atlas: document.metadata.image,
      atlasSize: document.metadata.atlasSize,
      frames: document.atlasFrames.map((frame) => ({
        id: frame.id,
        region: frame.region,
        offset: frame.offset,
        sourceSize: frame.sourceSize,
        output: `frames/${frame.id}.png`,
      })),
    };
    await writeFile(resolve(output, 'normalized-game.json'), stableJson(document));
    await writeFile(resolve(output, 'atlas-manifest.json'), stableJson(manifest));
    console.log(`Prepared ${document.atlasFrames.length} frames in ${output}`);
  }
} catch (error) {
  if (error instanceof FlaxValidationError) {
    for (const item of error.diagnostics) console.error(`${item.code} ${item.path}: ${item.message}`);
    process.exitCode = 2;
  } else {
    console.error(error.message);
    process.exitCode = 1;
  }
}
