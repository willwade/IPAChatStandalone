import './styles.css';
import { loadConfig } from './core/config';
import { App } from './ui/app';

async function bootstrap(): Promise<void> {
  const { config, settings } = await loadConfig();
  const root = document.getElementById('app');
  if (!root) throw new Error('#app root not found');
  const app = new App(root, config, settings);
  await app.start();
}

bootstrap().catch((err) => {
  console.error(err);
  const boot = document.getElementById('boot');
  if (boot) boot.textContent = 'Failed to start: ' + (err instanceof Error ? err.message : String(err));
});
