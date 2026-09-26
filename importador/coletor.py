#!/usr/bin/env python3
"""Motor de coleta gratuito do Content Lab (roda no GitHub Actions).

Fontes oficiais e públicas, sem login, sem chave e sem créditos:
  - YouTube: RSS oficial de cada canal (título, data, visualizações, curtidas, capa)
  - Google Notícias: RSS de busca (nicho da marca e menções aos concorrentes)
  - Blogs: RSS/Atom dos blogs dos concorrentes, quando existir

Bibliotecas open source do GitHub usadas (instaladas no GitHub Actions):
  - feedparser (kurtmckee/feedparser): lê RSS e Atom
  - googlenewsdecoder (SSujitX/google-news-url-decoder): link real da notícia
  - trafilatura (adbar/trafilatura): texto principal da matéria, para o resumo
  - trendspyg (flack0x/trendspyg): Google Trends, buscas em alta no Brasil
Cada etapa é opcional: se a biblioteca ou a fonte falhar, o resto segue.
Grava `dados/coleta.json` no formato de pacote do importador e as capas em
`dados/midia/`. A rotina do Claude (botão "Atualizar agora") só importa o que
ainda não está no Content Lab (compara pelo link).

Uso: python importador/coletor.py [--fontes importador/fontes.json] [--saida dados]
"""
from __future__ import annotations

import argparse
import datetime as dt
import time
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


TEMAS_NOTICIA = dict(ip.TEMAS_BASE, **{"renda fixa": 1, "selic": 1, "tesouro": 1, "etf": 1, "lci": 1, "lca": 1,
                                        "cdb": 1, "come-cotas": 3, "restitui": 3, "stj": 1, "carf": 2})


def relevancia(titulo: str, temas: dict[str, int]) -> int:
    return ip.semelhanca(ip.Post("", "", "", "", "", titulo), temas)


def palavras(t: str) -> set[str]:
    return {w for w in re.findall(r"[a-zà-ú0-9]{4,}", t.lower())}


def repetida(titulo: str, ja: list[set[str]], limite: float = 0.45) -> bool:
    """Mesmo fato com outro título (Jaccard das palavras)."""
    p = palavras(titulo)
    return bool(p) and any(len(p & q) / len(p | q) >= limite for q in ja if q)


def menciona(nome: str, titulo: str) -> bool:
    n = re.sub(r"[^a-z0-9]", "", nome.lower())
    return n and n in re.sub(r"[^a-z0-9]", "", titulo.lower())


def primeiras_frases(texto: str, n: int = 2, limite: int = 360) -> str:
    frases = re.split(r"(?<=[.!?])\s+", re.sub(r"\s+", " ", str(texto or "")).strip())
    t = " ".join(f for f in frases[:n] if len(f) > 25)
    return ip.limpar(t[:limite].rsplit(" ", 1)[0] + "..." if len(t) > limite else t)


def enriquecer_noticias(itens: list[dict], log=print, decodificar=None, baixar_texto=None,
                        limite_s: int = 240) -> int:
    """Troca o link do Google Notícias pelo link real (googlenewsdecoder) e guarda
    as primeiras frases da matéria (trafilatura) em `contexto`, para o resumo."""
    alvo = [i for i in itens if "news.google.com" in i["doc"].get("url", "")]
    if not alvo:
        return 0
    if decodificar is None:
        try:
            from googlenewsdecoder import gnewsdecoder
        except ImportError:
            log("  googlenewsdecoder ausente: links do Google Notícias mantidos")
            return 0
        decodificar = lambda urls: gnewsdecoder(urls, interval=1)  # noqa: E731
    if baixar_texto is None:
        try:
            import trafilatura

            def baixar_texto(url):
                # download próprio com prazo curto (o fetch padrão espera até 30 s por site)
                html = ip.http_get(url, tentativas=1, timeout=8).decode("utf-8", "replace")
                return trafilatura.extract(html, include_comments=False, include_tables=False) or ""
        except ImportError:
            baixar_texto = lambda url: ""  # noqa: E731
    ok = 0
    inicio = time.monotonic()
    for bloco in range(0, len(alvo), 10):
        if time.monotonic() - inicio > limite_s:
            log(f"  tempo de enriquecimento esgotado ({limite_s}s); resto fica com o link do Google")
            break
        grupo = alvo[bloco:bloco + 10]
        try:
            res = decodificar([i["doc"]["url"] for i in grupo])
        except Exception as e:  # noqa: BLE001
            log(f"  decoder falhou: {e}")
            continue
        for it, r in zip(grupo, res if isinstance(res, list) else [res]):
            if not (isinstance(r, dict) and r.get("success") and r.get("decoded_url")):
                continue
            it.setdefault("aliases", []).append(it["doc"]["url"])
            it["doc"]["url"] = r["decoded_url"]
            ok += 1
            if time.monotonic() - inicio < limite_s:
                try:
                    it["contexto"] = primeiras_frases(baixar_texto(r["decoded_url"]) or "")
                except Exception:  # noqa: BLE001
                    pass
    return ok


