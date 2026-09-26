# Rotina diária: Instagram do Content Lab (vidIQ, plano grátis)

Roda 1 vez por dia. Usa o conector **vidIQ** e gasta no máximo 1 consulta (5 créditos) por dia, só quando algum perfil "vence". O plano grátis tem 150 créditos por mês.

Content Lab: `https://claude.ai/artifact/JWoCf2AYGr2K39nSmCzm9R`
Pasta de trabalho: `importador/` do repositório `carlasampaiox/carlasampaiox`, branch `claude/wonderful-faraday-h9fhtc`.

## Como economiza
- Cada perfil tem um intervalo conforme o ritmo de postagem: 3 dias (3 ou mais Reels por semana), 7 dias (1 a 3), 14 dias (menos de 1) e 30 dias (parado há mais de 90 dias). Perfil novo é consultado primeiro.
- `planejar` compara a demanda do mês com o saldo até a renovação: sobrando crédito, encurta os intervalos (até a metade); faltando, estica. Guarda sempre 15 créditos de reserva para o botão "Importar posts agora".
- Consultas grátis (0 crédito): `vidiq_balance`. Nunca use `vidiq_ig_profile` (5 créditos) na rotina: seguidores vêm arredondados e não compensam.
- YouTube pelo vidIQ custa 5 créditos por canal, então fica de fora. Com `YOUTUBE_API_KEY` (grátis, do Google) no ambiente, o script lê os canais sem gastar créditos.

## Passos

1. **Preparar.** Garanta o repositório na branch acima (`git fetch origin claude/wonderful-faraday-h9fhtc && git checkout claude/wonderful-faraday-h9fhtc`). Trabalhe em `importador/`.
2. **Saldo.** `vidiq_balance` (grátis). Anote `totalCredits` e `renewableResetsAt`.
3. **Estado.** Com `ArtifactData`, `out_dir` = `importador/saida/dump`: `list brands`, e para cada marca `list brands/{id}/competitors`, `list brands/{id}/compnews`, `list brands/{id}/refs` (limit 1000). Depois `get importador/vidiq` e salve o campo de dados como `importador/saida/controle.json` (o documento inteiro, sem id nem version).
   `python3 importar_posts.py montar-estado --dump saida/dump --saida saida/estado.json`
4. **Plano.** `python3 importar_posts.py planejar --estado saida/estado.json --controle saida/controle.json --saldo <totalCredits> --renova <renewableResetsAt>`
   Se `consultar` vier vazio, pare aqui e responda só com o `motivo`. Não gaste créditos.
   Em PEDIDO AVULSO (botão "Importar posts agora"), rode o plano com `--max-por-dia 1 --reserva 0` e, se a fila estiver vazia, consulte o perfil de concorrente com `ultimaConsulta` mais antiga.
5. **Consultar.** Para cada `handle` de `consultar`: `vidiq_ig_profile_reels` com esse handle. Salve a resposta inteira em `saida/vidiq/ig-<handle>.md`, copiando o texto tal como veio e, no fim, para cada Reel, as linhas `Reel <código> — <plays> plays` e `[Image: source: <caminho do arquivo da capa>]` que a ferramenta devolveu.
6. **Pacote.** `python3 importar_posts.py buscar --estado saida/estado.json --vidiq saida/vidiq --controle saida/controle.json`
7. **Capas.** Envie os arquivos de `arquivos` do `pacote.json` (pasta `midia/`) com `Artifact` (`action: "publish"`, `url` do Content Lab, `asset: true`, `file_paths`). Monte `ids.json` com `{"arquivo.jpg": "id"}`.
8. **Referências.** Para cada item de `refs` no pacote, escreva `why` (1 a 2 frases: por que o post funcionou, olhando capa, gancho, duração e números reais). Não invente números.
9. **Gravar.** `python3 importar_posts.py montar-lote --pacote <pasta>/pacote.json --ids <pasta>/ids.json`, preencha os `why` nos `refs` de cada `lote-NN.json` e grave cada arquivo com `ArtifactData` `action: "batch"`. Depois grave `saida/controle.json` em `importador/vidiq` (`action: "set"`, `file_path`).
10. **Resumo.** Uma linha por perfil consultado: posts novos, destaques e avisos (ex.: perfil parado). Informe o saldo restante.

Regras: português do Brasil, sem travessão, números só os que a ferramenta entregou, nunca gravar chaves no Content Lab.
