import './styles.css';
import { loadConfig } from './core/config';
import { App } from './ui/app';
import { Builder } from './ui/builder';
import { urlParams } from './core/urlparams';

async function bootstrap(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) throw new Error('#app root not found');

  // ?builder opens the config-authoring page instead of the main app.
  if (urlParams.has('builder')) {
    const builder = new Builder(root);
    await builder.start();
    return;
  }

  const { config, settings } = await loadConfig();
  const app = new App(root, config, settings);
  await app.start();
}

bootstrap().catch((err) => {
  console.error(err);
  const boot = document.getElementById('boot');
  if (boot) boot.textContent = 'Failed to start: ' + (err instanceof Error ? err.message : String(err));
});
