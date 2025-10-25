import fs from 'fs';

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

export const getPackageVersion = () => packageJson.version;
export const getPackageName = () => packageJson.name;
