import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createApiApp } from './api.ts';

const port = Number(process.env.PORT || 4173);
const bindHost = process.env.BIND_HOST || '0.0.0.0';
const app = createApiApp();

const distDir = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { dotfiles: 'deny', maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
      res.sendFile(path.join(distDir, 'index.html'));
      return;
    }
    next();
  });
}

app.listen(port, bindHost, () => {
  console.log(`Vyapar TaxOne Full-Stack Server listening on http://${bindHost}:${port}`);
});
