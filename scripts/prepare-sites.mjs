import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = dirname(scriptDirectory);
const distributionDirectory = join(projectDirectory, 'dist');
const clientDirectory = join(distributionDirectory, 'client');
const serverDirectory = join(distributionDirectory, 'server');

const distributionEntries = await readdir(distributionDirectory, { withFileTypes: true });

await rm(clientDirectory, { recursive: true, force: true });
await rm(serverDirectory, { recursive: true, force: true });
await mkdir(clientDirectory, { recursive: true });

for (const entry of distributionEntries) {
  if (entry.name === 'client' || entry.name === 'server' || entry.name === '.openai') continue;

  await cp(join(distributionDirectory, entry.name), join(clientDirectory, entry.name), {
    recursive: true
  });
}

await mkdir(serverDirectory, { recursive: true });
await cp(join(scriptDirectory, 'sites-worker.mjs'), join(serverDirectory, 'index.js'));
