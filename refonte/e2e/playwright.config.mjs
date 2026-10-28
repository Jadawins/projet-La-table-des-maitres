import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: process.env.CI?2:4,
  timeout: 90000,
  expect: {timeout: 10000},
  outputDir: 'test-results',
  reporter: [['list'], ['html', {open:'never'}], ['json', {outputFile:'test-results/results.json'}]],
  use: {
    baseURL:'http://127.0.0.1:4199',
    viewport:{width:1440,height:1000},
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    serviceWorkers:'block',
    actionTimeout:10000,
    navigationTimeout:15000,
  },
  projects:[{name:'chromium',use:{browserName:'chromium'}}],
  webServer: {
    command:'node server.mjs',
    url:'http://127.0.0.1:4199/_e2e/health',
    reuseExistingServer:false,
    timeout:30000,
  },
});
