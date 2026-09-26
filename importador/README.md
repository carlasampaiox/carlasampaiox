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

1. **Conta comercial.** No app do Instagram da marca: Configurações, Tipo de conta e ferramentas, Mudar para conta profissional, escolha **Empresa**.
2. **Página do Facebook ligada.** No Instagram: Editar perfil, Página, conecte uma página do Facebook da marca (crie uma se não existir). Business Discovery só funciona com essa ligação.
3. **App na Meta.** Em developers.facebook.com, Meus apps, Criar app, tipo **Empresa**. Adicione o produto **Instagram Graph API** (ou "Instagram" com login do Facebook).
4. **Permissões.** No Explorador da Graph API, selecione o seu app e peça: `instagram_basic`, `pages_show_list`, `pages_read_engagement` e `business_management`. Clique em Gerar token e autorize com a conta que administra a página.
5. **Token de longa duração (60 dias).** Troque o token curto por um longo:
   `GET https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=TOKEN_CURTO`
   Melhor ainda: crie um **usuário do sistema** no Gerenciador de Negócios e gere um token que não vence.
6. **ID da conta do Instagram.** No Explorador: `me/accounts?fields=name,instagram_business_account`. O número em `instagram_business_account.id` é o `IG_USER_ID`.

Os concorrentes precisam ser contas profissionais (empresa ou criador). Contas pessoais não aparecem no Business Discovery; o script avisa e segue.

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
| `META_GRAPH_VERSION` | opcional, padrão `v21.0` |

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
