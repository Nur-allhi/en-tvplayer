import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getAppVersion() {
  const rootPkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'package.json'), 'utf-8'));
  const version = rootPkg.version || '0.0.0';
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: path.resolve(__dirname, '..', '..'), encoding: 'utf-8' }).trim();
    if (branch === 'main') return 'stable_' + version;
    const commit = execSync('git rev-parse --short HEAD', { cwd: path.resolve(__dirname, '..', '..'), encoding: 'utf-8' }).trim();
    return 'beta_' + version + '(' + commit + ')';
  } catch {
    return 'beta_' + version;
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(getAppVersion()),
  },
  root: '.',
  base: '/enplayer/',
  resolve: {
    alias: {
      '@root': path.resolve(__dirname, '..', '..'),
    },
  },
  build: {
    outDir: 'dist',
    minify: 'esbuild',
    target: 'es2015',
    modulePreload: false,
    rollupOptions: {
      output: {
        format: 'iife',
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
      },
    },
  },
  plugins: [
    {
      name: 'tizen-html-transform',
      closeBundle() {
        const html = fs.readFileSync(path.resolve(__dirname, 'dist/index.html'), 'utf-8');
        const fixed = html
          .replace(/\s+type="module"/g, '')
          .replace(/\s+crossorigin/g, '');
        fs.writeFileSync(path.resolve(__dirname, 'dist/index.html'), fixed);
      },
    },
  ],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/proxy': { target: 'https://localhost:5000', changeOrigin: true, secure: false },
      '/api': { target: 'https://localhost:5000', changeOrigin: true, secure: false },
      '/log': { target: 'https://localhost:5000', changeOrigin: true, secure: false },
    },
  },
  preview: {
    port: 4173,
    host: '0.0.0.0',
  },
});
