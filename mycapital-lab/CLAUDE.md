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
- Abas nesta ordem: Marca, Calendário (antiga Datas importantes), Notícias, Referências, Mapa de ideias, Planejamento (antigo Calendário), Métricas, Concorrentes. Os ids internos continuam `datas` e `calendario`; só os nomes e a ordem mudam (`abas` e `ordem` em `window.__LAB__`).
- Sem o cartão "Novidade da semana".
- Formatos (`formatos` em `window.__LAB__`): Reels, Carrossel, Post Estático, Stories, Blog Post, Live, Shorts, Newsletter, Guia, Vídeo longo. Valem para todo o sistema (posts, ideias, referências, itens de concorrentes e sugestões do Claude). Dá para marcar mais de um: o campo vira caixas de seleção e o valor fica como texto separado por vírgula (`"Reels, Carrossel"`). As sugestões do Claude são normalizadas para essa lista. Em 2026-10-01 os itens salvos foram convertidos (Artigo e Notícia viraram Blog Post, Post texto virou Post Estático; Vídeo virou Vídeo longo; Landing page e Campanha no site ficaram vazios).
- Mapa de ideias: filtro de pilar em lista suspensa (vale também no Content Lab). A escolha fica guardada no navegador e uma ideia nova já vem com o pilar filtrado.
- Notícias: sem a faixa de fontes e sem o filtro por temas. Só aparecem notícias ligadas aos pilares da marca. O Claude da página classifica cada notícia e grava `pilar` (nome exato do pilar, ou vazio quando não se liga a nenhum) e `pilarBase` (os pilares da época, separados por `|`). Se os pilares mudarem, ele classifica de novo. Enquanto não classifica, vale uma leitura por palavras-chave.
- Referências: sem vidIQ e sem "Atualizar Instagram". Botões: Padrões em comum, Nova referência, Bússola e, em cada card, Adaptar para a marca. Filtros: Da internet (`origem: "web"`, e também os antigos `radar`), Variações do Claude (`origem: "claude"`) e Salvas por você. Sem filtro por temas. **Só entram virais de no máximo 30 dias:** referências da internet e salvas têm `postedAt` (data da postagem, obrigatória no formulário) e variações do Claude têm `baseDate` (data do post em que se inspiram); sem data ou mais velhas ficam ocultas (exemplos sempre aparecem). A página avisa quantas estão ocultas. A Bússola usa só essas referências e roda a partir de 2. A Bússola mostra só "Funciona" (sem "Evite" e "Faça agora").
- Referência da internet: `platform` (instagram, tiktok, youtube, linkedin, x, web), `url`, `creator`, `hook`, `views` (só números citados por uma fonte, dizendo qual), `why`, `fit`, `tags`.
- Variação do Claude: `hook`, `format`, `why` (por que deve funcionar), `fit`, `base` (em qual referência real se inspira) e `baseUrl`. Nunca tem números próprios, e a Bússola não usa variações. O card tem o botão "Adicionar ao planejamento", que abre um post novo já preenchido (título = gancho, canal pela plataforma, formato e pilar quando reconhecidos, observações com o porquê, o encaixe e a inspiração).

## Pilares e linha editorial (desde 2026-10-01)
- Pilares das redes: Mercado e economia, Impostos e patrimônio, Empresário e investidor, Rotina e performance, Histórias do dinheiro, Carteira e Mycapital na prática. Tom neutro (sem opinião sobre o mercado e sem recomendar ativos).
- Linha editorial: qualquer assunto pode virar conteúdo, desde que termine no que muda para o investidor (carteira, impostos ou patrimônio). IR de renda variável é o carro-chefe. Referência: cerca de 60% nos pilares que atraem e 40% em Impostos e patrimônio e Carteira e Mycapital na prática.
- O blog segue o Mapa de Conteúdo GEO (5 pilares próprios); os pilares das redes usam o GEO como fonte de temas. Tudo isso está no briefing da marca (aba Marca), que o Claude da página usa.

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
- Pesquisa contínua de virais na internet: precisa de uma rotina com acesso à web (este ambiente bloqueia YouTube, Instagram e a maioria dos sites). Em 2026-10-01 as Referências foram refeitas sem vidIQ: saíram as 7 do radar do vidIQ, o documento `importador/vidiq` e a Bússola antiga (a página gera outra). Depois, com a regra dos 30 dias, entraram só virais recentes: 2 da internet (Nobru sobre o fim das bets, 25/09; imposto da Holanda sobre bitcoin, 30/09) e 4 variações do Claude. As 7 prévias do radar continuam nos assets, sem uso.
- As rotinas automáticas (Notícias, Coleta gratuita, Instagram pelo vidIQ, Evolução) ainda gravam só no Content Lab. Os botões "Pesquisar agora" e "Atualizar Instagram" daqui disparam essas mesmas rotinas, então o resultado aparece no Content Lab até elas passarem a gravar aqui.
