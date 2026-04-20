const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const openApiPath = path.join(rootDir, 'openapi.yaml');

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const openApiRaw = fs.readFileSync(openApiPath, 'utf8');
const openApiDoc = YAML.parse(openApiRaw);

if (!openApiDoc || typeof openApiDoc !== 'object') {
  throw new Error('Failed to parse openapi.yaml');
}

if (!openApiDoc.info || typeof openApiDoc.info !== 'object') {
  openApiDoc.info = {};
}

openApiDoc.info.version = packageJson.version;

const updated = YAML.stringify(openApiDoc, {
  indent: 2,
  lineWidth: 0,
});

fs.writeFileSync(openApiPath, updated, 'utf8');
console.log(`Synced openapi.yaml info.version to ${packageJson.version}`);
