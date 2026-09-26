// Teste de fumaça: abre o index.html em modo pré-visualização (dados do demo.json),
// passa por todas as abas e confere que nada quebrou.
// Rode: NODE_PATH=$(npm root -g) node tests/smoke.cjs
const path = require('path');
const { chromium } = require('playwright');

const TABS = ['noticias', 'referencias', 'calendario', 'datas', 'marca', 'ideias', 'metricas', 'concorrentes'];

(async () => {
  const exe = process.env.CHROMIUM_PATH || undefined;
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage({ acceptDownloads: true });
  const erros = [];
  page.on('pageerror', e => erros.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/_blob|ERR_FILE_NOT_FOUND|ERR_CERT|fonts\.g/.test(m.text())) erros.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForSelector('#tabs .tab');

  for (const t of TABS) {
    await page.click(`#tabs [data-tab="${t}"]`);
    const txt = (await page.textContent('#main')) || '';
    if (txt.trim().length < 40) erros.push(`aba ${t} vazia`);
    if (/—/.test(txt.replace(/\(—\)/g, ''))) erros.push(`aba ${t} tem travessão na interface`);
  }

  // novidades
  await page.click('#tabs [data-tab="concorrentes"]');
  if (!(await page.$('[data-act="comp-import"]'))) erros.push('botão Atualizar Instagram ausente');
  await page.click('#tabs [data-tab="marca"]');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), page.click('[data-act="brand-backup"]')]);
  const conteudo = JSON.parse(require('fs').readFileSync(await dl.path(), 'utf8'));
  if (!conteudo.data || !Array.isArray(conteudo.data.posts) || !conteudo.data.posts.length) erros.push('backup sem posts');

  // criar e editar um post no calendário (modo memória)
  await page.click('#tabs [data-tab="calendario"]');
  await page.click('[data-act="new"][data-col="posts"], [data-act="new-on"]');
  await page.fill('#f-title', 'Post de teste do smoke');
  await page.click('[data-act="save-item"]');
  await page.waitForTimeout(100);
  if (!((await page.textContent('#main')) || '').includes('Post de teste do smoke')) erros.push('post criado não apareceu no calendário');

  await browser.close();
  if (erros.length) { console.error('FALHOU:\n' + erros.join('\n')); process.exit(1); }
  console.log('ok: ' + TABS.length + ' abas, backup, importar e criação de post');
})().catch(e => { console.error(e); process.exit(1); });
