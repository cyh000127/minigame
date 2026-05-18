import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const outputDir = join(rootDir, '.pages-dist');
const repoName = process.env.PAGES_REPO_NAME ?? 'minigame';
const rootBasePath = `/${repoName}/`;
const excludedGames = new Set(['quoridor']);

run(getCorepackCommand(), ['pnpm', 'run', 'build'], {
  cwd: rootDir,
  env: {
    ...process.env,
    PAGES_BASE_PATH: rootBasePath,
  },
});

resetDirectory(outputDir);
copyDirectory(join(rootDir, 'dist'), outputDir);

const gamesDir = join(rootDir, 'games');
const gameSlugs = readdirSync(gamesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((slug) => !excludedGames.has(slug));

for (const slug of gameSlugs) {
  const gameDir = join(gamesDir, slug);
  const gameBasePath = `/${repoName}/games/${slug}/`;

  run(getCorepackCommand(), ['pnpm', '--dir', gameDir, 'install', '--frozen-lockfile'], {
    cwd: rootDir,
  });
  run(getCorepackCommand(), ['pnpm', '--dir', gameDir, 'exec', 'tsc', '--noEmit'], {
    cwd: rootDir,
  });
  run(getCorepackCommand(), ['pnpm', '--dir', gameDir, 'exec', 'vite', 'build', '--base', gameBasePath], {
    cwd: rootDir,
  });

  const gameDistDir = join(gameDir, 'dist');
  const targetGameDir = join(outputDir, 'games', slug);

  copyDirectory(gameDistDir, targetGameDir);
}

console.log(`Pages artifact assembled at ${outputDir}`);

function resetDirectory(directoryPath) {
  rmSync(directoryPath, { recursive: true, force: true });
  mkdirSync(directoryPath, { recursive: true });
}

function copyDirectory(sourcePath, targetPath) {
  if (!existsSync(sourcePath)) {
    throw new Error(`Missing directory: ${sourcePath}`);
  }

  mkdirSync(targetPath, { recursive: true });
  cpSync(sourcePath, targetPath, { recursive: true });
}

function run(command, args, options) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
}

function getCorepackCommand() {
  return 'corepack';
}
