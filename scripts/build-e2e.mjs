import { spawnSync } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npm, ['run', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_ENABLE_TEST_HOOKS: 'true' },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
