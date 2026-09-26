# Rotina automática: Coleta gratuita do Content Lab

Roda **todo dia às 7h13** (Brasília), depois do GitHub Actions (6h10). **Não usa conector nem créditos.**
Importa para o Content Lab o que o coletor gratuito (`importador/coletor.py`) guardou em `dados/coleta.json`:
- **Notícias:** Google Notícias do nicho e menções à Mycapital.
- **Concorrentes:** vídeos novos do YouTube (com capa, visualizações e curtidas do RSS oficial), posts de blog e notícias sobre cada concorrente.

Content Lab: `https://claude.ai/artifact/JWoCf2AYGr2K39nSmCzm9R`

## Passos
1. **Preparar.** Repositório público `carlasampaiox/carlasampaiox`, branch `claude/wonderful-faraday-h9fhtc`, atualizado (`git pull`). Trabalhe em `importador/`.
2. **Coleta nova?** Leia `../dados/coleta.json`. Se `geradoEm` não for de hoje, avise no resumo que o GitHub Actions não rodou e siga com o que houver.
3. **Estado.** Com `ArtifactData`, `out_dir` = `saida/dump`: `list brands` e, para cada marca, `list` de `competitors`, `compnews`, `refs`, `posts` e `news` (limit 1000). Depois `python3 importar_posts.py montar-estado --dump saida/dump --saida saida/estado.json`.
4. **Filtrar.** `python3 importar_posts.py coleta --estado saida/estado.json`. Se não houver itens novos, encerre dizendo isso.
5. **Capas.** Envie os arquivos de `arquivos` (pasta `midia/` do pacote) com `Artifact` (`action: "publish"`, `url` do Content Lab, `asset: true`, `file_paths`, até 25 por chamada) e monte `ids.json` (`{"arquivo.jpg": "id"}`).
6. **Curadoria.** Tire do pacote notícias que repetem o mesmo fato de outra (fique com a fonte mais conhecida) e as que não interessam ao público da marca (investidor pessoa física de alta renda, IR e carteira). **Resumo das notícias:** Para cada item de `news` sem `summary`, escreva 1 frase sobre por que importa para o público da marca, usando o título, a fonte e o `contexto` (primeiras frases da matéria, quando houver). Não invente fatos além disso. Pode deixar vazio se o título não permitir.
7. **Gravar.** `python3 importar_posts.py montar-lote --pacote <pasta>/pacote.json --ids <pasta>/ids.json` e grave cada `lote-NN.json` com `ArtifactData` `action: "batch"`. Dica para economizar: salve o `data` de cada escrita num arquivo e passe `file_path` na entrada do batch, em vez de repetir o conteúdo.
8. **Tendências.** Se existir `../dados/tendencias.json` de hoje, grave-o inteiro em `brands/{marca}/insights/tendencias` (`ArtifactData` `set`, `file_path`). A Bússola mostra "Em alta no Google".
9. **Resumo.** Quantos itens por aba e os avisos do coletor.

Regras: português do Brasil, sem travessão, números só os das fontes, nunca gravar chaves no Content Lab. Nunca chame ferramentas do vidIQ nesta rotina.
