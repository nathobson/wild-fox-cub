import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

/*
 * Published pages link copies of public/site.css and site.js named after their contents
 * (/assets/site-<hash>.css / .js), which public/_headers lets browsers cache for a year.
 * Any change gives a file a new name, and every deploy re-renders the pages
 * with the new link. In dev, pages link /site.css and /site.js so edits show straight away.
 */
const versioned = (path: string, ext: string) => {
  const source = readFileSync(path);
  return { source, fileName: `assets/site-${createHash('sha256').update(source).digest('hex').slice(0, 10)}.${ext}` };
};
const siteCss = versioned('public/site.css', 'css');
// The scroll engine, likewise.
const siteJs = versioned('public/site.js', 'js');

function versionedSiteCss(): Plugin {
  return {
    name: 'fox-cub:versioned-site-css',
    generateBundle() {
      if (this.environment.name === 'client') {
        for (const file of [siteCss, siteJs]) this.emitFile({ type: 'asset', ...file });
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), cloudflare(), versionedSiteCss()],
  define: {
    // Lets the Worker spot pages rendered by an older deploy and re-render them.
    __BUILD_ID__: JSON.stringify(Date.now().toString(36)),
    __SITE_CSS__: JSON.stringify(command === 'build' ? `/${siteCss.fileName}` : '/site.css'),
    __SITE_JS__: JSON.stringify(command === 'build' ? `/${siteJs.fileName}` : '/site.js'),
    // The editor's Content-Security-Policy is relaxed in dev for Vite's inline scripts.
    __DEV__: JSON.stringify(command !== 'build'),
  },
  environments: {
    // The browser bundle is only the /foxcub editor; published pages ship no app JS.
    client: {
      build: {
        rollupOptions: {
          input: { foxcub: 'foxcub.html' },
        },
      },
    },
  },
}));
