import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-svelte'],
  manifest: {
    host_permissions: ['http://127.0.0.1/*', 'http://localhost/*'],
  },
});
