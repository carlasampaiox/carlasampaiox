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

  // cartão de novidade some ao clicar em Entendi
  if (!(await page.$('.novidade'))) erros.push('cartão de novidade ausente');
  await page.click('[data-act="nov-ok"]');
  if (await page.$('.novidade')) erros.push('cartão de novidade não sumiu');
  // novidades
  await page.click('#tabs [data-tab="concorrentes"]');
  if (!(await page.$('[data-act="comp-import"]'))) erros.push('botão Atualizar Instagram ausente');
  await page.click('#tabs [data-tab="referencias"]');
  if (!(await page.$('.bussola .trends'))) erros.push('Em alta no Google ausente na Bússola');
  if (!(await page.$('[data-act="comp-import"]'))) erros.push('botão Atualizar Instagram ausente em Referências');
  if (await page.$('[data-f="refTipo"][data-v="tiktok"], [data-v="tiktok"]')) erros.push('filtro TikTok ainda aparece em Referências');
  await page.click('[data-f="refTipo"][data-v="radar"]');
  const radar = await page.$$eval('#main .card.ref', els => els.map(e => e.textContent));
  if (radar.length !== 1 || !radar[0].includes('@exemplo.corre')) erros.push('filtro Oportunidades não mostra só o radar');
  if (!radar.some(t => t.includes('Como a marca entra'))) erros.push('fit da marca ausente no radar');
  await page.click('[data-f="refTipo"][data-v=""]');
  const refsTexto = await page.$eval('#main', e => e.textContent);
  if (refsTexto.includes('não deve aparecer')) erros.push('referência de concorrente aparece em Referências');
  await page.click('#tabs [data-tab="concorrentes"]');
  if (await page.$('[data-act="comp-to-refs"]')) erros.push('botão Salvar em Referências ainda aparece em Concorrentes');
  await page.click('#tabs [data-tab="referencias"]');
  await page.click('#tabs [data-tab="marca"]');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), page.click('[data-act="brand-backup"]')]);
  const conteudo = JSON.parse(require('fs').readFileSync(await dl.path(), 'utf8'));
  if (!conteudo.data || !Array.isArray(conteudo.data.posts) || !conteudo.data.posts.length) erros.push('backup sem posts');

  // métricas: KPIs semanais, visão geral, canal, tabela e lançamento de semana
  await page.click('#tabs [data-tab="metricas"]');
  if ((await page.$$('.kcard')).length !== 7) erros.push('visão geral de KPIs não mostra os 7 canais');
  await page.click('[data-f="kGrupo"][data-v="youtube"]');
  const yt = await page.$eval('#main', e => e.textContent);
  if (!yt.includes('Tempo de exibição') || !yt.includes('6,5 h')) erros.push('canal YouTube sem as métricas');
  await page.click('[data-act="kpi-new"]');
  await page.fill('#k-data', '2026-09-28');
  await page.fill('#k-instagram-seguidores', '5.020');
  await page.fill('#k-instagram-alcance', '21,4 mil');
  await page.fill('#k-blog-tempoEngajamento', "1'05''");
  await page.click('[data-act="kpi-save"]');
  await page.click('[data-f="kGrupo"][data-v=""]');
  const geral = await page.$eval('#main', e => e.textContent);
  if (!geral.includes('~21.400') || !geral.includes("1'05''") || !geral.includes('5.020')) erros.push('semana lançada não aparece com os valores convertidos');
  await page.click('[data-act="kpi-new"]');
  await page.fill('#k-data', '2026-10-05');
  await page.fill('#k-instagram-posts', 'abc');
  await page.click('[data-act="kpi-save"]');
  if (!(await page.$eval('#formErr', e => !e.hidden && e.textContent.includes('Posts na semana')))) erros.push('valor inválido não foi recusado');
  await page.click('[data-act="modal-close"]');

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
