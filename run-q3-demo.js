// Demonstrates the Q3 strategy on a fixture shaped like the exam snippet. Reloads 3x to prove class-independence.
// Run from ../Q1 folder deps:  CHROME_PATH=... node ../Q3/run-q3-demo.js   (or copy next to node_modules)
const path = require('path');
const { chromium } = require(require.resolve('playwright-core', { paths: [path.join(__dirname, '../Q1'), __dirname] }));
const { INIT_SCRIPT, FIND_TARGET } = require('./shadow-pierce');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.addInitScript(INIT_SCRIPT);
  let ok = true;
  for (let i = 1; i <= 3; i++) {
    await page.goto('file://' + path.join(__dirname, 'demo.html'));
    const info = await page.evaluate(`(() => { const b = ${FIND_TARGET}; return b ? { cls: b.className, text: b.textContent, host: b.getRootNode().host.tagName } : null; })()`);
    // sanity: a normal open-shadow-only query cannot see it
    const naive = await page.evaluate(() => document.querySelector('enterprise-portal').shadowRoot.querySelector('payment-terminal').shadowRoot);
    await page.evaluate(`(() => ${FIND_TARGET}.click())()`);
    const clicks = await page.evaluate(() => window.__authorized);
    console.log(`reload ${i}: found=${JSON.stringify(info)} | element.shadowRoot of closed host = ${naive} | clicks recorded=${clicks}`);
    ok = ok && info && info.text === 'Authorize Ledger Funds' && clicks === 1;
  }
  await browser.close();
  console.log(ok ? 'Q3 DEMO PASS: button found through open->closed->open boundaries with regenerating classes' : 'Q3 DEMO FAIL');
  process.exit(ok ? 0 : 1);
})();
