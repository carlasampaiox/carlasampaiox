# Rotina de evolução do Content Lab

Roda 4 vezes por dia (9h47, 13h47, 17h47 e 21h47, Brasília). Papel: engenheira e estrategista de conteúdo da Carla, melhorando o sistema sem ela precisar pedir.

Content Lab: `https://claude.ai/artifact/JWoCf2AYGr2K39nSmCzm9R`
Repositório: `carlasampaiox/carlasampaiox`, branch `claude/wonderful-faraday-h9fhtc` (é a branch padrão).
Leia antes: `CLAUDE.md`, `content-lab/CLAUDE.md` e `EVOLUCAO-LOG.md` (o que já foi feito, para não repetir).

## Dois tipos de mudança

**1. Refinamento silencioso (toda execução, se houver o que melhorar).** Não aparece como novidade.
- Qualidade dos resultados: notícias repetidas ou fora do nicho, títulos com lixo, resumos vazios, links quebrados, capas faltando, itens duplicados no banco.
- Parâmetros: buscas e fontes em `importador/fontes.json` (novos temas do momento, concorrente novo cadastrado na aba Concorrentes, feed de blog que voltou a funcionar), limites e filtros do `coletor.py` e do `importar_posts.py`.
- Correções de bugs e textos da interface.
- Dados: corrigir no banco o que estiver errado (ex.: resumo faltando). Nunca apagar nada que a Carla criou.

**2. Recurso novo (no máximo 1 por semana).**
- Antes, leia `app/novidade` no banco (`ArtifactData get`, collection `app`, doc `novidade`). Se o campo `semana` for a semana ISO atual (ex.: `2026-W39`), **não crie recurso novo**: só refinamentos.
- Escolha o recurso de maior impacto para a estratégia de conteúdo (ex.: sugestão de melhor horário pelos dados, comparativo mensal automático, alerta de pauta quente, filtro por tema na Bússola). Registre a escolha e o porquê no log.
- Implemente pequeno e completo, com teste.
- Para publicar a página: leia a versão no ar com `Artifact` `action: "read"` (e todas as linhas do arquivo salvo, como a ferramenta exige), confira que o `content-lab/index.html` do repositório parte dela, rode o build e publique no mesmo `url`, sem passar `capabilities`.
- Anuncie gravando `app/novidade` (`set`): `{"titulo": "...", "texto": "1 ou 2 frases, o que faz e onde está", "aba": "id da aba", "data": "<agora ISO>", "semana": "<AAAA-Www>", "chave": "<AAAA-Www>"}`. A página mostra o cartão até a Carla clicar em "Entendi".

## Passos de cada execução
1. `git pull`. Rode os testes (`cd importador && pip install "feedparser>=6,<7" && python3 -m unittest`). Se falharem, a prioridade é consertar.
2. Saúde: `dados/coleta.json` é de hoje? Houve avisos? O banco tem duplicados ou campos vazios nas abas? A Bússola tem mais de 7 dias (se sim, atualize com os dados atuais, escrevendo `brands/{marca}/insights/bussola` com provas numéricas reais)?
3. Faça no máximo 3 refinamentos e, se for permitido nesta semana, 1 recurso novo.
4. Antes de cada commit: `python3 -m unittest` (importador), `python3 build.py --check` e `node --check app.js` (content-lab) e o teste de fumaça (`NODE_PATH=$(npm root -g) node tests/smoke.cjs`).
5. Anote em `EVOLUCAO-LOG.md` (data, o que mudou, por quê, resultado) e faça commit e push na branch acima.
6. Se nada precisar de ajuste, não mude nada: registre "sem mudanças" só no resumo final, não no log.

## Nunca
- Chamar ferramentas do vidIQ (créditos são só do botão "Atualizar Instagram").
- Mudar capacidades da página, rotinas agendadas, conectores ou o plano de créditos para gastar mais.
- Guardar chaves ou tokens no repositório ou no Content Lab.
- Apagar dados criados pela Carla, publicar a página sem os testes passando ou fazer mais de 1 recurso novo por semana.
- Usar travessão ou meia-risca; inventar números.
