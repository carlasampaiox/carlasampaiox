#!/usr/bin/env python3
"""Motor de coleta gratuito do Content Lab (roda no GitHub Actions).

Fontes oficiais e públicas, sem login, sem chave e sem créditos:
  - YouTube: RSS oficial de cada canal (título, data, visualizações, curtidas, capa)
  - Google Notícias: RSS de busca (nicho da marca e menções aos concorrentes)
  - Blogs: RSS/Atom dos blogs dos concorrentes, quando existir

Usa a biblioteca open source feedparser (github.com/kurtmckee/feedparser).
Grava `dados/coleta.json` no formato de pacote do importador e as capas em
`dados/midia/`. A rotina do Claude (botão "Atualizar agora") só importa o que
ainda não está no Content Lab (compara pelo link).

Uso: python importador/coletor.py [--fontes importador/fontes.json] [--saida dados]
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import statistics
import sys
import urllib.parse
from pathlib import Path

import importar_posts as ip

AQUI = Path(__file__).resolve().parent


def carregar_feed(url: str, buscar: ip.Buscador):
    import feedparser  # dependência só do coletor (pip install feedparser)
    return feedparser.parse(buscar(url))


def data_de(entry) -> str:
    for k in ("published_parsed", "updated_parsed"):
        t = entry.get(k)
        if t:
            return dt.date(t.tm_year, t.tm_mon, t.tm_mday).isoformat()
    return ""


def sem_fonte(titulo: str, fonte: str) -> str:
    """Google Notícias termina o título com ' - Fonte'."""
    t = str(titulo or "")
    if fonte and t.endswith(" - " + fonte):
        t = t[: -len(" - " + fonte)]
    return ip.limpar(t)


def texto_de_html(html: str, limite: int = 280) -> str:
    t = re.sub(r"<[^>]+>", " ", str(html or ""))
    t = re.sub(r"\s+", " ", t).strip()
    return ip.limpar(t[:limite].rsplit(" ", 1)[0] + "..." if len(t) > limite else t)


def resolver_canal(valor: str, buscar: ip.Buscador) -> str:
    """Id UC... a partir do link ou @handle (lendo a página pública do canal)."""
    c = ip.canal_youtube(valor)
    if "id" in c:
        return c["id"]
    alvo = ("https://www.youtube.com/" + c["handle"]) if "handle" in c else (
        "https://www.youtube.com/user/" + c["user"] if "user" in c else "")
    if not alvo:
        return ""
    try:
        html = buscar(alvo).decode("utf-8", "replace")
    except ip.ErroAPI:
        return ""
    m = re.search(r'"(?:channelId|externalId)":"(UC[A-Za-z0-9_-]{22})"', html) or \
        re.search(r'<link rel="canonical" href="https://www\.youtube\.com/channel/(UC[A-Za-z0-9_-]{22})"', html)
    return m.group(1) if m else ""


def youtube(canal_id: str, buscar: ip.Buscador) -> list[ip.Post]:
    f = carregar_feed(f"https://www.youtube.com/feeds/videos.xml?channel_id={canal_id}", buscar)
    nome = (f.feed or {}).get("title", "")
    out = []
    for e in f.entries:
        vid = e.get("yt_videoid") or e.get("link", "").split("v=")[-1]
        views = e.get("media_statistics", {}).get("views")
        likes = e.get("media_starrating", {}).get("count")
        thumb = (e.get("media_thumbnail") or [{}])[0].get("url", "")
        link = e.get("link", f"https://www.youtube.com/watch?v={vid}")
        shorts = "/shorts/" in link
        out.append(ip.Post(
            plataforma="youtube", perfil=nome, url=f"https://www.youtube.com/watch?v={vid}", data=data_de(e),
            formato="Shorts" if shorts else "Vídeo", titulo=ip.limpar(e.get("title", "")),
            legenda=(e.get("media_description") or e.get("summary") or ""),
            views=int(views) if views else None, curtidas=int(likes) if likes else None, imagem=thumb))
    return out


def noticias(consulta: str, buscar: ip.Buscador) -> list[dict]:
    url = "https://news.google.com/rss/search?" + urllib.parse.urlencode(
        {"q": consulta + " when:7d", "hl": "pt-BR", "gl": "BR", "ceid": "BR:pt-419"})
    f = carregar_feed(url, buscar)
    out = []
    for e in f.entries:
        fonte = (e.get("source") or {}).get("title", "")
        out.append({"title": sem_fonte(e.get("title", ""), fonte), "url": e.get("link", ""),
                    "source": fonte, "date": data_de(e)})
    return out


def blog(url_feed: str, buscar: ip.Buscador) -> list[dict]:
    f = carregar_feed(url_feed, buscar)
    return [{"title": ip.limpar(e.get("title", "")), "url": e.get("link", ""), "date": data_de(e),
             "summary": texto_de_html(e.get("summary", ""))} for e in f.entries]


def coletar(fontes: dict, buscar: ip.Buscador, pasta: Path, hoje_: dt.date, log=print) -> dict:
    itens, avisos, vistos = [], [], set()
    midia = pasta / "midia"
    marca = fontes["marca"]
    bid = marca["id"]
    corte7 = (hoje_ - dt.timedelta(days=7)).isoformat()
    corte30 = (hoje_ - dt.timedelta(days=30)).isoformat()

    def novo(url: str) -> bool:
        k = ip.normalizar_link(url)
        if not k or k in vistos:
            return False
        vistos.add(k)
        return True

    # notícias do nicho e menções à marca
    for q in marca.get("noticias", []):
        try:
            for n in noticias(q["busca"], buscar):
                if n["date"] >= corte7 and novo(n["url"]):
                    itens.append({"brandId": bid, "colecao": "news", "arquivo": "", "mediaType": "", "doc": dict(
                        n, tag=q.get("tema", ""), summary="", origem="coletor")})
            log(f"  notícias: {q['busca']}")
        except Exception as e:  # uma fonte com problema não derruba as outras
            avisos.append(f"Google Notícias ({q['busca']}): {e}")

    for c in fontes.get("concorrentes", []):
        nome = c["nome"]
        # YouTube
        if c.get("youtube"):
            try:
                cid = resolver_canal(c["youtube"], buscar)
                if not cid:
                    raise ip.ErroAPI("canal não encontrado")
                todos = youtube(cid, buscar)
                vids = [v for v in todos if v.data >= corte30]
                med = statistics.median([v.views or 0 for v in todos]) if todos else 0
                for v in sorted(vids, key=lambda v: v.views or 0, reverse=True)[:3]:
                    if not novo(v.url):
                        continue
                    v.vezes = round((v.views or 0) / max(med, 1), 1)
                    arq, tipo = ip.baixar_midia(buscar, v.imagem, midia)
                    sinal = v.sinal() + (f" · {str(v.vezes).replace('.', ',')}x a mediana do canal" if v.vezes >= 2 else "")
                    itens.append({"brandId": bid, "colecao": "compnews", "arquivo": arq, "mediaType": tipo, "doc": {
                        "kind": "conteudo", "competitorId": c["id"], "competitorName": nome, "channel": "youtube",
                        "format": v.formato, "title": v.titulo, "url": v.url, "date": v.data, "signal": sinal,
                        "summary": ip.resumo(v), "origem": "coletor"}})
                log(f"  YouTube {nome}: {len(vids)} vídeos em 30 dias")
            except Exception as e:
                avisos.append(f"{nome} (YouTube): {e}")
        # blog
        for feed in c.get("blogs", []):
            try:
                for p in blog(feed, buscar):
                    if p["date"] >= corte30 and novo(p["url"]):
                        itens.append({"brandId": bid, "colecao": "compnews", "arquivo": "", "mediaType": "", "doc": {
                            "kind": "conteudo", "competitorId": c["id"], "competitorName": nome, "channel": "blog",
                            "format": "Artigo", "title": p["title"], "url": p["url"], "date": p["date"],
                            "signal": "", "summary": p["summary"], "origem": "coletor"}})
                log(f"  blog {nome}: ok")
            except Exception as e:
                avisos.append(f"{nome} (blog {feed}): {e}")
        # notícias sobre o concorrente
        if c.get("busca"):
            try:
                for n in noticias(c["busca"], buscar):
                    if n["date"] >= corte7 and novo(n["url"]):
                        itens.append({"brandId": bid, "colecao": "compnews", "arquivo": "", "mediaType": "", "doc": {
                            "kind": "noticia", "competitorId": c["id"], "competitorName": nome, "title": n["title"],
                            "url": n["url"], "source": n["source"], "date": n["date"], "summary": "",
                            "origem": "coletor"}})
            except Exception as e:
                avisos.append(f"{nome} (notícias): {e}")

    return {"geradoEm": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
            "fonte": "coletor (GitHub Actions)", "itens": itens, "avisos": avisos,
            "arquivos": sorted({i["arquivo"] for i in itens if i["arquivo"]})}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Coleta gratuita de YouTube, Google Notícias e blogs.")
    ap.add_argument("--fontes", default=str(AQUI / "fontes.json"))
    ap.add_argument("--saida", default=str(AQUI.parent / "dados"))
    a = ap.parse_args(argv)
    fontes = json.loads(Path(a.fontes).read_text(encoding="utf-8"))
    pasta = Path(a.saida)
    pasta.mkdir(parents=True, exist_ok=True)
    velhas = set((pasta / "midia").glob("*")) if (pasta / "midia").exists() else set()
    r = coletar(fontes, ip.http_get, pasta, ip.hoje())
    # guarda só as capas usadas na coleta atual
    usadas = set(r["arquivos"])
    for f in velhas:
        if f.name not in usadas:
            f.unlink()
    (pasta / "coleta.json").write_text(json.dumps(r, ensure_ascii=False, indent=2), encoding="utf-8")
    por = {}
    for i in r["itens"]:
        por[i["colecao"]] = por.get(i["colecao"], 0) + 1
    print(f"Coleta: {len(r['itens'])} itens {por}, {len(usadas)} capas, {len(r['avisos'])} avisos")
    for av in r["avisos"]:
        print("  aviso:", av)
    return 0


if __name__ == "__main__":
    sys.exit(main())
