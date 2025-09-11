module.exports = {
  "src/**/*.{ts,tsx}": [
    "eslint --fix",
    "git add"
  ],
  "src/**/*.{js,jsx,ts,tsx,json,css,md}": [
    "prettier --write",
    "git add"
  ]
}
