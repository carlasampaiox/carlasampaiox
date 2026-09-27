# Rotina "Atualizar Instagram" do Content Lab (vidIQ, plano grátis)

Roda **só quando alguém clica em "Atualizar Instagram"** (aba Concorrentes). Usa o conector **vidIQ**, plano grátis: 150 créditos por mês, 5 por consulta de Reels. O saldo precisa durar até a renovação.

Content Lab: `https://claude.ai/artifact/JWoCf2AYGr2K39nSmCzm9R`
Pasta de trabalho: `importador/` do repositório `carlasampaiox/carlasampaiox`, branch `claude/wonderful-faraday-h9fhtc`.

## O que cada consulta alimenta
- **Concorrentes:** Reels dos últimos 14 dias, com capa e números reais.
- **Referências:** o Reel fora da curva de cada perfil (2 vezes a mediana, últimos 90 dias) ou o melhor recente, com "por que funcionou".
- **Referências, radar de oportunidades (1 vez por semana, 5 créditos):** o que está em alta no Instagram em geral, de qualquer perfil (contadores, trends do mercado, memes), filtrado pelo fit com a aba Marca.
- **Calendário e Métricas:** só quando o perfil é o da própria marca (@mycapitaloficial).

## Como economiza
- **Radar semanal:** entra no plano no máximo 1 vez a cada 7 dias e ocupa 1 das 3 consultas do clique, sempre dentro do crédito liberado.
- **Crédito repartido pelos dias:** saldo ÷ dias até a renovação = créditos por dia. Esse valor acumula desde o último uso, e cada clique só gasta o acumulado (no máximo 3 consultas). Clicar várias vezes no mesmo dia não gasta mais.
- **Só perfis que venceram:** cada perfil tem um intervalo conforme o ritmo de postagem: 7 ÷ Reels por semana, entre 3 e 14 dias (ex.: 2,5 por semana = 3 dias; 1 por semana = 7), e 30 dias se estiver parado há mais de 90 dias. Perfil novo vem primeiro. Se nada venceu, não gasta.
- Consultas grátis (0 crédito): `vidiq_balance`. Nunca use `vidiq_ig_profile` (5 créditos) na rotina: seguidores vêm arredondados e não compensam.
- YouTube pelo vidIQ custa 5 créditos por canal, então fica de fora. Com `YOUTUBE_API_KEY` (grátis, do Google) no ambiente, o script lê os canais sem gastar créditos.

## Passos

1. **Preparar.** Garanta o repositório na branch acima (`git fetch origin claude/wonderful-faraday-h9fhtc && git checkout claude/wonderful-faraday-h9fhtc`). Trabalhe em `importador/`.
2. **Saldo.** `vidiq_balance` (grátis). Anote `totalCredits` e `renewableResetsAt`.
3. **Estado.** Com `ArtifactData`, `out_dir` = `importador/saida/dump`: `list brands`, e para cada marca `list brands/{id}/competitors`, `list brands/{id}/compnews`, `list brands/{id}/refs` e `list brands/{id}/posts` (limit 1000). Depois `get importador/vidiq` e salve o campo de dados como `importador/saida/controle.json` (o documento inteiro, sem id nem version).
   `python3 importar_posts.py montar-estado --dump saida/dump --saida saida/estado.json`
4. **Plano.** `python3 importar_posts.py planejar --estado saida/estado.json --controle saida/controle.json --saldo <totalCredits> --renova <renewableResetsAt>`
   O comando já grava em `saida/controle.json` o resultado (`ultimoPlano`, que a página mostra ao lado do botão).
   Se `consultar` vier vazio e `radar` vier nulo: grave `saida/controle.json` em `importador/vidiq` (`ArtifactData`, `action: "set"`, `file_path`) e encerre com o `motivo`. Não gaste créditos.
5. **Consultar.** Para cada `handle` de `consultar`: `vidiq_ig_profile_reels` com esse handle. Salve a resposta inteira em `saida/vidiq/ig-<handle>.md`, copiando o texto tal como veio e, no fim, para cada Reel, as linhas `Reel <código> — <plays> plays` e `[Image: source: <caminho do arquivo da capa>]` que a ferramenta devolveu.
5b. **Radar de oportunidades (só se o plano trouxer `radar`).** Chame `vidiq_instagram_tiktok_outlier_search` com os parâmetros de `radar` tal como vieram (1 chamada, 5 créditos). Use só a parte do Instagram; ignore o TikTok. Leia a marca (`get brands/{id}`: nicho, pilares, público, tom, "evitar") e avalie cada Reel como estrategista:
   - **Entra** se a Mycapital consegue participar com autoridade: IR e impostos de investimentos, declaração, DARF, dividendos e proventos, investimento no exterior, organização da carteira, metas financeiras, trend ou meme do mercado que dá para ligar a um desses temas, rotina e performance (público de endurance).
   - **Fica fora:** política partidária, consórcio, promessa de rentabilidade, golpe ou "fique rico", conteúdo que só funciona pela pessoa famosa, qualquer coisa que bata com "evitar".
   - Grave no máximo 8, os de melhor fit, em `brands/{id}/refs` (`ArtifactData` `batch`, id `radar-<código do reel>`), sem repetir links que já existem: `{"platform": "instagram", "format": "Reels · <formato>", "url": "https://www.instagram.com/reel/<código>/", "creator": "@perfil", "views": "<visualizações> visualizações, <N>x a mediana do perfil", "hook": "<gancho>", "why": "<por que funcionou, 1 a 2 frases>", "fit": "<pilar da marca e como a Mycapital entra, com um gancho adaptado>", "tags": "oportunidade, fit alto, <tema>", "origem": "radar", "createdAt": "<agora ISO>", "updatedAt": "<agora ISO>"}`. Use `trend` nas tags quando for assunto do momento e `meme` quando for meme. Números só os que a ferramenta devolveu.
   - A busca não traz capa; o card fica sem imagem e o botão "Abrir" leva ao Reel.
6. **Pacote.** `python3 importar_posts.py buscar --estado saida/estado.json --vidiq saida/vidiq --controle saida/controle.json`
7. **Capas.** Envie os arquivos de `arquivos` do `pacote.json` (pasta `midia/`) com `Artifact` (`action: "publish"`, `url` do Content Lab, `asset: true`, `file_paths`). Monte `ids.json` com `{"arquivo.jpg": "id"}`.
8. **Referências.** Para cada item de `refs` no pacote, escreva `why` (1 a 2 frases: por que o post funcionou, olhando capa, gancho, duração e números reais). Não invente números.
9. **Gravar.** O pacote também traz, quando o perfil consultado é o da própria marca, os Reels novos para o **Calendário** (`posts`, status publicado, id `ig-<código>`) e o total de Reels e visualizações por mês para as **Métricas** (`metrics`, id `ig-reels-AAAA-MM`, só meses inteiros cobertos pela consulta). Esses itens não têm imagem.
    `python3 importar_posts.py montar-lote --pacote <pasta>/pacote.json --ids <pasta>/ids.json`, preencha os `why` nos `refs` de cada `lote-NN.json` e grave cada arquivo com `ArtifactData` `action: "batch"`. Depois grave `saida/controle.json` em `importador/vidiq` (`action: "set"`, `file_path`).
10. **Resumo.** Uma linha por perfil consultado: posts novos, destaques e avisos (ex.: perfil parado). Se o radar rodou: quantas oportunidades entraram e as 2 melhores. Informe o saldo restante.

Regras: português do Brasil, sem travessão, números só os que a ferramenta entregou, nunca gravar chaves no Content Lab.
