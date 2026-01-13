import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';

const router = Router();

// Load OpenAPI spec
const openapiPath = join(__dirname, '../../openapi.yaml');
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
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }
        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          max-width: 800px;
          width: 100%;
          padding: 3rem;
        }
        h1 {
          color: #2d3748;
          font-size: 2.5rem;
          margin-bottom: 0.5rem;
        }
        .subtitle {
          color: #718096;
          font-size: 1.1rem;
          margin-bottom: 2rem;
        }
        .versions {
          display: grid;
          gap: 1rem;
          margin-top: 2rem;
        }
        .version-card {
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          padding: 1.5rem;
          transition: all 0.2s;
          cursor: pointer;
          text-decoration: none;
          color: inherit;
          display: block;
        }
        .version-card:hover {
          border-color: #667eea;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
        }
        .version-title {
          font-size: 1.5rem;
          font-weight: 600;
          color: #2d3748;
          margin-bottom: 0.5rem;
        }
        .version-badge {
          display: inline-block;
          background: #48bb78;
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          margin-left: 0.5rem;
        }
        .version-description {
          color: #718096;
          margin-top: 0.5rem;
        }
        .features {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          margin-top: 1rem;
        }
        .feature {
          background: #edf2f7;
          color: #2d3748;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          font-size: 0.875rem;
        }
        .footer {
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 1px solid #e2e8f0;
          text-align: center;
          color: #718096;
          font-size: 0.875rem;
        }
        .footer a {
          color: #667eea;
          text-decoration: none;
        }
        .footer a:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🦀 Krawlet API</h1>
        <p class="subtitle">Minecraft economy tracking system API documentation</p>
        
        <div class="versions">
          <a href="/docs/v1" class="version-card">
            <div class="version-title">
              API v1
              <span class="version-badge">Current</span>
            </div>
            <div class="version-description">
              Full-featured REST API with rate limiting, authentication, and comprehensive endpoints
            </div>
            <div class="features">
              <span class="feature">📊 Shop Tracking</span>
              <span class="feature">💰 Item Prices</span>
              <span class="feature">🐢 Turtle Management</span>
              <span class="feature">👥 Player Data</span>
              <span class="feature">📈 Reports & Analytics</span>
            </div>
          </a>
        </div>

        <div class="footer">
          <p>
            Built with ❤️ for the Minecraft economy community<br>
            <a href="https://github.com/Twijn/krawlet-api" target="_blank">View on GitHub</a> • 
            <a href="/api/v1">API Root</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  res.send(html);
});

// Serve v1 docs at /docs/v1
router.use('/v1', swaggerUi.serve);
router.get(
  '/v1',
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
