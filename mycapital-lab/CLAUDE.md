# Mycapital Lab

Versão enxuta do Content Lab só para a Mycapital, publicada como artifact em:
https://claude.ai/artifact/AgjAy6vCSEercWnABxGipJ

## Como funciona
- O código é o mesmo do Content Lab (`../content-lab/app.js`, `app.css` e `demo.json`). Esta pasta guarda só o que muda:
  - `shell.html`: título, logo (marca da Mycapital + "Lab" no quadrado laranja) e `window.__LAB__ = {nome, marca: 'mycapital', slug}`.
  - `tema.css`: cores e fontes da marca, aplicadas por cima dos tokens do Content Lab. Laranja `#FF6B08` e grafite `#121614`, tirados da logo do Estúdio Mycapital. Títulos em Poppins, texto em Inter.
  - `build.py`: junta tudo em `index.html` (`--check` só confere, usado no CI).
- Com `window.__LAB__.marca`, o app mostra só essa marca: some o seletor de marcas, a opção "Nova marca", a cor de identificação e o "Excluir marca". Todo recurso novo do Content Lab chega aqui ao rodar `python3 build.py`.

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
- As rotinas automáticas (Notícias, Coleta gratuita, Instagram pelo vidIQ, Evolução) ainda gravam só no Content Lab. Os botões "Pesquisar agora" e "Atualizar Instagram" daqui disparam essas mesmas rotinas, então o resultado aparece no Content Lab até elas passarem a gravar aqui.
