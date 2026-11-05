import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

// `npm run preview` serves the production build with the same security headers as vercel.json,
// so the Content-Security-Policy can be tested locally. (Not applied to `npm run dev`, whose
// hot-reload needs inline scripts and websockets.)
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'));
const securityHeaders = Object.fromEntries(
  vercel.headers[0].headers
    .filter((h) => h.key !== 'Strict-Transport-Security')
    .map((h) => [h.key, h.key === 'Content-Security-Policy' ? h.value.replace('; upgrade-insecure-requests', '') : h.value]),
);

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  preview: { port: 4173, headers: securityHeaders },
});