def tendencias(fontes: dict, log=print, explorar=None, em_alta=None) -> dict:
    """Google Trends no Brasil (trendspyg): buscas relacionadas em alta para os
    termos da marca e assuntos do momento que tenham a ver com o nicho."""
    cfg = fontes.get("tendencias") or {}
    termos = cfg.get("termos", [])
    geo = cfg.get("geo", "BR")
    periodo = cfg.get("periodo", "today 1-m")
    out = {"geo": geo, "periodo": periodo, "termos": [], "emAlta": [], "avisos": []}
    if explorar is None or em_alta is None:
        try:
            import trendspyg
        except ImportError:
            out["avisos"].append("trendspyg ausente")
            return out
        explorar = explorar or (lambda termo: trendspyg.download_google_trends_explore(
            termo, geo=geo, timeframe=periodo, include_geo=False, max_retries=2, retry_wait=4.0))
        em_alta = em_alta or (lambda: trendspyg.download_google_trends_rss(geo=geo, output_format="dict", cache=False))
    inicio = time.monotonic()
    for termo in termos:
        if time.monotonic() - inicio > cfg.get("limiteSegundos", 300):
            out["avisos"].append("tempo do Google Trends esgotado; termos restantes ficam para amanhã")
            break
        try:
            env = explorar(termo)
            rel = env.get("related_queries") or {}
            pts = env.get("interest_over_time") or []
            out["termos"].append({
                "termo": termo,
                "subindo": [{"busca": q["query"], "valor": q.get("formatted_value") or q.get("value")} for q in rel.get("rising", [])[:8]],
                "top": [{"busca": q["query"], "valor": q.get("value")} for q in rel.get("top", [])[:8]],
                "interesse": [{"data": x["date"], "valor": x["value"]} for x in pts[-8:]]})
            log(f"  Google Trends: {termo}")
        except Exception as e:  # noqa: BLE001
            out["avisos"].append(f"Google Trends ({termo}): {e}")
    try:
        temas = dict(TEMAS_NOTICIA, **{t.lower(): 3 for t in termos})
        for t in em_alta() or []:
            nome = t.get("trend", "")
            if relevancia(nome, temas) >= 2:
                out["emAlta"].append({"assunto": nome, "trafego": t.get("traffic", ""), "publicado": t.get("published", "")})
    except Exception as e:  # noqa: BLE001
        out["avisos"].append(f"Google Trends em alta: {e}")
    return out


