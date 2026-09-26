# Primeiro pedido para o Claude Code

Abra o Claude Code nesta pasta e cole o texto abaixo.

---

Leia o CLAUDE.md. Quero um script que importe posts dos concorrentes e das minhas marcas para o Content Lab, com prévia.

O que o script deve fazer:
1. Ler do banco do Content Lab as marcas (`brands`) e os concorrentes de cada marca (`brands/{marca}/competitors`), com os perfis de Instagram e YouTube cadastrados.
2. Instagram: usar a Graph API da Meta, função Business Discovery, a partir da conta comercial da marca, para buscar os posts recentes de cada concorrente (legenda, tipo, data, curtidas, comentários, link e imagem ou capa do vídeo).
3. YouTube: usar a YouTube Data API para buscar os vídeos recentes de cada canal (título, data, visualizações, link e miniatura).
4. Escolher os posts de melhor desempenho de cada perfil nos últimos 14 dias.
5. Baixar a imagem ou capa de cada post escolhido e enviar para os assets do artifact.
6. Salvar cada post:
   - em `brands/{marca}/compnews` com `kind: "conteudo"`, channel, format, title (gancho ou título), url, date, signal (números reais, sem estimar), summary;
   - os de Instagram com melhor desempenho também em `brands/{marca}/refs`, com `media` e `mediaType`.
7. Não repetir posts já salvos (comparar pelo link).

Antes de escrever o código, me explique em passos simples o que eu preciso configurar (app na Meta, conta comercial ligada a uma página do Facebook, chave do YouTube) e onde guardar as chaves com segurança, fora do Content Lab.

Depois, me mostre como rodar o script e como deixar ele rodando todo dia de segunda a sexta de manhã.

Regras: responda sempre em português do Brasil e não use travessão.
