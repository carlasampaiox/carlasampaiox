"""Capas de Reels públicos do Instagram, sem login e sem créditos.

Roda no GitHub Actions (a nuvem do Claude não acessa o Instagram). Lê os códigos
pedidos em `capas-pendentes.txt` (um link ou código de Reel por linha), abre a
página pública de incorporação de cada Reel, baixa a imagem de capa para
`dados/midia/ig-<código>.jpg` e registra o resultado em `dados/capas.json`.
A rotina do Claude sobe essas imagens para o Content Lab e liga cada uma à referência.

    python capas.py --pendentes capas-pendentes.txt --saida ../dados
"""
from __future__ import annotations

import argparse
import html
import json
import re
import sys
import time
import urllib.request
from pathlib import Path
from typing import Callable

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/128.0 Safari/537.36")
CODIGO = re.compile(r"(?:instagram\.com/(?:[\w.]+/)?(?:reels?|p|tv)/)?([A-Za-z0-9_-]{8,})/?")


def codigo(linha: str) -> str | None:
    linha = linha.strip()
    if not linha or linha.startswith("#"):
        return None
    m = CODIGO.search(linha)
    return m.group(1) if m else None


def baixar(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read(8_000_000)


def url_da_capa(pagina: str) -> str | None:
    """Imagem de capa na página de incorporação (ou og:image na página do Reel)."""
    padroes = [r'class="EmbeddedMediaImage"[^>]*?src="([^"]+)"', r'<img[^>]+class="EmbeddedMediaImage"[^>]*?src="([^"]+)"',
               r'property="og:image"\s+content="([^"]+)"', r'"display_url"\s*:\s*"([^"]+)"',
               r'"thumbnail_src"\s*:\s*"([^"]+)"']
    for p in padroes:
        m = re.search(p, pagina)
        if m:
            u = html.unescape(m.group(1))
            return json.loads(f'"{u}"') if "\\" in u else u
    return None


def e_imagem(dados: bytes) -> bool:
    return dados[:3] == b"\xff\xd8\xff" or dados[:8] == b"\x89PNG\r\n\x1a\n" or dados[8:12] == b"WEBP"


def buscar_capa(cod: str, get: Callable[[str], bytes] = baixar) -> bytes:
    erros = []
    for pagina in (f"https://www.instagram.com/p/{cod}/embed/captioned/", f"https://www.instagram.com/p/{cod}/embed/",
                   f"https://www.instagram.com/reel/{cod}/"):
        try:
            u = url_da_capa(get(pagina).decode("utf-8", "replace"))
            if not u:
                erros.append(f"{pagina}: sem imagem na página")
                continue
            img = get(u)
            if e_imagem(img):
                return img
            erros.append(f"{pagina}: resposta não é imagem")
        except Exception as e:  # noqa: BLE001  (rede, 4xx, 5xx: tenta a próxima página)
            erros.append(f"{pagina}: {e}")
    raise RuntimeError("; ".join(erros))


def rodar(pendentes: Path, saida: Path, get: Callable[[str], bytes] = baixar, pausa: float = 1.5,
          log: Callable[[str], None] = print) -> dict:
    midia = saida / "midia"
    midia.mkdir(parents=True, exist_ok=True)
    reg_path = saida / "capas.json"
    reg = json.loads(reg_path.read_text(encoding="utf-8")) if reg_path.is_file() else {"capas": {}, "falhas": {}}
    linhas = pendentes.read_text(encoding="utf-8").splitlines() if pendentes.is_file() else []
    for cod in dict.fromkeys(c for c in map(codigo, linhas) if c):
        arq = f"ig-{cod}.jpg"
        if (midia / arq).is_file():
            reg["capas"][cod] = arq
            continue
        try:
            (midia / arq).write_bytes(buscar_capa(cod, get))
            reg["capas"][cod] = arq
            reg["falhas"].pop(cod, None)
            log(f"ok {cod}")
        except Exception as e:  # noqa: BLE001
            reg["falhas"][cod] = str(e)[:300]
            log(f"falhou {cod}: {e}")
        time.sleep(pausa)
    reg_path.write_text(json.dumps(reg, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
    return reg


def main(argv: list[str] | None = None) -> int:
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("--pendentes", default="capas-pendentes.txt")
    a.add_argument("--saida", default="../dados")
    x = a.parse_args(argv)
    reg = rodar(Path(x.pendentes), Path(x.saida))
    print(f"{len(reg['capas'])} capas, {len(reg['falhas'])} falhas")
    return 0


if __name__ == "__main__":
    sys.exit(main())
