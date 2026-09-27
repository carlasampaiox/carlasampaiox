"""Seguidores e inscritos públicos dos concorrentes, sem login e sem créditos.

Roda no GitHub Actions (a nuvem do Claude não acessa essas redes). Para cada concorrente
de `fontes.json` lê a página pública do perfil no Instagram, no YouTube e no LinkedIn e
guarda o número em `dados/perfis.json`. Se uma leitura falhar, o último número bom fica,
com a data em que foi lido. A rotina diária do Claude grava isso no campo `audiencia`
de cada concorrente no Content Lab.

    python perfis.py --fontes fontes.json --saida ../dados
"""
from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import re
import sys
import time
import urllib.request
from pathlib import Path
from typing import Callable

UAS = ["facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
       "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"]

NUM = r"(\d[\d.,]*\s*(?:mil|mi|K|M|k|m)?)"
PADROES = {
    # a página de incorporação traz o JSON do perfil com aspas escapadas: \\"followers_count\\":28272
    "instagram": [r'followers_count\\*"\s*:\s*(\d+)', r'edge_followed_by\\*"\s*:\s*\{\\*"count\\*"\s*:\s*(\d+)',
                  NUM + r"\s*(?:Followers|followers|seguidores)"],
    "youtube": [NUM + r"\s*(?:subscribers|inscritos)"],
    "linkedin": [NUM + r"\s*(?:followers|seguidores)"],
}


def baixar(url: str, ua: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": ua, "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read(3_000_000).decode("utf-8", "replace")


def numero(txt: str) -> tuple[int, bool] | None:
    """'12,3 mil' ou '12.3K' = (12300, aproximado); '7.743' ou '7,743' = (7743, exato)."""
    s = txt.strip().replace("\xa0", " ")
    m = re.fullmatch(r"(\d[\d.,]*)\s*(mil|mi|K|M|k|m)?", s)
    if not m:
        return None
    n, suf = m.group(1), (m.group(2) or "").lower()
    if suf:
        v = float(n.replace(".", "").replace(",", ".")) if "," in n else float(n)
        mult = 1000 if suf in ("mil", "k") else 1_000_000
        return int(round(v * mult)), True
    if re.fullmatch(r"\d{1,3}([.,]\d{3})+", n):
        return int(re.sub(r"[.,]", "", n)), False
    if re.fullmatch(r"\d+", n):
        return int(n), False
    return None


def ler_numero(rede: str, pagina: str) -> tuple[int, bool] | None:
    texto = html.unescape(pagina)
    for p in PADROES[rede]:
        for m in re.finditer(p, texto):
            r = numero(m.group(1))
            if r and r[0] > 0:
                return r
    return None


def url_da_rede(rede: str, valor: str) -> str | None:
    v = (valor or "").strip()
    if not v:
        return None
    if rede == "instagram":
        h = re.sub(r"^https?://(www\.)?instagram\.com/", "", v).strip("/@ ").split("/")[0]
        return f"https://www.instagram.com/{h}/" if h else None
    if rede == "youtube":
        if re.fullmatch(r"UC[\w-]{22}", v):
            return f"https://www.youtube.com/channel/{v}"
        if v.startswith("@"):
            return f"https://www.youtube.com/{v}"
        return v if v.startswith("http") else "https://" + v.lstrip("/")
    if rede == "linkedin":
        return v if v.startswith("http") else "https://www." + v.lstrip("/").removeprefix("www.")
    return None


def paginas(rede: str, url: str) -> list[str]:
    """O Instagram costuma bloquear a página do perfil para servidores; a de incorporação é mais aberta."""
    if rede == "instagram":
        return [url + "embed/", url]
    return [url]


def ler_perfil(rede: str, url: str, get: Callable[[str, str], str]) -> tuple[int, bool]:
    erros = []
    for pagina, ua in ((p, u) for p in paginas(rede, url) for u in UAS):
        try:
            r = ler_numero(rede, get(pagina, ua))
            if r:
                return r
            erros.append(f"{pagina} {ua[:18]}: número não encontrado")
        except Exception as e:  # noqa: BLE001  (bloqueio, 4xx, rede: tenta outro agente)
            erros.append(f"{pagina} {ua[:18]}: {e}")
    raise RuntimeError("; ".join(erros))


def rodar(fontes: dict, saida: Path, get: Callable[[str, str], str] = baixar, hoje: str | None = None,
          pausa: float = 1.5, log: Callable[[str], None] = print) -> dict:
    hoje = hoje or dt.date.today().isoformat()
    caminho = saida / "perfis.json"
    reg = json.loads(caminho.read_text(encoding="utf-8")) if caminho.is_file() else {"perfis": {}}
    reg["falhas"] = {}
    for c in fontes.get("concorrentes", []):
        atual = reg["perfis"].setdefault(c["id"], {})
        for rede in ("instagram", "youtube", "linkedin"):
            url = url_da_rede(rede, c.get(rede, ""))
            if not url:
                continue
            try:
                n, aprox = ler_perfil(rede, url, get)
                atual[rede] = {"n": n, "aprox": aprox, "em": hoje, "url": url}
                log(f"ok {c.get('nome')} {rede}: {n}")
            except Exception as e:  # noqa: BLE001
                reg["falhas"][f"{c['id']}:{rede}"] = str(e)[:300]
                log(f"falhou {c.get('nome')} {rede}: {e}")
            time.sleep(pausa)
    reg["geradoEm"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    saida.mkdir(parents=True, exist_ok=True)
    caminho.write_text(json.dumps(reg, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
    return reg


def main(argv: list[str] | None = None) -> int:
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("--fontes", default="fontes.json")
    a.add_argument("--saida", default="../dados")
    x = a.parse_args(argv)
    reg = rodar(json.loads(Path(x.fontes).read_text(encoding="utf-8")), Path(x.saida))
    ok = sum(len(v) for v in reg["perfis"].values())
    print(f"{ok} números guardados, {len(reg['falhas'])} falhas nesta leitura")
    return 0


if __name__ == "__main__":
    sys.exit(main())
