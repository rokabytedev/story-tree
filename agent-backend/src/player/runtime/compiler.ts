import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';

const RUNTIME_ENTRY = path.resolve(process.cwd(), 'agent-backend/src/player/runtime/index.ts');

interface BuildRuntimeOptions {
  minify?: boolean;
}

export async function buildPlayerRuntimeSource(
  options: BuildRuntimeOptions = {}
): Promise<string> {
  const source = await readFile(RUNTIME_ENTRY, 'utf-8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ES2020,
      removeComments: options.minify ?? false,
    },
  });
  return transpiled.outputText;
}

export async function buildPlayerRuntimeInlineSource(): Promise<string> {
  const source = await buildPlayerRuntimeSource({ minify: true });
  const withoutExport = source.replace(
    /export function createPlayerController/,
    'function createPlayerController'
  );
  return withoutExport.trim();
}

export async function writePlayerRuntimeModule(
  outputDir: string,
  options: { fileName?: string } = {}
): Promise<string> {
  const fileName = options.fileName ?? 'player-runtime.js';
  const source = await buildPlayerRuntimeSource();
  const outputPath = path.join(outputDir, fileName);

  await writeFile(outputPath, source, 'utf-8');
  return outputPath;
}
