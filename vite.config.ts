import { execFileSync } from 'node:child_process';
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

/** The version shown at the foot of the menu: the commit the build was made from, and when. */
function version(): string {
  try {
    // (an args array, not a shell string: single quotes meant for a POSIX shell break under cmd.exe on Windows)
    const out = execFileSync('git', ['log', '-1', '--date=format-local:%d.%m.%Y %H:%M', '--format=%h · %cd'], {
      env: { ...process.env, TZ: 'Europe/Berlin' },
    });
    return out.toString().trim();
  } catch {
    return 'dev';
  }
}

// Relative base so the build also runs from a GitHub Pages sub-path.
export default defineConfig({
  base: './',
  define: { __VERSION__: JSON.stringify(version()) },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
  plugins: [profileChoices()],
});
