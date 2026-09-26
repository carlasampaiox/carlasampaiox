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
- `build.py`: junta tudo em `index.html`. Rode `python3 build.py` depois de editar.
- `index.html`: arquivo final que é publicado no artifact.
- `PEDIDO-CLAUDE-CODE.md`: o primeiro pedido para o Claude Code (importar posts com prévia).

## Como publicar uma alteração
1. Editar `app.js`, `app.css` ou `shell.html`.
2. Rodar `python3 build.py`.
3. Publicar `index.html` no artifact acima, passando a `url` acima para atualizar o mesmo link.
4. Manter as capacidades: `db`, `sample`, `assets` e `mcp` com `Claude Code Remote` / `fire_trigger`.

## Abas (nesta ordem)
Notícias, Referências, Calendário, Datas importantes, Marca, Mapa de ideias, Métricas, Concorrentes.

## Banco (capability `db` do artifact)
- `brands/{marca}`: configurações da marca (nome, nicho, público, tom, pilares, canais, fontes, briefing).
- `brands/{marca}/news`: notícias do nicho (title, url, source, date, tag, summary).
- `brands/{marca}/refs`: referências virais. Campos: platform (instagram, tiktok), format, url, creator, views, hook, why, tags, media (id de asset de 32 caracteres), mediaType (image ou video).
- `brands/{marca}/posts`: calendário (title, date, time, channel, format, status, pillar, caption, link, notes).
- `brands/{marca}/dates`: datas importantes (title, date, recurring, type, lead = dias de antecedência, notes).
- `brands/{marca}/ideas`: mapa de ideias (title, pillar, channels, format, status, source, notes).
- `brands/{marca}/metrics`: registros por período (channel, start, end, followers, reach, engagement, clicks, posts). Registros antigos podem ter só `month`.
- `brands/{marca}/competitors`: campos da usuária (name, site, blog, instagram, linkedin, youtube, tiktok, positioning, strengths, weaknesses, frequency, notes) e campos automáticos (autoSummary, autoChannels, autoContent, autoCheckedAt, research).
- `brands/{marca}/compnews`: conteúdos (`kind: "conteudo"`, com channel, format, signal) e notícias (`kind: "noticia"`, com source) dos concorrentes.

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

## Próximos passos combinados
- Importar posts com prévia para Referências e Concorrentes (ver `PEDIDO-CLAUDE-CODE.md`).
- Concluir a conexão do Supermetrics e ligar a aba Métricas aos dados reais.
- Se o Metricool for conectado, adicionar o botão "Agendar" no calendário.
- Se o vidIQ for conectado, usar os números reais de YouTube, Instagram e TikTok.
