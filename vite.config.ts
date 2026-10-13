import { writeFile } from 'node:fs/promises';
import { defineConfig, type Plugin } from 'vite';

/** Dev only: the game posts the chosen driving profiles here; they end up in a file in the project. */
function profileChoices(): Plugin {
  return {
    name: 'tempo6-profile-choices',
    configureServer(server) {
      server.middlewares.use('/__profiles', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            JSON.parse(body);
            void writeFile('profile-choices.json', body + '\n').then(() => res.end('ok'));
          } catch {
            res.statusCode = 400;
            res.end();
          }
        });
      });
    },
  };
}

// Relative base so the build also runs from a GitHub Pages sub-path.
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
  plugins: [profileChoices()],
});
