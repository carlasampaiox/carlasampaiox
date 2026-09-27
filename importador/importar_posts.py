#!/usr/bin/env python3
"""Importador de posts com prévia para o Content Lab.

Busca os posts recentes dos concorrentes (e, se pedido, das próprias marcas)
no Instagram (Graph API da Meta, Business Discovery) e no YouTube (Data API v3),
escolhe os de melhor desempenho, baixa a imagem ou a capa de cada um e monta
um pacote pronto para ser gravado no banco do Content Lab.

O script não grava no banco sozinho: quem grava é a rotina do Claude, que
envia as imagens para os assets do artifact e escreve os documentos com a
ferramenta ArtifactData. Assim nenhuma chave de API chega ao Content Lab.

Fluxo (veja README.md):
  0. montar-estado  junta o dump do banco (ArtifactData com out_dir) em estado.json
  1. buscar      lê estado.json (marcas, concorrentes, links já salvos),
                 consulta as APIs e grava saida/<data>/pacote.json + midia/
  2. montar-lote recebe o mapa arquivo -> id de asset e gera lote-NN.json
                 (até 50 escritas cada), no formato `writes` do ArtifactData batch
  3. simular     roda o fluxo inteiro com dados fictícios, sem internet

Só usa a biblioteca padrão do Python 3.9+.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Callable, Iterable

AQUI = Path(__file__).resolve().parent
GRAPH_VERSAO_PADRAO = "v25.0"
LOTE_MAX = 50  # escritas por chamada batch do ArtifactData
MAX_BYTES = 20 * 1024 * 1024  # limite de assets do artifact
TIPOS_ACEITOS = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif"}

# ---------------------------------------------------------------- utilidades


def carregar_env(caminho: Path) -> None:
    """Lê um .env simples (CHAVE=valor) sem sobrescrever o ambiente."""
    if not caminho.is_file():
        return
    for linha in caminho.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        k, v = linha.split("=", 1)
        k, v = k.strip().removeprefix("export ").strip(), v.strip().strip('"').strip("'")
        os.environ.setdefault(k, v)


def limpar(texto: Any) -> str:
    """Aplica a regra da casa: sem travessão nem meia-risca como pontuação."""
    s = str(texto or "")
    s = re.sub(r"\s*—\s*", ", ", s)
    s = re.sub(r"\s–\s", ", ", s)
    return s.replace("—", ",").strip()


def gancho(legenda: str, limite: int = 140) -> str:
    """Primeira frase ou linha útil da legenda, cortada sem quebrar palavra."""
    for linha in str(legenda or "").splitlines():
        linha = linha.strip()
        if linha[:1] not in ("#", "@") and re.search(r"\w", linha):
            linha = limpar(linha)
            if len(linha) <= limite:
                return linha
            corte = linha[:limite].rsplit(" ", 1)[0].rstrip(",.;:")
            return corte + "..."
    return ""


def num_br(n: int | float | None) -> str:
    if n is None:
        return ""
    return f"{int(n):,}".replace(",", ".")


def normalizar_link(url: str) -> str:
    """Chave para comparar links: sem esquema, www, query, âncora e barra final."""
    u = str(url or "").strip()
    if not u:
        return ""
    try:
        p = urllib.parse.urlsplit(u if "://" in u else "https://" + u)
    except ValueError:
        return u.lower()
    host = p.netloc.lower().removeprefix("www.").removeprefix("m.")
    caminho = p.path.rstrip("/")
    if host in ("youtube.com", "youtu.be"):
        vid = ""
        if host == "youtu.be":
            vid = caminho.strip("/")
        elif caminho == "/watch":
            vid = urllib.parse.parse_qs(p.query).get("v", [""])[0]
        elif caminho.startswith("/shorts/"):
            vid = caminho.split("/")[2]
        if vid:
            return "youtube.com/watch?v=" + vid
    if host == "instagram.com":
        caminho = re.sub(r"^/(reels?|tv)/", "/p/", caminho)
    return host + caminho


def usuario_instagram(valor: str) -> str:
    s = str(valor or "").strip()
    if not s:
        return ""
    m = re.search(r"instagram\.com/([A-Za-z0-9._]+)", s)
    if m:
        s = m.group(1)
    s = s.lstrip("@").strip("/ ")
    return s if re.fullmatch(r"[A-Za-z0-9._]{1,30}", s) and s not in ("p", "reel", "reels", "explore") else ""


def canal_youtube(valor: str) -> dict[str, str]:
    """Aceita @handle, link de canal, /channel/UC..., /c/nome ou /user/nome."""
    s = str(valor or "").strip()
    if not s:
        return {}
    m = re.search(r"(UC[A-Za-z0-9_-]{22})", s)
    if m:
        return {"id": m.group(1)}
    m = re.search(r"youtube\.com/@([^/?#]+)", s) or re.fullmatch(r"@([^/?#\s]+)", s)
    if m:
        return {"handle": "@" + urllib.parse.unquote(m.group(1))}
    m = re.search(r"youtube\.com/user/([^/?#]+)", s)
    if m:
        return {"user": m.group(1)}
    m = re.search(r"youtube\.com/c/([^/?#]+)", s)
    if m:
        return {"handle": "@" + m.group(1)}
    if re.fullmatch(r"[A-Za-z0-9._-]{3,}", s):
        return {"handle": "@" + s}
    return {}


def duracao_segundos(iso8601: str) -> int:
    m = re.fullmatch(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", str(iso8601 or ""))
    if not m:
        return 0
    d, h, mi, s = (int(x or 0) for x in m.groups())
    return ((d * 24 + h) * 60 + mi) * 60 + s


def data_iso(ts: str) -> str:
    return str(ts or "")[:10]


def hoje() -> dt.date:
    return dt.datetime.now(dt.timezone(dt.timedelta(hours=-3))).date()  # Brasília


# ------------------------------------------------------------------- HTTP


class ErroAPI(Exception):
    def __init__(self, msg: str, status: int = 0, codigo: str = ""):
        super().__init__(msg)
        self.status, self.codigo = status, codigo


Buscador = Callable[[str], bytes]


def http_get(url: str, tentativas: int = 3, timeout: int = 30) -> bytes:
    """GET com nova tentativa em erros temporários (429, 5xx, rede)."""
    ultimo: Exception | None = None
    for i in range(tentativas):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "ContentLab-Importador/1.0"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read(MAX_BYTES + 1)
        except urllib.error.HTTPError as e:
            corpo = e.read().decode("utf-8", "replace")
            if e.code in (429, 500, 502, 503, 504) and i < tentativas - 1:
                time.sleep(2 ** (i + 1))
                ultimo = e
                continue
            raise ErroAPI(explicar_erro(corpo, e.code), e.code) from None
        except (urllib.error.URLError, TimeoutError) as e:
            ultimo = e
            if i < tentativas - 1:
                time.sleep(2 ** (i + 1))
    raise ErroAPI(f"sem conexão ({ultimo})")


def explicar_erro(corpo: str, status: int) -> str:
    try:
        err = json.loads(corpo).get("error", {})
    except (ValueError, AttributeError):
        return f"HTTP {status}"
    msg = err.get("message") or err.get("errors", [{}])[0].get("message") or f"HTTP {status}"
    code = err.get("code")
    dicas = {
        190: "token da Meta vencido ou inválido. Gere um token de longa duração novo.",
        10: "o app da Meta não tem a permissão instagram_basic ou instagram_manage_insights.",
        110: "perfil não encontrado ou não é conta profissional (Business Discovery só lê contas comerciais e de criador).",
        4: "limite de chamadas da Meta atingido. Tente mais tarde.",
        403: "chave do YouTube sem a YouTube Data API ativada ou cota diária esgotada.",
    }
    sub = err.get("error_subcode")
    dica = dicas.get(code) or (dicas[110] if sub == 2207013 else "")
    return f"{msg}{' Dica: ' + dica if dica else ''}"


def get_json(buscar: Buscador, url: str) -> dict:
    return json.loads(buscar(url).decode("utf-8"))


# ------------------------------------------------------------------ modelo


@dataclass
class Post:
    plataforma: str          # instagram | youtube
    perfil: str              # @usuario ou nome do canal
    url: str
    data: str                # AAAA-MM-DD
    formato: str
    titulo: str
    legenda: str = ""
    curtidas: int | None = None
    comentarios: int | None = None
    views: int | None = None
    imagem: str = ""         # URL da imagem ou capa
    seguidores: int | None = None
    arquivo_local: str = ""  # capa já baixada (conector vidIQ)
    duracao: int = 0         # segundos
    fixado: bool = False     # Reel fixado no topo do perfil
    vezes: float = 0.0       # visualizações / mediana do perfil
    semelhanca: int = 0      # proximidade do tema com a marca (palavras-chave)
    textos: dict = field(default_factory=dict)  # números como a fonte mostra ("6,2 mil")

    def pontuacao(self) -> float:
        """Desempenho comparável dentro do mesmo perfil."""
        if self.plataforma == "youtube":
            return float(self.views or 0) + 20 * (self.curtidas or 0) + 50 * (self.comentarios or 0)
        # Instagram: comentário vale mais que curtida; views de Reels entram quando existirem.
        return float(self.curtidas or 0) + 3 * (self.comentarios or 0) + 0.05 * (self.views or 0)

    def sinal(self) -> str:
        partes = []
        t = self.textos
        pl = lambda n, txt, um, varios: f"{txt or num_br(n)} {um if n == 1 and not txt else varios}"  # noqa: E731
        if self.views:
            partes.append(pl(self.views, t.get("views"), "visualização", "visualizações"))
        if self.curtidas is not None:
            partes.append(pl(self.curtidas, t.get("curtidas"), "curtida", "curtidas"))
        if self.comentarios is not None:
            partes.append(pl(self.comentarios, t.get("comentarios"), "comentário", "comentários"))
        if self.seguidores and self.plataforma == "instagram" and (self.curtidas or self.comentarios):
            taxa = 100 * ((self.curtidas or 0) + (self.comentarios or 0)) / self.seguidores
            partes.append(f"{taxa:.1f}% de engajamento sobre {num_br(self.seguidores)} seguidores".replace(".", ",", 1))
        return ", ".join(partes)


# --------------------------------------------------------------- Instagram

# Business Discovery (perfis de terceiros) não entrega thumbnail_url; em Reels o
# media_url é o próprio vídeo, que vira prévia em vídeo. view_count só vem em Reels.
IG_CAMPOS_BD = "id,caption,media_type,media_product_type,timestamp,like_count,comments_count,view_count,permalink,media_url"
# Na própria conta, a capa do vídeo existe (thumbnail_url).
IG_CAMPOS_PROPRIO = "id,caption,media_type,media_product_type,timestamp,like_count,comments_count,permalink,media_url,thumbnail_url"


def formato_instagram(m: dict) -> str:
    prod, tipo = m.get("media_product_type"), m.get("media_type")
    if prod == "REELS":
        return "Reels"
    if tipo == "CAROUSEL_ALBUM":
        return "Carrossel"
    if tipo == "VIDEO":
        return "Vídeo"
    return "Post estático"


def post_instagram(m: dict, perfil: str, seguidores: int | None) -> Post:
    legenda = m.get("caption") or ""
    return Post(
        plataforma="instagram", perfil="@" + perfil, url=m.get("permalink") or "",
        data=data_iso(m.get("timestamp")), formato=formato_instagram(m),
        titulo=gancho(legenda) or f"{formato_instagram(m)} de @{perfil}", legenda=legenda,
        curtidas=m.get("like_count"), comentarios=m.get("comments_count"), views=m.get("view_count"),
        imagem=m.get("thumbnail_url") or m.get("media_url") or "", seguidores=seguidores,
    )


def buscar_instagram(buscar: Buscador, ig_user_id: str, token: str, usuario: str,
                     versao: str = GRAPH_VERSAO_PADRAO, limite: int = 30) -> list[Post]:
    campos = (f"business_discovery.username({usuario}){{username,followers_count,media_count,"
              f"media.limit({limite}){{{IG_CAMPOS_BD}}}}}")
    url = (f"https://graph.facebook.com/{versao}/{ig_user_id}?"
           + urllib.parse.urlencode({"fields": campos, "access_token": token}))
    bd = get_json(buscar, url).get("business_discovery") or {}
    seg = bd.get("followers_count")
    return [post_instagram(m, bd.get("username") or usuario, seg) for m in (bd.get("media") or {}).get("data", [])]


def buscar_instagram_proprio(buscar: Buscador, ig_user_id: str, token: str,
                             versao: str = GRAPH_VERSAO_PADRAO, limite: int = 30) -> list[Post]:
    """Posts da própria conta comercial (para Referências da marca)."""
    base = f"https://graph.facebook.com/{versao}/{ig_user_id}"
    perfil = get_json(buscar, base + "?" + urllib.parse.urlencode(
        {"fields": "username,followers_count", "access_token": token}))
    midia = get_json(buscar, base + "/media?" + urllib.parse.urlencode(
        {"fields": IG_CAMPOS_PROPRIO, "limit": limite, "access_token": token}))
    return [post_instagram(m, perfil.get("username", ""), perfil.get("followers_count")) for m in midia.get("data", [])]


# ----------------------------------------------------------------- YouTube

YT = "https://www.googleapis.com/youtube/v3/"


def buscar_youtube(buscar: Buscador, chave: str, canal: dict[str, str], limite: int = 30) -> list[Post]:
    q: dict[str, str] = {"part": "contentDetails,snippet,statistics", "key": chave}
    if "id" in canal:
        q["id"] = canal["id"]
    elif "handle" in canal:
        q["forHandle"] = canal["handle"]
    elif "user" in canal:
        q["forUsername"] = canal["user"]
    else:
        return []
    itens = get_json(buscar, YT + "channels?" + urllib.parse.urlencode(q)).get("items") or []
    if not itens:
        raise ErroAPI(f"canal do YouTube não encontrado ({next(iter(canal.values()))})")
    ch = itens[0]
    nome = ch["snippet"]["title"]
    uploads = ch["contentDetails"]["relatedPlaylists"]["uploads"]
    pl = get_json(buscar, YT + "playlistItems?" + urllib.parse.urlencode(
        {"part": "contentDetails", "playlistId": uploads, "maxResults": min(limite, 50), "key": chave}))
    ids = [i["contentDetails"]["videoId"] for i in pl.get("items", [])]
    if not ids:
        return []
    vs = get_json(buscar, YT + "videos?" + urllib.parse.urlencode(
        {"part": "snippet,statistics,contentDetails", "id": ",".join(ids), "key": chave}))
    posts = []
    for v in vs.get("items", []):
        sn, st = v["snippet"], v.get("statistics", {})
        seg = duracao_segundos(v.get("contentDetails", {}).get("duration"))
        th = sn.get("thumbnails", {})
        img = next((th[k]["url"] for k in ("maxres", "standard", "high", "medium", "default") if k in th), "")
        to_int = lambda k: int(st[k]) if k in st else None  # noqa: E731
        formato = "Shorts" if 0 < seg <= 180 else "Vídeo longo"
        posts.append(Post(
            plataforma="youtube", perfil=nome, url=f"https://www.youtube.com/watch?v={v['id']}",
            data=data_iso(sn.get("publishedAt")), formato=formato, titulo=limpar(sn.get("title")),
            legenda=sn.get("description", ""), views=to_int("viewCount"), curtidas=to_int("likeCount"),
            comentarios=to_int("commentCount"), imagem=img,
        ))
    return posts


# ------------------------------------------------------------ vidIQ

# O conector vidIQ (vidiq_ig_profile_reels) devolve markdown. A rotina salva a
# resposta inteira em saida/vidiq/ig-<perfil>.md, incluindo as linhas
# "Reel <código> — <plays> plays" e "[Image: source: <arquivo>]" de cada capa.

def numero_abreviado(txt: str) -> tuple[int, str]:
    """'6.2K' -> (6200, '6,2 mil'); '117' -> (117, '117'). O texto é o exibido."""
    m = re.fullmatch(r"([\d.,]+)\s*([KkMm]?)", txt.strip())
    if not m:
        return 0, txt
    base, suf = m.group(1).replace(",", ""), m.group(2).upper()
    valor = float(base)
    if suf == "K":
        return int(valor * 1000), f"{base.replace('.', ',')} mil"
    if suf == "M":
        return int(valor * 1_000_000), f"{base.replace('.', ',')} mi"
    return int(valor), num_br(int(valor))


def ler_vidiq_reels(texto: str, base_arquivos: Path | None = None) -> list[Post]:
    handle = ""
    m = re.search(r"^##\s*@([A-Za-z0-9._]+)", texto, re.M)
    if m:
        handle = m.group(1)
    exatos, capas = {}, {}
    atual = None
    for linha in texto.splitlines():
        r = re.match(r"^Reel\s+(\S+)\s+\S+\s+(\d+)\s+plays", linha.strip())
        if r:
            atual = r.group(1)
            exatos[atual] = int(r.group(2))
            continue
        im = re.match(r"^\[Image: source: (.+?)\]\s*$", linha.strip())
        if im and atual:
            caminho = Path(im.group(1))
            if base_arquivos and not caminho.is_absolute():
                caminho = base_arquivos / caminho
            capas[atual] = str(caminho)
            atual = None
    posts = []
    blocos = re.split(r"^###\s+", texto, flags=re.M)[1:]
    for b in blocos:
        linhas = b.splitlines()
        cab = re.match(r"(\S+)\s+\S+\s+(.*?),\s*posted\s+(\d{4}-\d{2}-\d{2})(.*)", linhas[0])
        if not cab:
            continue
        code, stats, data, resto = cab.groups()
        textos, vals, dur = {}, {}, 0
        for parte in stats.split(","):
            parte = parte.strip()
            sm = re.fullmatch(r"([\d.,]+[KkMm]?)\s+(plays|likes|comments)", parte)
            if sm:
                v, t = numero_abreviado(sm.group(1))
                chave = {"plays": "views", "likes": "curtidas", "comments": "comentarios"}[sm.group(2)]
                vals[chave], textos[chave] = v, t
            elif re.fullmatch(r"\d+s", parte):
                dur = int(parte[:-1])
        if code in exatos:  # número exato de plays tem prioridade sobre o abreviado
            vals["views"], textos["views"] = exatos[code], num_br(exatos[code])
        url = next((l.strip() for l in linhas[1:] if l.strip().startswith("http")), f"https://www.instagram.com/reel/{code}/")
        # legenda: da linha "> ..." até o fim do bloco (a citação continua sem o ">")
        partes, dentro = [], False
        for l in linhas[1:]:
            if re.match(r"^(Reel\s+\S+\s+\S+\s+\d+\s+plays|\[Image: source:)", l.strip()):
                break
            if l.startswith(">"):
                dentro = True
                l = l[2:] if l.startswith("> ") else l[1:]
            if dentro:
                partes.append(l)
        legenda = "\n".join(partes).strip()
        legenda = re.sub(r'^"|"$', "", legenda)
        legenda = re.sub(r'\.\.\."?$', "...", legenda)
        posts.append(Post(
            plataforma="instagram", perfil="@" + handle, url=url, data=data, formato="Reels",
            titulo=gancho(legenda) or f"Reels de @{handle}", legenda=legenda,
            curtidas=vals.get("curtidas"), comentarios=vals.get("comentarios"),  # ausente = não informado
            views=vals.get("views"), arquivo_local=capas.get(code, ""), duracao=dur, fixado="pinned" in resto,
            textos={k: v for k, v in textos.items() if not re.fullmatch(r"[\d.]+", v)},
        ))
    return posts


# Temas da proposta da Mycapital (IR, bolsa, carteira). Somados aos pilares e ao
# nicho da marca, medem a "semelhança" de um Reel com o que a marca faz.
TEMAS_BASE = {
    "imposto": 3, "irpf": 3, "darf": 3, "declara": 3, "tribut": 3, "fisca": 2, "zera o imposto": 3, "receita federal": 2,
    "malha fina": 2, "isen": 2, "retific": 2, "leão": 2, "renda variável": 3, "bolsa": 2, "ações": 2,
    "carteira": 2, "dividend": 2, "provento": 2, "fii": 2, "exterior": 2, "dólar": 2, "day trade": 2,
    "swing trade": 2, "trader": 2, "corretora": 2, "b3": 2, "open finance": 2, "consolid": 2,
    "investi": 1, "rentabilidade": 1, "patrimônio": 1, "ganho de capital": 3, "preço médio": 3,
}


def temas_da_marca(marca: dict | None) -> dict[str, int]:
    t = dict(TEMAS_BASE)
    if marca:
        textos = list(marca.get("pillars") or []) + [marca.get("niche", "")]
        for palavra in re.findall(r"[a-zà-ú]{5,}", " ".join(textos).lower()):
            t.setdefault(palavra[:-1] if len(palavra) > 6 else palavra, 1)
    return t


def semelhanca(p: Post, temas: dict[str, int]) -> int:
    txt = f" {p.titulo} {p.legenda} ".lower()
    s = sum(peso for chave, peso in temas.items() if chave in txt)
    if re.search(r"\bir\b|i\.r\.", txt):
        s += 3
    return s


def alcance_pago_provavel(p: Post) -> bool:
    """Muitas visualizações e quase nenhuma curtida (< 0,5%): sinal de anúncio ou impulsionamento."""
    return (p.views or 0) >= 10000 and p.curtidas is not None and p.curtidas / p.views < 0.005


def destaques(posts: list[Post], dias: int, fator: float, ref: dt.date | None = None,
              excluir: set[str] | None = None, temas: dict[str, int] | None = None,
              min_semelhanca: int = 2) -> list[Post]:
    """Reels que viralizaram no perfil (visualizações >= fator x a mediana, nos últimos
    `dias`) e que se parecem com a proposta da marca. Ordena por viralização x semelhança."""
    ref = ref or hoje()
    vs = sorted(p.views or 0 for p in posts)
    if not vs:
        return []
    mediana = vs[len(vs) // 2] if len(vs) % 2 else (vs[len(vs) // 2 - 1] + vs[len(vs) // 2]) / 2
    corte = (ref - dt.timedelta(days=dias)).isoformat()
    ex = excluir or set()
    temas = temas or TEMAS_BASE
    out = []
    for p in posts:
        p.vezes = round((p.views or 0) / max(mediana, 1), 1)
        p.semelhanca = semelhanca(p, temas)
        if p.data >= corte and p.vezes >= fator and p.semelhanca >= min_semelhanca \
                and normalizar_link(p.url) not in ex:
            out.append(p)
    return sorted(out, key=lambda p: p.vezes * (1 + min(p.semelhanca, 8) / 4), reverse=True)


def doc_referencia(p: Post, quem: dict | None) -> dict:
    extra = f" · {str(p.vezes).replace('.', ',')}x a mediana do perfil" if p.vezes else ""
    tags = ["concorrente" if quem else "minha marca", "viral no nicho"]
    if p.semelhanca >= 6:
        tags.append("alta semelhança com a marca")
    if alcance_pago_provavel(p):
        tags.append("alcance possivelmente pago")
    return {"platform": "instagram", "format": p.formato, "url": p.url, "creator": p.perfil,
            "views": p.sinal() + extra + f" (publicado em {dt.date.fromisoformat(p.data).strftime('%d/%m/%Y')})",
            "hook": p.titulo, "why": "", "tags": ", ".join(tags), "origem": "importador"}


# ------------------------------------------------- plano de créditos (vidIQ)

# O plano grátis do vidIQ tem 150 créditos por mês e cada consulta de Reels
# custa 5. A atualização só acontece quando alguém clica em "Atualizar
# Instagram"; o plano reparte o saldo pelos dias até a renovação e escolhe
# os perfis que venceram pelo ritmo de postagem.

CUSTO_REELS = 5


def perfis_do_estado(estado: dict) -> list[dict]:
    out, vistos = [], set()
    for m in estado.get("brands", []):
        proprio = usuario_instagram(((m.get("channels") or {}).get("instagram") or {}).get("handle", ""))
        cands = ([{"handle": proprio, "tipo": "marca", "nome": m.get("name", "")}] if proprio else []) + [
            {"handle": usuario_instagram(c.get("instagram", "")), "tipo": "concorrente", "nome": c.get("name", "")}
            for c in m.get("competitors", [])]
        for c in cands:
            h = c["handle"].lower()
            if h and h not in vistos:
                vistos.add(h)
                out.append(dict(c, handle=h, brandId=m.get("id")))
    return out


def intervalo_ideal(info: dict, hoje_: dt.date) -> float:
    """Dias entre consultas: quem posta muito é visto mais vezes."""
    if not info.get("ultimaConsulta"):
        return 0.0
    ult = info.get("ultimoPost")
    if ult and (hoje_ - dt.date.fromisoformat(ult)).days > 90:
        return 30.0  # perfil parado
    ps = float(info.get("postsSemana") or 0)
    if ps <= 0:
        return 14.0
    return round(min(14.0, max(3.0, 7 / ps)), 1)  # cerca de 1 Reel novo entre consultas


RADAR_DIAS = 7  # radar de oportunidades (busca de Reels fora da curva em qualquer perfil): 1 por semana


def radar_consulta(estado: dict, hoje_: dt.date) -> dict | None:
    """Parâmetros do vidiq_instagram_tiktok_outlier_search montados a partir da aba Marca.

    Busca o que está em alta no Instagram em geral (não só concorrentes) nos temas da
    marca, mais trends e memes do mercado financeiro. O Claude filtra o fit depois.
    """
    marca = next((b for b in estado.get("brands", []) if b.get("pillars") or b.get("niche")), None)
    if not marca:
        return None
    temas = [t for t in marca.get("pillars", []) if "produto" not in t.lower()]
    partes = ([marca["niche"]] if marca.get("niche") else []) + temas + [
        "trends e memes do mercado financeiro que estão viralizando"]
    publico = marca.get("audience", "").split(".")[0].strip() or "investidores pessoa física"
    # a aba Referências é do mercado: a própria marca e os concorrentes (que têm aba própria) ficam fora
    excluir = sorted({h.lower() for h in [usuario_instagram(((marca.get("channels") or {}).get("instagram") or {}).get("handle", ""))]
                      + [usuario_instagram(c.get("instagram", "")) for c in marca.get("competitors", [])] if h})
    return {"query": ", ".join(partes), "audienceQuery": f"Culture/Region: Brasil; Global: false; Demographics: {publico};",
            "descriptionLanguage": ["pt"], "datePostedAfter": (hoje_ - dt.timedelta(days=30)).isoformat(),
            "viewsMin": 10000, "resultsPerPlatform": 15, "excluir": excluir}


def radar_vencido(controle: dict, hoje_: dt.date) -> bool:
    ult = controle.get("radarUltimo")
    return not ult or (hoje_ - dt.date.fromisoformat(ult)).days >= RADAR_DIAS


def planejar(estado: dict, controle: dict, saldo: int, renova: dt.date, hoje_: dt.date,
             max_por_clique: int = 3) -> dict:
    """Plano de um clique em "Atualizar Instagram".

    O saldo é repartido pelos dias até a renovação (saldo / dias restantes) e esse
    valor diário acumula desde o último uso. Cada clique gasta só o acumulado, e só
    com perfis que "venceram" pelo ritmo de postagem. Assim o crédito dura até o fim
    do ciclo, não importa quantas vezes o botão for clicado.
    """
    perfis = perfis_do_estado(estado)
    info = controle.get("perfis", {})
    dias_rest = max(1, (renova - hoje_).days)
    diario = saldo / dias_rest
    ult_uso = controle.get("ultimoUso")
    dias_desde = (hoje_ - dt.date.fromisoformat(ult_uso)).days if ult_uso else 1
    liberado = min(saldo, diario * max(0, min(dias_desde, dias_rest)))
    cabe = int(liberado // CUSTO_REELS)
    fila, vencimentos = [], []
    for p in perfis:
        i = intervalo_ideal(info.get(p["handle"], {}), hoje_)
        ult = info.get(p["handle"], {}).get("ultimaConsulta")
        if not ult:
            fila.append(dict(p, atraso=99.0, intervalo=0))
            continue
        passados = (hoje_ - dt.date.fromisoformat(ult)).days
        vencimentos.append(dt.date.fromisoformat(ult) + dt.timedelta(days=round(i)))
        if passados >= i:
            fila.append(dict(p, atraso=round(passados / i, 2), intervalo=i))
    fila.sort(key=lambda x: (-x["atraso"], x["tipo"] != "concorrente"))
    radar = radar_consulta(estado, hoje_) if radar_vencido(controle, hoje_) and cabe >= 1 else None
    escolhidos = fila[:min(max_por_clique - bool(radar), cabe - bool(radar))]
    proxima = None
    if escolhidos or radar:
        partes = [f"consultar {len(escolhidos)} perfil(is): {', '.join('@' + e['handle'] for e in escolhidos)}"] if escolhidos else []
        motivo = "; ".join(partes + (["radar de oportunidades da semana"] if radar else []))
    elif fila or (radar_vencido(controle, hoje_) and radar_consulta(estado, hoje_)):
        faltam = max(1, -(-(CUSTO_REELS - liberado) // diario)) if diario else None
        proxima = (hoje_ + dt.timedelta(days=int(faltam))).isoformat() if faltam else None
        motivo = ("sem créditos liberados hoje para manter o saldo até " + renova.strftime("%d/%m")
                  + (f"; próxima atualização possível em {dt.date.fromisoformat(proxima).strftime('%d/%m')}" if proxima else ""))
    else:
        prox = min(vencimentos) if vencimentos else None
        proxima = max(prox, hoje_ + dt.timedelta(days=1)).isoformat() if prox else None
        motivo = "tudo em dia: nenhum perfil tem Reels novos esperados ainda" + (
            f"; próxima atualização útil em {dt.date.fromisoformat(proxima).strftime('%d/%m')}" if proxima else "")
    return {"hoje": hoje_.isoformat(), "saldo": saldo, "renova": renova.isoformat(),
            "creditosPorDia": round(diario, 1), "creditosLiberados": round(liberado, 1),
            "consultar": escolhidos, "radar": radar, "custo": (len(escolhidos) + bool(radar)) * CUSTO_REELS, "motivo": motivo,
            "proximaEm": proxima, "fila": [{"handle": f["handle"], "atraso": f["atraso"]} for f in fila]}


def registrar_plano(controle: dict, plano: dict) -> None:
    """Guarda o resultado no controle (a página mostra e o próximo clique usa)."""
    if plano["consultar"] or plano.get("radar"):
        controle["ultimoUso"] = plano["hoje"]
    if plano.get("radar"):
        controle["radarUltimo"] = plano["hoje"]
    controle["ultimoPlano"] = {k: plano[k] for k in ("hoje", "saldo", "renova", "motivo", "proximaEm", "custo")}
    controle["ultimoPlano"]["saldoDepois"] = plano["saldo"] - plano["custo"]
    controle["ultimoPlano"]["em"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def atualizar_controle(controle: dict, handle: str, posts: list[Post], hoje_: dt.date) -> None:
    datas = sorted((p.data for p in posts if p.data), reverse=True)
    corte = (hoje_ - dt.timedelta(days=28)).isoformat()
    recentes = sum(1 for d in datas if d >= corte)
    controle.setdefault("perfis", {})[handle.lower()] = {
        "ultimaConsulta": hoje_.isoformat(), "ultimoPost": datas[0] if datas else "",
        "postsSemana": round(recentes / 4, 2)}
    controle["atualizadoEm"] = hoje_.isoformat()


# ------------------------------------------------------------- seleção


def escolher(posts: Iterable[Post], dias: int, quantos: int, ref: dt.date | None = None,
             excluir: set[str] | None = None) -> list[Post]:
    """Os `quantos` melhores dos últimos `dias` dias, fora os links em `excluir`."""
    ref = ref or hoje()
    corte = (ref - dt.timedelta(days=dias)).isoformat()
    vistos, recentes = set(excluir or ()), []
    for p in posts:
        k = normalizar_link(p.url)
        if not k or k in vistos or p.data < corte:
            continue
        vistos.add(k)
        recentes.append(p)
    recentes.sort(key=lambda p: (p.pontuacao(), p.data), reverse=True)
    return recentes[:quantos]


def resumo(p: Post) -> str:
    """Resumo factual, sem opinião nem número estimado."""
    quando = dt.date.fromisoformat(p.data).strftime("%d/%m") if p.data else ""
    base = f"{p.formato} publicado em {quando}" if quando else p.formato
    if p.duracao:
        base += f" ({p.duracao // 60}min{p.duracao % 60:02d}s)" if p.duracao >= 60 else f" ({p.duracao}s)"
    if p.sinal():
        base += f", com {p.sinal()}"
    base += "."
    texto = limpar(p.legenda if p.plataforma == "instagram" else "")
    if texto and texto != p.titulo:
        texto = re.sub(r"\s+", " ", texto)
        base += " Legenda: " + (texto[:280].rsplit(" ", 1)[0] + "..." if len(texto) > 280 else texto)
    return base


# ------------------------------------------------------------- mídia


def baixar_midia(buscar: Buscador, url: str, pasta: Path) -> tuple[str, str]:
    """Baixa a imagem ou o vídeo. Devolve (arquivo, "image"|"video") ou ("", "")."""
    if not url:
        return "", ""
    try:
        dados = buscar(url)
    except ErroAPI:
        return "", ""
    if not dados or len(dados) > MAX_BYTES:  # acima de 20 MB fica sem prévia
        return "", ""
    ext = tipo_imagem(dados) or tipo_video(dados)
    if not ext:
        return "", ""
    nome = hashlib.sha1(url.split("?")[0].encode()).hexdigest()[:16] + "." + ext
    pasta.mkdir(parents=True, exist_ok=True)
    (pasta / nome).write_bytes(dados)
    return nome, ("video" if ext in ("mp4", "webm") else "image")


def copiar_midia(origem: Path, pasta: Path) -> tuple[str, str]:
    """Copia uma capa já salva em disco (conector vidIQ) para a pasta do pacote."""
    try:
        dados = origem.read_bytes()
    except OSError:
        return "", ""
    if not dados or len(dados) > MAX_BYTES:
        return "", ""
    ext = tipo_imagem(dados) or tipo_video(dados)
    if not ext:
        return "", ""
    nome = hashlib.sha1(dados).hexdigest()[:16] + "." + ext
    pasta.mkdir(parents=True, exist_ok=True)
    (pasta / nome).write_bytes(dados)
    return nome, ("video" if ext in ("mp4", "webm") else "image")


def tipo_video(b: bytes) -> str:
    if b[4:8] == b"ftyp":
        return "mp4"
    if b[:4] == b"\x1aE\xdf\xa3":
        return "webm"
    return ""


def tipo_imagem(b: bytes) -> str:
    if b[:3] == b"\xff\xd8\xff":
        return "jpg"
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
        return "webp"
    if b[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    return ""


# ------------------------------------------------------------- pacote


@dataclass
class Config:
    dias: int = 14
    por_perfil: int = 3
    refs_por_perfil: int = 1
    incluir_marca: bool = False
    graph_versao: str = GRAPH_VERSAO_PADRAO
    dias_destaque: int = 180    # janela para Reels que viralizaram (vidIQ)
    fator_destaque: float = 2.0  # visualizações >= fator x mediana do perfil


def id_instagram_da_marca(marca: dict) -> str:
    """IG_USER_ID_<MARCA> tem prioridade; senão, IG_USER_ID (conta única)."""
    chave = "IG_USER_ID_" + re.sub(r"[^A-Z0-9]", "_", str(marca.get("id", "")).upper())
    return os.environ.get(chave) or os.environ.get("IG_USER_ID", "")


def montar_pacote(estado: dict, buscar: Buscador, pasta: Path, cfg: Config,
                  ref: dt.date | None = None, log: Callable[[str], None] = print,
                  vidiq: Path | None = None, controle: dict | None = None) -> dict:
    token = os.environ.get("META_ACCESS_TOKEN", "")
    yt_chave = os.environ.get("YOUTUBE_API_KEY", "")
    midia_dir = pasta / "midia"
    itens: list[dict] = []
    avisos: list[str] = []

    for marca in estado.get("brands", []):
        bid = marca["id"]
        existentes = {normalizar_link(u) for u in marca.get("existingLinks", [])}
        ig_id = id_instagram_da_marca(marca)
        temas = temas_da_marca(marca)

        def registrar(posts: list[Post], quem: dict | None, refs_extra: list[Post] = ()) -> None:
            """Concorrentes vão só para a aba Concorrentes; a própria marca, para Calendário e Métricas.

            A aba Referências é do mercado em geral (radar), então nada daqui vira referência.
            O Reel fora da curva do concorrente entra como conteúdo dele com a etiqueta "fora da curva".
            """
            destaque = {normalizar_link(p.url) for p in refs_extra}
            vistos: set[str] = set()
            for p in [*refs_extra, *posts]:
                k = normalizar_link(p.url)
                if k in existentes or k in vistos or quem is None:
                    continue
                vistos.add(k)
                existentes.add(k)
                if p.arquivo_local:
                    arquivo, tipo = copiar_midia(Path(p.arquivo_local), midia_dir)
                else:
                    arquivo, tipo = baixar_midia(buscar, p.imagem, midia_dir)
                doc = {"kind": "conteudo", "competitorId": quem["id"], "competitorName": quem.get("name", ""),
                       "channel": p.plataforma, "format": p.formato, "title": p.titulo, "url": p.url,
                       "date": p.data, "signal": p.sinal(), "summary": resumo(p), "origem": "importador"}
                if k in destaque:
                    doc["tag"] = "fora da curva"
                    if p.vezes:
                        doc["signal"] += f" · {str(p.vezes).replace('.', ',')}x a mediana do perfil"
                itens.append({"brandId": bid, "arquivo": arquivo, "mediaType": tipo, "plataforma": p.plataforma,
                              "pontuacao": round(p.pontuacao(), 1), "colecao": "compnews", "doc": doc})

        # concorrentes
        for c in marca.get("competitors", []):
            nome = c.get("name") or c.get("id")
            ig = usuario_instagram(c.get("instagram", ""))
            arq_vidiq = vidiq / f"ig-{ig.lower()}.md" if (vidiq and ig) else None
            if arq_vidiq and arq_vidiq.is_file():
                todos = ler_vidiq_reels(arq_vidiq.read_text(encoding="utf-8"), arq_vidiq.parent)
                if controle is not None:
                    atualizar_controle(controle, ig, todos, ref or hoje())
                recentes = escolher(todos, cfg.dias, cfg.por_perfil, ref, existentes)
                # Referências: primeiro o Reel fora da curva do perfil (se houver), depois os recentes
                extra = destaques(todos, cfg.dias_destaque, cfg.fator_destaque, ref, existentes, temas)
                registrar(recentes, c, extra)
                ultimo = max((p.data for p in todos), default="")
                if not recentes:
                    avisos.append(f"{nome} (Instagram @{ig}): nenhum Reel nos últimos {cfg.dias} dias"
                                  + (f"; o último é de {dt.date.fromisoformat(ultimo).strftime('%d/%m/%Y')}." if ultimo else "."))
                log(f"  IG @{ig} (vidIQ): {len(recentes)} recentes, {len(extra)} destaques")
            elif ig and vidiq:
                pass  # perfil não consultado hoje (plano de créditos)
            elif ig:
                if not (token and ig_id):
                    avisos.append(f"{marca.get('name', bid)}: sem META_ACCESS_TOKEN ou IG_USER_ID, Instagram de {nome} ignorado.")
                else:
                    try:
                        registrar(escolher(buscar_instagram(buscar, ig_id, token, ig, cfg.graph_versao),
                                           cfg.dias, cfg.por_perfil, ref, existentes), c)
                        log(f"  IG @{ig}: ok")
                    except ErroAPI as e:
                        avisos.append(f"{nome} (Instagram @{ig}): {e}")
            yt = canal_youtube(c.get("youtube", ""))
            if yt and not (vidiq and not yt_chave):
                if not yt_chave:
                    avisos.append(f"{marca.get('name', bid)}: sem YOUTUBE_API_KEY, YouTube de {nome} ignorado.")
                else:
                    try:
                        registrar(escolher(buscar_youtube(buscar, yt_chave, yt), cfg.dias, cfg.por_perfil, ref, existentes), c)
                        log(f"  YT {next(iter(yt.values()))}: ok")
                    except ErroAPI as e:
                        avisos.append(f"{nome} (YouTube): {e}")

        # a própria marca, só para Referências
        proprio = usuario_instagram(((marca.get("channels") or {}).get("instagram") or {}).get("handle", ""))
        arq_proprio = vidiq / f"ig-{proprio.lower()}.md" if (vidiq and proprio) else None
        if arq_proprio and arq_proprio.is_file():
            todos = ler_vidiq_reels(arq_proprio.read_text(encoding="utf-8"), arq_proprio.parent)
            if controle is not None:
                atualizar_controle(controle, proprio, todos, ref or hoje())
            extra = destaques(todos, cfg.dias_destaque, cfg.fator_destaque, ref, existentes, temas)
            registrar([], None, extra)
            itens.extend(itens_da_marca(bid, todos, existentes, ref or hoje(), cfg.dias_destaque))
            log(f"  IG próprio @{proprio} (vidIQ): {min(len(extra), cfg.por_perfil)} destaques")
        elif cfg.incluir_marca and token and ig_id:
            try:
                registrar(escolher(buscar_instagram_proprio(buscar, ig_id, token, cfg.graph_versao),
                                   cfg.dias, cfg.por_perfil, ref, existentes), None)
            except ErroAPI as e:
                avisos.append(f"{marca.get('name', bid)} (Instagram próprio): {e}")

    return {
        "geradoEm": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "config": asdict(cfg), "itens": itens, "avisos": avisos,
        "arquivos": sorted({i["arquivo"] for i in itens if i["arquivo"]}),
    }


def itens_da_marca(bid: str, posts: list[Post], existentes: set[str], hoje_: dt.date, dias: int) -> list[dict]:
    """Reels da própria marca: viram posts publicados no Calendário (nada vai para Métricas)."""
    out = []
    corte = (hoje_ - dt.timedelta(days=dias)).isoformat()
    agora = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    for p in posts:
        k = normalizar_link(p.url)
        if p.data < corte or k in existentes:
            continue
        existentes.add(k)
        code = p.url.rstrip("/").split("/")[-1]
        out.append({"brandId": bid, "arquivo": "", "mediaType": "", "plataforma": "instagram", "colecao": "posts",
                    "docId": "ig-" + code, "doc": {
                        "title": p.titulo, "date": p.data, "time": "", "channel": "instagram", "format": p.formato,
                        "status": "publicado", "pillar": "", "caption": p.legenda, "link": p.url,
                        "notes": f"{p.sinal()} (vidIQ, {hoje_.strftime('%d/%m/%Y')}).", "origem": "importador"}})
    # Métricas não vêm daqui: a aba Métricas é lançada pela equipe (planilha de KPIs semanais)
    return out
    mais_antigo = soltos[0]
    meses = sorted({p.data[:7] for p in posts if p.data[:7] + "-01" > mais_antigo})
    for m in meses:
        ps = [p for p in posts if p.data.startswith(m)]
        if not ps:
            continue
        ini = dt.date.fromisoformat(m + "-01")
        fim = (ini.replace(day=28) + dt.timedelta(days=4)).replace(day=1) - dt.timedelta(days=1)
        fim = min(fim, hoje_)
        out.append({"brandId": bid, "arquivo": "", "mediaType": "", "plataforma": "instagram", "colecao": "metrics",
                    "docId": "ig-reels-" + m, "doc": {
                        "channel": "instagram", "start": ini.isoformat(), "end": fim.isoformat(),
                        "reach": sum(p.views or 0 for p in ps), "posts": len(ps),
                        "notes": f"Só Reels, dados públicos do vidIQ em {hoje_.strftime('%d/%m/%Y')}. Alcance = visualizações "
                                 "acumuladas dos Reels publicados no mês. Posts de feed e carrosséis não entram.",
                        "origem": "importador"}})
    return out


def montar_lote(pacote: dict, ids: dict[str, str]) -> list[dict]:
    """Converte o pacote em escritas para o ArtifactData (acao batch).

    `ids` mapeia nome do arquivo em midia/ -> id do asset (32 hex) devolvido
    pelo upload. Itens cuja imagem não subiu são gravados sem prévia.
    """
    lote = []
    agora = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    for it in pacote["itens"]:
        doc = dict(it["doc"], createdAt=agora)
        aid = ids.get(it.get("arquivo") or "", "")
        if re.fullmatch(r"[0-9a-f]{32}", aid or ""):
            doc["media"], doc["mediaType"] = aid, it.get("mediaType") or "image"
        doc_id = it.get("docId") or "imp-" + hashlib.sha1(normalizar_link(doc.get("url", "")).encode()).hexdigest()[:20]
        lote.append({"op": "set", "collection": f"brands/{it['brandId']}/{it['colecao']}",
                     "doc_id": doc_id, "data": doc})
    return lote


# ------------------------------------------------------------- simulação


def buscador_simulado(ref: dt.date) -> Buscador:
    """Respostas fictícias no formato real das APIs, para testar sem internet."""
    d = lambda n: (ref - dt.timedelta(days=n)).isoformat() + "T12:00:00+0000"  # noqa: E731
    jpg = b"\xff\xd8\xff\xe0" + b"0" * 64
    mp4 = b"\x00\x00\x00\x18ftypmp42" + b"0" * 64

    def buscar(url: str) -> bytes:
        if "graph.facebook.com" in url and "business_discovery" in url:
            if "thumbnail_url" in urllib.parse.unquote(url):
                raise ErroAPI("(#100) thumbnail_url não existe no Business Discovery", 400)
            u = re.search(r"username\(([^)]+)\)", urllib.parse.unquote(url)).group(1)
            if u == "naoexiste":
                raise ErroAPI("perfil não encontrado", 400)
            media = [{"id": str(i), "caption": f"Gancho {i} do @{u}\nmais texto #tag", "media_type": t,
                      "media_product_type": "REELS" if t == "VIDEO" else "FEED", "timestamp": d(dias),
                      "like_count": likes, "comments_count": com, "permalink": f"https://www.instagram.com/p/{u}{i}/",
                      "media_url": f"https://cdn.exemplo/{u}{i}.{'mp4' if t == 'VIDEO' else 'jpg'}",
                      **({"view_count": likes * 12} if t == "VIDEO" else {})}
                     for i, (t, dias, likes, com) in enumerate([
                         ("VIDEO", 2, 900, 40), ("CAROUSEL_ALBUM", 5, 1500, 120), ("IMAGE", 9, 300, 5),
                         ("VIDEO", 20, 99999, 999), ("IMAGE", 1, 50, 2)])]
            return json.dumps({"business_discovery": {"username": u, "followers_count": 25000,
                                                      "media": {"data": media}}}).encode()
        if "googleapis.com/youtube/v3/channels" in url:
            return json.dumps({"items": [{"id": "UC" + "x" * 22, "snippet": {"title": "Canal Exemplo"},
                                          "contentDetails": {"relatedPlaylists": {"uploads": "UUx"}}}]}).encode()
        if "playlistItems" in url:
            return json.dumps({"items": [{"contentDetails": {"videoId": f"v{i}"}} for i in range(4)]}).encode()
        if "youtube/v3/videos" in url:
            vids = [("v0", 3, 12000, "PT8M3S"), ("v1", 6, 50000, "PT45S"), ("v2", 30, 900000, "PT10M"), ("v3", 10, 800, "PT1H2M")]
            return json.dumps({"items": [{"id": v, "snippet": {"title": f"Vídeo {v} — teste", "publishedAt": d(dias),
                                                               "thumbnails": {"high": {"url": f"https://i.ytimg.com/{v}.jpg"}}},
                                          "statistics": {"viewCount": str(views), "likeCount": "100", "commentCount": "10"},
                                          "contentDetails": {"duration": dur}} for v, dias, views, dur in vids]}).encode()
        if url.startswith("https://cdn.exemplo/") and url.endswith(".mp4"):
            return mp4
        if url.startswith("https://cdn.exemplo/") or url.startswith("https://i.ytimg.com/"):
            return jpg
        raise ErroAPI(f"URL não simulada: {url}")

    return buscar


ESTADO_EXEMPLO = {
    "brands": [{
        "id": "mycapital", "name": "Mycapital",
        "existingLinks": ["https://instagram.com/p/concorrentea1"],
        "competitors": [
            {"id": "c1", "name": "Concorrente A", "instagram": "@concorrentea", "youtube": "https://www.youtube.com/@canalexemplo"},
            {"id": "c2", "name": "Concorrente B", "instagram": "https://www.instagram.com/naoexiste/"},
        ],
    }]
}


# ------------------------------------------------------------------ CLI


def cmd_buscar(a: argparse.Namespace) -> int:
    carregar_env(Path(a.env))
    estado = json.loads(Path(a.estado).read_text(encoding="utf-8"))
    pasta = Path(a.saida) / hoje().isoformat()
    cfg = Config(dias=a.dias, por_perfil=a.por_perfil, refs_por_perfil=a.refs_por_perfil,
                 incluir_marca=a.incluir_marca, graph_versao=os.environ.get("META_GRAPH_VERSION", GRAPH_VERSAO_PADRAO))
    vidiq = Path(a.vidiq) if a.vidiq else None
    controle = None
    if a.controle:
        cp = Path(a.controle)
        controle = json.loads(cp.read_text(encoding="utf-8")) if cp.is_file() else {}
    r = gravar(montar_pacote(estado, http_get, pasta, cfg, vidiq=vidiq, controle=controle), pasta)
    if controle is not None:
        Path(a.controle).write_text(json.dumps(controle, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Controle atualizado: {a.controle}")
    return r


def cmd_planejar(a: argparse.Namespace) -> int:
    estado = json.loads(Path(a.estado).read_text(encoding="utf-8"))
    cp = Path(a.controle)
    controle = json.loads(cp.read_text(encoding="utf-8")) if cp.is_file() else {}
    renova = dt.date.fromisoformat(a.renova[:10])
    h = dt.date.fromisoformat(a.hoje) if a.hoje else hoje()
    plano = planejar(estado, controle, a.saldo, renova, h, a.max_por_clique)
    registrar_plano(controle, plano)
    cp.write_text(json.dumps(controle, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(plano, ensure_ascii=False, indent=2))
    return 0


def cmd_simular(a: argparse.Namespace) -> int:
    ref = hoje()
    os.environ.update({"META_ACCESS_TOKEN": "simulado", "IG_USER_ID": "17840000000000000", "YOUTUBE_API_KEY": "simulada"})
    pasta = Path(a.saida) / ("simulacao-" + ref.isoformat())
    return gravar(montar_pacote(ESTADO_EXEMPLO, buscador_simulado(ref), pasta, Config(), ref), pasta)


def gravar(pacote: dict, pasta: Path) -> int:
    pasta.mkdir(parents=True, exist_ok=True)
    (pasta / "pacote.json").write_text(json.dumps(pacote, ensure_ascii=False, indent=2), encoding="utf-8")
    por_col: dict[str, int] = {}
    for it in pacote["itens"]:
        por_col[it["colecao"]] = por_col.get(it["colecao"], 0) + 1
    print(f"\nPacote: {pasta / 'pacote.json'}")
    print(f"Itens novos: {len(pacote['itens'])} {por_col or ''}  |  imagens: {len(pacote['arquivos'])}")
    for av in pacote["avisos"]:
        print("  aviso:", av)
    return 0


def filtrar_coleta(coleta: dict, estado: dict) -> dict:
    """Do que o coletor (GitHub Actions) trouxe, fica só o que ainda não está no Content Lab."""
    existentes: dict[str, set[str]] = {}
    for m in estado.get("brands", []):
        existentes[m["id"]] = {normalizar_link(u) for u in m.get("existingLinks", [])}
    itens = []
    for it in coleta.get("itens", []):
        ex = existentes.setdefault(it["brandId"], set())
        chaves = {normalizar_link(u) for u in [it["doc"].get("url", "")] + it.get("aliases", []) if u}
        if not chaves or chaves & ex:
            continue
        ex |= chaves
        itens.append(it)
    return {"geradoEm": coleta.get("geradoEm"), "fonte": coleta.get("fonte", "coletor"), "itens": itens,
            "avisos": coleta.get("avisos", []), "arquivos": sorted({i["arquivo"] for i in itens if i.get("arquivo")})}


def cmd_coleta(a: argparse.Namespace) -> int:
    coleta = json.loads(Path(a.coleta).read_text(encoding="utf-8"))
    estado = json.loads(Path(a.estado).read_text(encoding="utf-8"))
    pacote = filtrar_coleta(coleta, estado)
    pasta = Path(a.saida) / ("coleta-" + hoje().isoformat())
    origem = Path(a.coleta).parent / "midia"
    (pasta / "midia").mkdir(parents=True, exist_ok=True)
    for arq in pacote["arquivos"]:
        f = origem / arq
        if f.is_file():
            (pasta / "midia" / arq).write_bytes(f.read_bytes())
    return gravar(pacote, pasta)


def cmd_montar_lote(a: argparse.Namespace) -> int:
    pacote = json.loads(Path(a.pacote).read_text(encoding="utf-8"))
    ids = json.loads(Path(a.ids).read_text(encoding="utf-8")) if a.ids else {}
    lote = montar_lote(pacote, ids)
    pasta = Path(a.pacote).parent
    for velho in pasta.glob("lote-*.json"):
        velho.unlink()
    partes = [lote[i:i + LOTE_MAX] for i in range(0, len(lote), LOTE_MAX)]
    for n, parte in enumerate(partes, 1):
        (pasta / f"lote-{n:02d}.json").write_text(json.dumps(parte, ensure_ascii=False, indent=2), encoding="utf-8")
    com = sum(1 for x in lote if "media" in x["data"])
    print(f"Lote: {len(lote)} escritas ({com} com prévia) em {len(partes)} arquivo(s) lote-NN.json em {pasta}")
    print("Cada arquivo vira uma chamada ArtifactData action=batch, com writes = conteúdo do arquivo.")
    return 0


def ler_dump(pasta: Path, colecao: str) -> list[dict]:
    """Lê os JSON salvos por ArtifactData (out_dir) de uma coleção."""
    docs = []
    for f in sorted((pasta / colecao).glob("*.json")):
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except ValueError:
            continue
        if isinstance(d, dict) and isinstance(d.get("data"), dict) and ("version" in d or "id" in d):
            d = dict(d["data"], id=d.get("id") or f.stem)
        if isinstance(d, dict):
            d.setdefault("id", f.stem)
            docs.append(d)
    return docs


def montar_estado(pasta: Path) -> dict:
    """Monta estado.json a partir do dump do banco (brands, competitors, compnews, refs)."""
    marcas = []
    for b in ler_dump(pasta, "brands"):
        base = f"brands/{b['id']}"
        links = [d.get("url", "") or d.get("link", "") for c in ("compnews", "refs", "posts", "news")
                 for d in ler_dump(pasta, f"{base}/{c}")]
        marcas.append({"id": b["id"], "name": b.get("name", ""),
                       "channels": b.get("channels", {}), "pillars": b.get("pillars", []), "niche": b.get("niche", ""),
                       "audience": b.get("audience", ""), "avoid": b.get("avoid", ""), "tone": b.get("tone", ""),
                       "competitors": [{k: c.get(k, "") for k in ("id", "name", "instagram", "youtube", "tiktok")}
                                       for c in ler_dump(pasta, f"{base}/competitors")],
                       "existingLinks": [u for u in links if u]})
    return {"brands": marcas}


def cmd_montar_estado(a: argparse.Namespace) -> int:
    estado = montar_estado(Path(a.dump))
    Path(a.saida).write_text(json.dumps(estado, ensure_ascii=False, indent=2), encoding="utf-8")
    n = sum(len(b["competitors"]) for b in estado["brands"])
    print(f"Estado: {a.saida} ({len(estado['brands'])} marcas, {n} concorrentes)")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Importa posts com prévia para o Content Lab.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("buscar", help="consulta Instagram e YouTube e monta o pacote")
    b.add_argument("--estado", required=True, help="JSON com marcas, concorrentes e links já salvos")
    b.add_argument("--saida", default=str(AQUI / "saida"))
    b.add_argument("--env", default=str(AQUI / ".env"))
    b.add_argument("--dias", type=int, default=14)
    b.add_argument("--por-perfil", type=int, default=3)
    b.add_argument("--refs-por-perfil", type=int, default=1)
    b.add_argument("--incluir-marca", action="store_true", help="também importa os melhores posts da própria conta")
    b.add_argument("--vidiq", help="pasta com as respostas do conector vidIQ (ig-<perfil>.md); usada no lugar da API da Meta")
    b.add_argument("--controle", help="JSON de controle do plano de créditos (atualizado com as consultas lidas)")
    pl = sub.add_parser("planejar", help="decide quais perfis consultar neste clique, repartindo o saldo até a renovação")
    pl.add_argument("--estado", required=True)
    pl.add_argument("--controle", required=True)
    pl.add_argument("--saldo", type=int, required=True, help="totalCredits do vidiq_balance")
    pl.add_argument("--renova", required=True, help="renewableResetsAt do vidiq_balance")
    pl.add_argument("--hoje")
    pl.add_argument("--max-por-clique", type=int, default=3)
    pl.set_defaults(f=cmd_planejar)
    b.set_defaults(f=cmd_buscar)
    e = sub.add_parser("montar-estado", help="gera estado.json a partir do dump do banco (ArtifactData out_dir)")
    e.add_argument("--dump", required=True, help="pasta usada como out_dir nas leituras do ArtifactData")
    e.add_argument("--saida", default="estado.json")
    e.set_defaults(f=cmd_montar_estado)
    co = sub.add_parser("coleta", help="filtra dados/coleta.json (coletor gratuito) contra o que já está no Content Lab")
    co.add_argument("--coleta", default=str(AQUI.parent / "dados" / "coleta.json"))
    co.add_argument("--estado", required=True)
    co.add_argument("--saida", default=str(AQUI / "saida"))
    co.set_defaults(f=cmd_coleta)
    m = sub.add_parser("montar-lote", help="gera lote.json para o ArtifactData")
    m.add_argument("--pacote", required=True)
    m.add_argument("--ids", help="JSON {arquivo: id_do_asset}")
    m.set_defaults(f=cmd_montar_lote)
    s = sub.add_parser("simular", help="roda com dados fictícios, sem internet")
    s.add_argument("--saida", default=str(AQUI / "saida"))
    s.set_defaults(f=cmd_simular)
    a = ap.parse_args(argv)
    return a.f(a)


if __name__ == "__main__":
    sys.exit(main())
