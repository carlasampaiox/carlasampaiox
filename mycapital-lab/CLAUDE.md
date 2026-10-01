# Mycapital Lab

Versão enxuta do Content Lab só para a Mycapital, publicada como artifact em:
https://claude.ai/artifact/AgjAy6vCSEercWnABxGipJ

## Como funciona
- O código é o mesmo do Content Lab (`../content-lab/app.js`, `app.css` e `demo.json`). Esta pasta guarda só o que muda:
  - `shell.html`: título, logo (marca da Mycapital + "Lab" no quadrado laranja) e `window.__LAB__ = {nome, marca: 'mycapital', slug}`.
  - `tema.css`: cores e fontes da marca, aplicadas por cima dos tokens do Content Lab. Laranja `#FF6B08` e grafite `#121614`, tirados da logo do Estúdio Mycapital. Títulos em Poppins, texto em Inter.
  - `build.py`: junta tudo em `index.html` (`--check` só confere, usado no CI).
- Com `window.__LAB__.marca`, o app mostra só essa marca: some o seletor de marcas, a opção "Nova marca", a cor de identificação e o "Excluir marca". Todo recurso novo do Content Lab chega aqui ao rodar `python3 build.py`.

## Versão enxuta (`enxuto: true` em `window.__LAB__`)
- Abas nesta ordem: Marca, Calendário (antiga Datas importantes), Notícias, Referências, Mapa de ideias, Agendamentos (antigo Calendário), Métricas, Concorrentes. Os ids internos continuam `datas` e `calendario`; só os nomes e a ordem mudam (`abas` e `ordem` em `window.__LAB__`).
- Sem o cartão "Novidade da semana".
- Notícias: sem a faixa de fontes e sem o filtro por temas. Só aparecem notícias ligadas aos pilares da marca. O Claude da página classifica cada notícia e grava `pilar` (nome exato do pilar, ou vazio quando não se liga a nenhum) e `pilarBase` (os pilares da época, separados por `|`). Se os pilares mudarem, ele classifica de novo. Enquanto não classifica, vale uma leitura por palavras-chave.
- Referências: sem vidIQ e sem "Atualizar Instagram". Botões: Padrões em comum, Nova referência, Bússola e, em cada card, Adaptar para a marca. Filtros: Da internet (`origem: "web"`, e também os antigos `radar`), Variações do Claude (`origem: "claude"`) e Salvas por você. Sem filtro por temas.
- Referência da internet: `platform` (instagram, tiktok, youtube, linkedin, x, web), `url`, `creator`, `hook`, `views` (só números citados por uma fonte, dizendo qual), `why`, `fit`, `tags`.
- Variação do Claude: `hook`, `format`, `why` (por que deve funcionar), `fit`, `base` (em qual referência real se inspira) e `baseUrl`. Nunca tem números próprios, e a Bússola não usa variações.

## Banco e prévias
- Banco próprio (capability `db`), com a mesma estrutura do Content Lab (`brands/mycapital/...`, `importador/vidiq`). Ver `../content-lab/CLAUDE.md`.
- Cópia inicial em 2026-10-01: 382 documentos e 26 prévias vindos do Content Lab. As prévias ganharam ids novos neste artifact e o campo `media` foi trocado pelos ids novos.
- A partir da cópia, os dois bancos são independentes.

## Como publicar uma alteração
1. Editar `shell.html` ou `tema.css` daqui, ou o código em `../content-lab/`.
2. Rodar `python3 build.py` aqui (e em `../content-lab/` se o código mudou), `node --check ../content-lab/app.js` e, em `../content-lab/`, `PAGINA=../mycapital-lab/index.html NODE_PATH=$(npm root -g) node tests/smoke.cjs`.
3. Publicar `index.html` no artifact acima, passando a `url` acima.
4. Capacidades: `db`, `sample`, `assets`, `downloads` e `mcp` com `Claude Code Remote` / `fire_trigger`.

## Pendente
- Pesquisa contínua de virais na internet: precisa de uma rotina com acesso à web (este ambiente bloqueia YouTube, Instagram e a maioria dos sites). Em 2026-10-01 as Referências foram refeitas sem vidIQ: saíram as 7 do radar do vidIQ, o documento `importador/vidiq` e a Bússola antiga (a página gera outra). Ficaram 5 referências da internet (números só quando a fonte cita) e 6 variações do Claude baseadas nelas. As 7 prévias do radar continuam nos assets, sem uso.
- As rotinas automáticas (Notícias, Coleta gratuita, Instagram pelo vidIQ, Evolução) ainda gravam só no Content Lab. Os botões "Pesquisar agora" e "Atualizar Instagram" daqui disparam essas mesmas rotinas, então o resultado aparece no Content Lab até elas passarem a gravar aqui.
