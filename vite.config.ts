import { defineConfig } from 'vite';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/').at(-1);
const configuredBase = process.env.BASE_PATH ?? (repositoryName ? `/${repositoryName}/` : '/gimbot/');
const base = configuredBase.endsWith('/') ? configuredBase : `${configuredBase}/`;

export default defineConfig({
  base,
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
