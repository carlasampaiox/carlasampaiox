# Importador de posts com prévia

Traz para o Content Lab os posts de melhor desempenho dos concorrentes (e, se você quiser, das suas marcas), com imagem ou capa, números reais e link.

- **Instagram:** Graph API da Meta, função Business Discovery (lê perfis profissionais de outras contas a partir da sua conta comercial).
- **YouTube:** YouTube Data API v3.
- Escolhe os melhores dos últimos 14 dias de cada perfil, baixa a capa e prepara tudo para gravar em `brands/{marca}/compnews` (`kind: "conteudo"`) e, os melhores do Instagram, também em `brands/{marca}/refs`.
- Não repete posts: compara pelo link (ignora `www`, parâmetros e diferença entre `/reel/` e `/p/`), antes e depois de escolher.
- Números só da API, nunca estimados. Textos sem travessão.
- Só biblioteca padrão do Python. Não precisa instalar nada.

## Por que o script não grava direto no Content Lab

O banco e os arquivos do Content Lab só aceitam escrita pelo Claude (ferramentas `ArtifactData` e `Artifact`). Por isso o trabalho fica dividido:

1. **O script** conversa com a Meta e o YouTube (onde estão as chaves) e gera um pacote com os posts e as imagens.
2. **A rotina do Claude** envia as imagens para os assets do artifact e grava os documentos no banco.

Assim nenhuma chave de API passa pelo Content Lab.

## Passo 1. O que configurar (uma vez só)

### Instagram (Meta)

**Caminho escolhido:** Graph API oficial da Meta com **login do Facebook**. É gratuita e é o único caminho oficial que lê posts de outros perfis (Business Discovery). O login só pelo Instagram, mais novo, não tem Business Discovery.

**Sem revisão da Meta:** como o app só vai ler contas que você administra, o acesso padrão (Standard Access) basta. Não precisa de App Review, verificação da empresa nem vídeo de demonstração. Deixe o app em modo de desenvolvimento, com você como administradora.

1. **Conta profissional.** No app do Instagram da marca: Configurações, Tipo de conta e ferramentas, Mudar para conta profissional (Empresa ou Criador).
2. **Página do Facebook ligada.** No Instagram: Editar perfil, Página, conecte uma página do Facebook da marca (crie uma se não existir). Sem essa ligação o Business Discovery não funciona.
3. **Portfólio empresarial.** Em business.facebook.com, confira se a página e a conta do Instagram estão no portfólio da marca.
4. **App na Meta.** Em developers.facebook.com, Meus apps, Criar app, caso de uso de **Instagram com login do Facebook** (tipo Empresa). Vincule o app ao portfólio.
5. **Token que não vence (recomendado).** No Gerenciador de Negócios: Configurações, Usuários do sistema, Adicionar (função Administrador). Atribua a ele a página, a conta do Instagram e o app. Clique em Gerar token, escolha o app e marque: `instagram_basic`, `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement` e `business_management`. Esse token não expira.
   Alternativa rápida: no Explorador da Graph API, gere um token com as mesmas permissões e troque por um de 60 dias:
   `GET https://graph.facebook.com/v25.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=TOKEN_CURTO`
6. **ID da conta do Instagram.** No Explorador: `me/accounts?fields=name,instagram_business_account`. O número em `instagram_business_account.id` é o `IG_USER_ID`.
7. **Teste.** No Explorador, com o token: `IG_USER_ID?fields=business_discovery.username(nomedoconcorrente){followers_count,media_count}`. Se voltar número de seguidores, está pronto.

**Limites que valem saber**
- Os concorrentes precisam ser contas profissionais (Empresa ou Criador). Contas pessoais não aparecem; o script avisa e segue.
- Se o concorrente esconde as curtidas, o número não vem. O script mostra só o que a API entregou.
- Visualizações só vêm em Reels. Em Reels a prévia é o próprio vídeo (até 20 MB), porque o Business Discovery não entrega a capa.
- Cerca de 200 chamadas por hora por token. A importação usa 1 chamada por concorrente.
- Stories, seguidores de terceiros e busca por hashtag de outros perfis não estão disponíveis na API oficial.

### YouTube

1. Em console.cloud.google.com, crie um projeto.
2. APIs e serviços, Biblioteca, ative **YouTube Data API v3**.
3. Credenciais, Criar credenciais, **Chave de API**. Restrinja a chave à YouTube Data API v3.
4. Cota: a importação gasta cerca de 3 unidades por canal. A cota grátis é de 10.000 por dia.

## Passo 2. Onde guardar as chaves com segurança

**Nunca** cole chaves no Content Lab, no banco dele, em commits ou no chat.

- **No seu computador:** copie `.env.exemplo` para `.env` nesta pasta e preencha. O `.env` já está no `.gitignore`.
- **Na nuvem (rotina do Claude):** no Claude Code na web, abra o menu do ambiente na barra de título da sessão, Editar, e cadastre como variáveis de ambiente (ou em "API credentials", se aparecer):
  `META_ACCESS_TOKEN`, `IG_USER_ID`, `YOUTUBE_API_KEY` (e `IG_USER_ID_<MARCA>` se tiver mais de uma conta).
  Na mesma tela, em **Network access**, libere: `graph.facebook.com`, `www.googleapis.com`, `*.cdninstagram.com`, `*.fbcdn.net` e `i.ytimg.com`. Sem isso a rede bloqueia as APIs.

Variáveis aceitas:

| Variável | Para que serve |
| --- | --- |
| `META_ACCESS_TOKEN` | token da Graph API |
| `IG_USER_ID` | id da conta comercial usada para o Business Discovery |
| `IG_USER_ID_<MARCA>` | id próprio por marca (ex.: `IG_USER_ID_MYCAPITAL`), tem prioridade |
| `YOUTUBE_API_KEY` | chave da YouTube Data API |
| `META_GRAPH_VERSION` | opcional, padrão `v25.0` |

## Passo 3. Como rodar

Teste sem internet e sem chaves (dados fictícios):

```bash
python3 importar_posts.py simular
```

Execução real:

```bash
# 0. estado.json: marcas, concorrentes e links já salvos (a rotina gera a partir do banco)
python3 importar_posts.py montar-estado --dump /caminho/do/dump --saida estado.json
# 1. consulta as APIs e baixa as capas
python3 importar_posts.py buscar --estado estado.json            # opções: --dias 14 --por-perfil 3 --incluir-marca
# 2. depois de subir as imagens, gera os lotes de escrita
python3 importar_posts.py montar-lote --pacote saida/AAAA-MM-DD/pacote.json --ids ids.json
```

Os avisos (perfil pessoal, token vencido, cota esgotada) aparecem no fim, com a dica de como resolver. Um perfil com problema não interrompe os outros.

## Passo 4. Rodar todo dia útil de manhã

A rotina "Notícias do Content Lab" (segunda a sexta, 7h54) já existe. Acrescente a ela a etapa descrita em [`ROTINA.md`](ROTINA.md). O botão **Importar posts agora**, na aba Concorrentes, dispara só essa etapa na hora.

Para rodar no seu computador em vez da nuvem, use o cron (Mac/Linux) só para a parte `buscar`; a gravação continua sendo feita pelo Claude:

```
50 7 * * 1-5 cd /caminho/importador && python3 importar_posts.py buscar --estado estado.json >> importador.log 2>&1
```

## Testes

```bash
python3 -m unittest -v
```
