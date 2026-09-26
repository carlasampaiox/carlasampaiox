# Etapa da rotina: importar posts com prévia

Texto para acrescentar ao prompt da tarefa agendada "Notícias do Content Lab" (`trig_01AM7vMvx9QEQ2wfVjsVCMuz`). Ele roda depois das etapas de notícias e concorrentes. Quando o pedido for "PEDIDO AVULSO: faça apenas a etapa de importação de posts", rode só esta etapa, só para a marca indicada.

Content Lab: `https://claude.ai/artifact/JWoCf2AYGr2K39nSmCzm9R`

---

**ETAPA 3. IMPORTAR POSTS COM PRÉVIA**

0. **Preferir conectores.** Se houver um conector MCP do Instagram, da Meta, do YouTube, do Supermetrics ou do Metricool conectado nesta sessão e ele trouxer posts de outros perfis com números e imagem, use-o no lugar do passo 2 e monte o `pacote.json` no mesmo formato. Se não houver, siga o script.
1. **Estado.** Com `ArtifactData`, leia usando `out_dir` = `importador/saida/dump`:
   `list brands`; para cada marca (ou só a do pedido avulso): `list brands/{id}/competitors`, `list brands/{id}/compnews`, `list brands/{id}/refs` (pagine com `next_cursor` até o fim).
   Depois: `python3 importador/importar_posts.py montar-estado --dump importador/saida/dump --saida importador/saida/estado.json`
2. **Buscar.** `python3 importador/importar_posts.py buscar --estado importador/saida/estado.json`
   Se faltarem as variáveis `META_ACCESS_TOKEN`, `IG_USER_ID` ou `YOUTUBE_API_KEY`, ou se a rede bloquear as APIs, pare esta etapa e registre o aviso no resumo final. Não invente posts.
3. **Imagens.** Para os arquivos listados em `arquivos` do `pacote.json` (pasta `midia/` ao lado), envie com a ferramenta `Artifact`: `action: "publish"`, `url` = Content Lab, `asset: true`, `file_paths` = até 25 arquivos por chamada. Monte `ids.json` no formato `{"nome-do-arquivo.jpg": "id_de_32_caracteres"}` a partir do resultado. Arquivo que falhar fica fora do mapa (o post é gravado sem prévia).
4. **Lotes.** `python3 importador/importar_posts.py montar-lote --pacote <pasta>/pacote.json --ids <pasta>/ids.json`
5. **Gravar.** Para cada `lote-NN.json`: `ArtifactData` `action: "batch"`, `url` = Content Lab, `writes` = conteúdo do arquivo (até 50 escritas). Os ids dos documentos começam com `imp-` e são estáveis, então repetir a etapa não duplica.
6. **Resumo.** Informe quantos posts entraram por marca e por concorrente, quantos com prévia e os avisos do script.

Regras: português do Brasil, sem travessão, números só os da API, nunca gravar chaves no artifact.