def coletar(fontes: dict, buscar: ip.Buscador, pasta: Path, hoje_: dt.date, log=print) -> dict:
    itens, avisos, vistos, titulos = [], [], set(), []
    por_tema = int(fontes.get("noticiasPorTema", 6))
    minimo = int(fontes.get("relevanciaMinima", 3))
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
                    sinal = v.sinal() + (f" · {str(v.vezes).replace('.', ',')}x a mediana do canal" if v.vezes >= 2 else "") \
                        + (" · alcance possivelmente pago" if ip.alcance_pago_provavel(v) else "")
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
                    # só notícia SOBRE o concorrente: nome no título e não publicada por ele
                    if n["date"] < corte7 or not menciona(nome, n["title"]) or menciona(nome, n["source"]):
                        continue
                    if repetida(n["title"], titulos) or not novo(n["url"]):
                        continue
                    titulos.append(palavras(n["title"]))
                    if True:
                        itens.append({"brandId": bid, "colecao": "compnews", "arquivo": "", "mediaType": "", "doc": {
                            "kind": "noticia", "competitorId": c["id"], "competitorName": nome, "title": n["title"],
                            "url": n["url"], "source": n["source"], "date": n["date"], "summary": "",
                            "origem": "coletor"}})
            except Exception as e:
                avisos.append(f"{nome} (notícias): {e}")

    # notícias do nicho e menções à marca (depois dos concorrentes: o que cita concorrente fica lá)
    for q in marca.get("noticias", []):
        try:
            marca_citada = q.get("tema") == "Marca citada"
            cands = [n for n in noticias(q["busca"], buscar) if n["date"] >= corte7]
            for n in cands:
                n["_rel"] = 99 if marca_citada else relevancia(n["title"], TEMAS_NOTICIA)
            cands.sort(key=lambda n: (n["_rel"], n["date"]), reverse=True)
            n_tema = 0
            for n in cands:
                if n_tema >= por_tema or n["_rel"] < minimo or repetida(n["title"], titulos) or not novo(n["url"]):
                    continue
                titulos.append(palavras(n["title"]))
                n_tema += 1
                n.pop("_rel")
                itens.append({"brandId": bid, "colecao": "news", "arquivo": "", "mediaType": "", "doc": dict(
                    n, tag=q.get("tema", ""), summary="", origem="coletor")})
            log(f"  notícias: {q['busca']}")
        except Exception as e:  # uma fonte com problema não derruba as outras
            avisos.append(f"Google Notícias ({q['busca']}): {e}")

    try:
        n = enriquecer_noticias(itens, log)
        log(f"  links reais e trechos: {n} notícias")
    except Exception as e:  # noqa: BLE001
        avisos.append(f"enriquecer notícias: {e}")
    return {"geradoEm": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
            "fonte": "coletor (GitHub Actions)", "itens": itens, "avisos": avisos,
            "arquivos": sorted({i["arquivo"] for i in itens if i["arquivo"]})}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Coleta gratuita de YouTube, Google Notícias e blogs.")
    ap.add_argument("--fontes", default=str(AQUI / "fontes.json"))
    ap.add_argument("--saida", default=str(AQUI.parent / "dados"))
    ap.add_argument("--sem-tendencias", action="store_true")
    ap.add_argument("--so-tendencias", action="store_true", help="só o Google Trends (passo separado, com prazo)")
    a = ap.parse_args(argv)
    fontes = json.loads(Path(a.fontes).read_text(encoding="utf-8"))
    pasta = Path(a.saida)
    pasta.mkdir(parents=True, exist_ok=True)
    if a.so_tendencias:
        t = tendencias(fontes)
        t["geradoEm"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
        (pasta / "tendencias.json").write_text(json.dumps(t, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Tendências: {len(t['termos'])} termos, {len(t['emAlta'])} assuntos em alta, avisos: {t['avisos']}")
        return 0
    velhas = set((pasta / "midia").glob("*")) if (pasta / "midia").exists() else set()
    r = coletar(fontes, ip.http_get, pasta, ip.hoje())
    # guarda só as capas usadas na coleta atual
    usadas = set(r["arquivos"])
    for f in velhas:
        if f.name not in usadas:
            f.unlink()
    (pasta / "coleta.json").write_text(json.dumps(r, ensure_ascii=False, indent=2), encoding="utf-8")
    if fontes.get("tendencias") and not a.sem_tendencias:
        t = tendencias(fontes)
        t["geradoEm"] = r["geradoEm"]
        (pasta / "tendencias.json").write_text(json.dumps(t, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Tendências: {len(t['termos'])} termos, {len(t['emAlta'])} assuntos em alta, avisos: {t['avisos']}")
    por = {}
    for i in r["itens"]:
        por[i["colecao"]] = por.get(i["colecao"], 0) + 1
    print(f"Coleta: {len(r['itens'])} itens {por}, {len(usadas)} capas, {len(r['avisos'])} avisos")
    for av in r["avisos"]:
        print("  aviso:", av)
    return 0


if __name__ == "__main__":
    sys.exit(main())
