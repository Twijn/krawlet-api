import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';

const router = Router();

// Load OpenAPI spec from project root (works in both dev and dist)
const openapiPath = join(process.cwd(), 'openapi.yaml');
const openapiFile = readFileSync(openapiPath, 'utf8');
const openapiSpec = YAML.parse(openapiFile);

// Documentation index page
router.get('/', (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Krawlet API Documentation</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          max-width: 900px;
          margin: 0 auto;
          padding: 2rem 1rem;
          line-height: 1.6;
          color: #24292e;
        }
        h1 {
          font-size: 2rem;
          margin-bottom: 0.5rem;
          font-weight: 600;
        }
        .subtitle {
          color: #586069;
          margin-bottom: 2rem;
        }
        .version {
          border: 1px solid #d1d5da;
          border-radius: 6px;
          padding: 1.5rem;
          margin-bottom: 1rem;
        }
        .version h2 {
          margin: 0 0 0.5rem 0;
          font-size: 1.5rem;
          font-weight: 600;
        }
        .version h2 a {
          color: #0366d6;
          text-decoration: none;
        }
        .version h2 a:hover {
          text-decoration: underline;
        }
        .badge {
          background: #28a745;
          color: white;
          padding: 2px 7px;
          border-radius: 3px;
          font-size: 12px;
          font-weight: 600;
          margin-left: 8px;
        }
        .features {
          color: #586069;
          margin: 0.5rem 0 0 0;
          padding: 0;
          list-style: none;
        }
        .features li {
          padding: 0.25rem 0;
        }
        .footer {
          margin-top: 3rem;
          padding-top: 2rem;
          border-top: 1px solid #e1e4e8;
          color: #586069;
          font-size: 0.875rem;
        }
        .footer a {
          color: #0366d6;
          text-decoration: none;
        }
        .footer a:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <h1>Krawlet API Documentation</h1>
      <p class="subtitle">Minecraft economy tracking system</p>
      
      <div class="version">
        <h2>
          <a href="/v1">Version 1</a>
          <span class="badge">STABLE</span>
        </h2>
        <p>REST API with authentication, rate limiting, and comprehensive endpoints for shop tracking, item management, and player data.</p>
        <ul class="features">
          <li>Shop and item tracking</li>
          <li>Player address management</li>
          <li>Reports and analytics</li>
        </ul>
      </div>

      <div class="footer">
        <a href="https://github.com/Twijn/krawlet-api" target="_blank">GitHub</a> · 
        <a href="https://api.krawlet.cc/v1" target="_blank">API Root</a>
      </div>
    </body>
    </html>
  `;

  res.send(html);
});

// Serve v1 docs at /docs/v1
router.use(
  '/v1',
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec, {
    customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
    .swagger-ui .info .title { font-size: 2.5rem; }
    .swagger-ui .scheme-container { background: #fafafa; padding: 1rem; border-radius: 4px; }
  `,
    customSiteTitle: 'Krawlet API v1 Documentation',
    customfavIcon: '/favicon.ico',
  }),
);

export default router;
