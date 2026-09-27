# Content Lab

Central de conteúdo multimarca da Carla, publicada como artifact do Claude em:
https://claude.ai/artifact/JWoCf2AYGr2K39nSmCzm9R

## Regras de trabalho
- Responder sempre em português do Brasil.
- Nunca usar travessão (—) nem meia-risca (–) como pontuação, nem na interface nem nos textos gerados.
- Não inventar números, datas, posts ou perfis. Dados de exemplo levam `exemplo: true`.
- Nunca guardar chaves de API ou tokens no artifact nem no banco dele. Chaves ficam só em arquivo `.env` local, fora do controle de versão.

## Arquivos
- `shell.html`: estrutura da página (título, fontes, header, modais). Tem os marcadores `/*CSS*/`, `/*DEMO*/` e `/*JS*/`.
- `app.css`: estilos. Cor de destaque magenta (`--accent`), tema claro e escuro por tokens.
- `app.js`: toda a lógica (abas, banco, editor, botões do Claude, prévias).
- `demo.json`: dados usados só na pré-visualização, quando o banco não está disponível.
- `build.py`: junta tudo em `index.html`. Rode `python3 build.py` depois de editar (`--check` só confere, usado no CI).
- `tests/smoke.cjs`: teste de fumaça com Playwright (todas as abas, backup, criação de post).
- `index.html`: arquivo final que é publicado no artifact.
- `PEDIDO-CLAUDE-CODE.md`: o primeiro pedido para o Claude Code (importar posts com prévia). Atendido em `../importador/`.

## Como publicar uma alteração
1. Editar `app.js`, `app.css` ou `shell.html`.
2. Rodar `python3 build.py`, `node --check app.js` e `NODE_PATH=$(npm root -g) node tests/smoke.cjs`.
3. Publicar `index.html` no artifact acima, passando a `url` acima para atualizar o mesmo link.
4. Manter as capacidades: `db`, `sample`, `assets`, `downloads` (backup) e `mcp` com `Claude Code Remote` / `fire_trigger`.

## Abas (nesta ordem)
Notícias, Referências, Calendário, Datas importantes, Marca, Mapa de ideias, Métricas, Concorrentes.

## Banco (capability `db` do artifact)
- `brands/{marca}`: configurações da marca (nome, nicho, público, tom, pilares, canais, fontes, briefing).
- `brands/{marca}/news`: notícias do nicho (title, url, source, date, tag, summary).
- `brands/{marca}/refs`: referências virais. Campos: platform (instagram; TikTok está fora por enquanto), format, url, creator, views, hook, why, tags, media (id de asset de 32 caracteres), mediaType (image ou video), fit (como a marca entra), origem (`radar` para oportunidades do Instagram em geral). **Referências são só do mercado:** a própria marca e os concorrentes nunca entram (a página esconde e bloqueia perfis da marca e dos concorrentes, e o importador manda os Reels deles para `compnews`). A aba filtra por Oportunidades do radar e Salvas por você.
- `brands/{marca}/posts`: calendário (title, date, time, channel, format, status, pillar, caption, link, notes).
- `brands/{marca}/dates`: datas importantes (title, date, recurring, type, lead = dias de antecedência, notes).
- `brands/{marca}/ideas`: mapa de ideias (title, pillar, channels, format, status, source, notes).
- `brands/{marca}/metrics`: registros por período (channel, start, end, followers, reach, engagement, clicks, posts). Registros antigos podem ter só `month`.
- `brands/{marca}/competitors`: campos da usuária (name, site, blog, instagram, linkedin, youtube, tiktok, positioning, strengths, weaknesses, frequency, notes) e campos automáticos (autoSummary, autoChannels, autoContent, autoCheckedAt, research).
- `brands/{marca}/compnews`: conteúdos (`kind: "conteudo"`, com channel, format, signal) e notícias (`kind: "noticia"`, com source) dos concorrentes. Conteúdos importados também têm `media`, `mediaType`, `competitorName` e `origem: "importador"`.
- Itens com `origem: "importador"` mostram o selo "importado". Ids gravados pelo importador começam com `imp-` e são estáveis (derivados do link).

## Prévias (capability `assets`)
- Imagens e vídeos ficam no armazenamento de assets do artifact. O documento guarda só o id em `media`.
- Na página, a prévia é exibida por `"/_blob/" + id`.
- A página não consegue exibir imagens hospedadas no Instagram, TikTok ou YouTube. Toda prévia precisa ser copiada para os assets do artifact.
- Limite de 20 MB por arquivo. Tipos aceitos: png, jpeg, webp, gif, mp4, webm.

## Rotina automática
Tarefa agendada "Notícias do Content Lab" (id `trig_01AM7vMvx9QEQ2wfVjsVCMuz`), de segunda a sexta às 7h54 (Brasília).
Busca notícias das marcas, conteúdos e notícias dos concorrentes, e revisa os canais dos concorrentes.
O botão "Pesquisar agora" da aba Concorrentes dispara essa mesma tarefa com um "PEDIDO AVULSO".
Para rodar sem parar, a tarefa precisa estar com "Aprovar automaticamente" ligado.

## Coleta gratuita automática (sem créditos)
- GitHub Actions `.github/workflows/coletor.yml`, todo dia às 6h10 (Brasília): `importador/coletor.py` (feedparser) lê o RSS oficial do YouTube dos concorrentes, o Google Notícias (nicho, marca e concorrentes) e blogs. Fontes em `importador/fontes.json`. Resultado em `dados/coleta.json` e capas em `dados/midia/`.
- Rotina "Coleta gratuita do Content Lab" (id `trig_01SQYNYi97FkMhVJfZHKu2v9`), todo dia às 7h13, segue `importador/ROTINA-COLETA.md`: importa só o que é novo (comando `coleta`). Não usa vidIQ.
- Itens da coleta têm `origem: "coletor"`.

## Evolução automática
- Rotina "Evolução do Content Lab" (id `trig_019XVoUc4SdnZPJwiXEMwHad`), 4x ao dia (9h47, 13h47, 17h47, 21h47). Segue `../EVOLUCAO.md`; registro em `../EVOLUCAO-LOG.md`.
- Refinamentos silenciosos sempre; no máximo 1 recurso novo por semana, anunciado em `app/novidade` (titulo, texto, aba, data, semana, chave). A página mostra o cartão "Novidade da semana" até a Carla clicar em "Entendi" (guardado por `chave`).

## Instagram pelo vidIQ (botão "Atualizar Instagram")
- Rotina "Atualizar Instagram do Content Lab" (id `trig_013cy9D6MRXUtjTWdWLd4Abn`), sem horário: roda só quando o botão "Atualizar Instagram" (abas Referências e Concorrentes) é clicado (fire_trigger). Segue `../importador/ROTINA.md`.
- Conector vidIQ, plano grátis: 150 créditos por mês, 5 por consulta de Reels. O comando `planejar` reparte o saldo pelos dias até a renovação; o crédito diário acumula desde o último uso e cada clique gasta só o acumulado (até 3 consultas), apenas com perfis que venceram (intervalo = 7 ÷ Reels por semana, entre 3 e 14 dias; 30 se parado).
- Controle no banco: `importador/vidiq` (perfis, ultimoUso, ultimoPlano). A página mostra a última atualização, o saldo e a próxima atualização útil.
- Instagram da Mycapital: @mycapitaloficial (em `brands/mycapital`, `channels.instagram.handle`).
- Cada consulta do @mycapitaloficial também atualiza o Calendário (Reels publicados, id `ig-<código>`) e as Métricas (Reels por mês, id `ig-reels-AAAA-MM`, só meses inteiros).

## Importador de posts (`../importador/`)
- `importar_posts.py`: Instagram (Business Discovery) e YouTube Data API, melhores posts de 14 dias, capas baixadas, sem repetir links.
- A gravação é feita pela rotina (ver `../importador/ROTINA.md`): assets pelo `Artifact` e documentos pelo `ArtifactData` em lotes de 50.

## Bússola de conteúdo (aba Referências)
- Documento `brands/{marca}/insights/bussola` (funciona, evitar, agora, base, atualizadoEm). Mostrado no topo de Referências; o botão "Atualizar Bússola" usa o `sample` (Claude da página) sobre as referências do mercado, os posts publicados e o Google Trends. Não usa vidIQ nem conteúdo de concorrentes. **A Bússola acompanha as Referências:** o documento guarda `nRefs`; se uma referência for criada, editada ou apagada depois de `atualizadoEm` (ou o total mudar), a página refaz a Bússola sozinha ao abrir a aba. Rotinas que gravam referências (radar) reescrevem a Bússola no mesmo passo, com `nRefs`.
- Referências "viral no nicho": visualizações >= 2x a mediana do perfil (últimos 180 dias) e semelhança de tema com a marca (TEMAS_BASE + pilares). Muitas visualizações com menos de 0,5% de curtidas recebem "alcance possivelmente pago" e vão para o fim da lista.
- Aba Explorar do Instagram não tem acesso automático permitido: o caminho é print em Nova referência + "Preencher com o Claude".

## Otimizações do app
- As 8 coleções do banco chegam juntas: o desenho é agrupado em um quadro (`scheduleRender`) e o DOM só é trocado se o HTML mudou. Vídeos não reiniciam e a rolagem não pula a cada atualização.
- Aba Marca: botão "Baixar backup" gera um JSON com a marca e todas as coleções.

## Próximos passos combinados
- Concluir a conexão do Supermetrics e ligar a aba Métricas aos dados reais.
- Se o Metricool for conectado, adicionar o botão "Agendar" no calendário.
- vidIQ conectado (Instagram). YouTube pelo vidIQ custa créditos; preferir a YouTube Data API gratuita.
