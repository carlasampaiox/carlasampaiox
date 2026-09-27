"""KPIs semanais do marketing: planilha "KPIs do Marketing" (aba Geral) para o Content Lab.

Cada coluna da planilha é uma semana. A data da coluna é o dia do preenchimento, e os
números são dos 7 dias anteriores (ex.: 21/09/2026 = semana de 14/09 a 20/09).
Cada semana vira um documento `brands/{marca}/metrics/kpi-AAAA-MM-DD` com os valores
de todos os canais, e a lista de métricas vira `brands/{marca}/insights/kpis`.

    python kpis.py --planilha KPIs.xlsx --saida saida/kpis

Precisa de `openpyxl` só para ler o .xlsx (pip install openpyxl).
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

# Blocos e linhas da aba Geral. tipo: "estoque" (total no dia, ex.: seguidores),
# "soma" (contagem da semana, soma entre semanas), "media" (contagem da semana que não se
# soma entre semanas, como alcance e usuários), "tempo" (segundos) ou "horas".
GRUPOS = [
    {"id": "instagram", "nome": "Instagram", "cor": "instagram", "titulo": "Instagram", "metricas": [
        ("seguidores", "Número atual de seguidores", "estoque"), ("novosSeguidores", "Novos seguidores", "soma"),
        ("posts", "Posts na semana", "soma"), ("stories", "Stories na semana", "soma"),
        ("cliquesLink", "Cliques no link", "soma"), ("interacoes", "Interações na semana", "soma"),
        ("visitasPerfil", "Visitas ao perfil", "soma"), ("alcance", "Alcance semanal", "media")]},
    {"id": "facebook", "nome": "Facebook", "cor": "facebook", "titulo": "Facebook", "metricas": [
        ("seguidores", "Seguidores", "estoque"), ("novasCurtidas", "Novas curtidas", "soma"),
        ("posts", "Posts na semana", "soma"), ("stories", "Stories na semana", "soma"),
        ("interacoes", "Interações na semana", "soma"), ("cliquesLink", "Cliques no link", "soma"),
        ("visitasPagina", "Visitas à página", "soma"), ("alcance", "Alcance semanal", "media")]},
    {"id": "youtube", "nome": "YouTube Mycapital", "cor": "youtube", "titulo": "Youtube Mycapital", "metricas": [
        ("inscritos", "Inscritos totais", "estoque"), ("novosInscritos", "Novos inscritos", "soma"),
        ("visualizacoes", "Visualizações na semana", "soma"), ("horas", "Tempo de exibição (horas)", "horas")]},
    {"id": "mycapitalks", "nome": "YouTube Mycapitalks", "cor": "podcast", "titulo": "Youtube Mycapitalks", "metricas": [
        ("inscritos", "Inscritos totais", "estoque"), ("novosInscritos", "Novos inscritos", "soma"),
        ("visualizacoes", "Visualizações na semana", "soma"), ("horas", "Tempo de exibição (horas)", "horas")]},
    {"id": "linkedin", "nome": "LinkedIn", "cor": "linkedin", "titulo": "Linkedin", "metricas": [
        ("seguidores", "Seguidores", "estoque"), ("posts", "Posts na semana", "soma"),
        ("impressoes", "Impressões", "soma"),
        ("viewsComputador", "Visualizações da página Computador", "soma"),
        ("viewsCelular", "Visualizações da página Celular", "soma"),
        ("visitantesComputador", "Visitantes únicos Computador", "soma"),
        ("visitantesCelular", "Visitantes únicos Celular", "soma")]},
    {"id": "blog", "nome": "Blog", "cor": "blog", "titulo": "Blog", "metricas": [
        ("artigos", "Artigos na semana", "soma"), ("usuarios", "Usuários", "media"),
        ("usuariosNovos", "Usuários novos", "soma"), ("tempoEngajamento", "Tempo de engaj.", "tempo")]},
    {"id": "site", "nome": "Site", "cor": "site", "titulo": "Site", "metricas": [
        ("usuarios", "Usuários", "media"), ("usuariosNovos", "Usuários novos", "soma"),
        ("tempoEngajamento", "Tempo de engaj.", "tempo")]},
]


def valor(bruto, tipo: str) -> tuple[float | int | None, bool]:
    """Converte uma célula em (número, aproximado). Vazio, "-" e texto sem número viram None.

    "37,6 mil" vira 37600 (aproximado, porque a planilha guardou arredondado).
    Tempo: 21'' vira 21 segundos; 1'20'' vira 80.
    """
    if bruto is None or isinstance(bruto, bool):
        return None, False
    if isinstance(bruto, (int, float)):
        if tipo == "tempo":  # número solto numa linha de tempo não é tempo (era taxa de rejeição)
            return None, False
        return (int(bruto) if float(bruto).is_integer() else round(float(bruto), 2)), False
    s = str(bruto).strip().replace("`", "").replace("´", "")
    if not s or s == "-":
        return None, False
    if tipo == "tempo":
        m = re.fullmatch(r"(?:(\d+)\s*['’:]\s*)?(\d+)\s*(?:''|\"|”|’’)?", s)
        if not m or not re.search(r"['\"’”:]", s):
            return None, False
        return int(m.group(1) or 0) * 60 + int(m.group(2)), False
    m = re.fullmatch(r"(\d+(?:[.,]\d+)?)\s*mil", s, flags=re.I)
    if m:
        return int(round(float(m.group(1).replace(",", ".")) * 1000)), True
    m = re.fullmatch(r"\d+(?:[.,]\d+)?", s)
    if m:
        v = float(s.replace(",", "."))
        return (int(v) if v.is_integer() else v), False
    return None, False


def config() -> dict:
    return {"tipo": "kpis", "frequencia": "semanal",
            "nota": "A data da semana é o dia do preenchimento; os números são dos 7 dias anteriores.",
            "grupos": [{"id": g["id"], "nome": g["nome"], "cor": g["cor"],
                        "metricas": [{"k": k, "l": l, "tipo": t} for k, l, t in g["metricas"]]} for g in GRUPOS]}


def semanas_da_grade(linhas: list[list], fontes: dict | None = None) -> tuple[dict, list[dict], list[str]]:
    """`linhas`: a aba como lista de linhas (coluna A = nome, B = fonte, C em diante = semanas).

    Devolve (config, semanas, avisos).
    """
    cab = linhas[0]
    datas = {}
    for i, d in enumerate(cab[2:], 2):
        if isinstance(d, dt.datetime):
            d = d.date()
        if isinstance(d, dt.date):
            datas[i] = d
    cfg, avisos = config(), []
    semanas: dict[str, dict] = {}
    grupo = None
    for linha in linhas[1:]:
        nome = str(linha[0] or "").strip()
        if not nome:
            continue
        g = next((x for x in GRUPOS if x["titulo"].lower() == nome.lower()), None)
        if g:
            grupo = g
            continue
        if not grupo:
            continue
        met = next(((k, t) for k, l, t in grupo["metricas"] if l.lower() == nome.lower()), None)
        if not met:
            if not nome.lower().startswith(("novos clientes", "total cancelamento")):  # clientes ficam fora (decisão da Carla)
                avisos.append(f"linha sem correspondência em {grupo['nome']}: {nome}")
            continue
        k, tipo = met
        cfg_m = next(m for gg in cfg["grupos"] if gg["id"] == grupo["id"] for m in gg["metricas"] if m["k"] == k)
        if len(linha) > 1 and linha[1]:
            cfg_m["fonte"] = str(linha[1]).strip()
        for i, d in datas.items():
            if i >= len(linha):
                continue
            v, aprox = valor(linha[i], tipo)
            if v is None:
                continue
            chave = d.isoformat()
            s = semanas.setdefault(chave, {"tipo": "kpi", "data": chave,
                                           "start": (d - dt.timedelta(days=7)).isoformat(),
                                           "end": (d - dt.timedelta(days=1)).isoformat(),
                                           "valores": {}, "origem": "planilha"})
            s["valores"].setdefault(grupo["id"], {})[k] = v
            if aprox:
                s.setdefault("aprox", {}).setdefault(grupo["id"], []).append(k)
    return cfg, [semanas[k] for k in sorted(semanas)], avisos


def ler_planilha(caminho: Path, aba: str = "Geral") -> list[list]:
    import openpyxl  # só para ler o .xlsx
    ws = openpyxl.load_workbook(caminho, data_only=True, read_only=True)[aba]
    return [list(r) for r in ws.iter_rows(values_only=True)]


def gravar(cfg: dict, semanas: list[dict], saida: Path, marca: str = "mycapital") -> list[Path]:
    """Arquivos para o ArtifactData: config, uma semana por arquivo e lotes de até 50 escritas."""
    (saida / "semanas").mkdir(parents=True, exist_ok=True)
    agora = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    (saida / "config.json").write_text(json.dumps(dict(cfg, atualizadoEm=agora), ensure_ascii=False, indent=1), encoding="utf-8")
    writes = [{"op": "set", "collection": f"brands/{marca}/insights", "doc_id": "kpis",
               "file_path": str((saida / "config.json").resolve())}]
    for s in semanas:
        f = saida / "semanas" / f"kpi-{s['data']}.json"
        f.write_text(json.dumps(dict(s, createdAt=agora), ensure_ascii=False), encoding="utf-8")
        writes.append({"op": "set", "collection": f"brands/{marca}/metrics", "doc_id": f"kpi-{s['data']}",
                       "file_path": str(f.resolve())})
    lotes = []
    for n in range(0, len(writes), 50):
        p = saida / f"lote-{n // 50 + 1:02d}.json"
        p.write_text(json.dumps(writes[n:n + 50], ensure_ascii=False), encoding="utf-8")
        lotes.append(p)
    return lotes


def main(argv: list[str] | None = None) -> int:
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument("--planilha", required=True)
    a.add_argument("--aba", default="Geral")
    a.add_argument("--marca", default="mycapital")
    a.add_argument("--saida", default="saida/kpis")
    x = a.parse_args(argv)
    cfg, semanas, avisos = semanas_da_grade(ler_planilha(Path(x.planilha), x.aba))
    lotes = gravar(cfg, semanas, Path(x.saida), x.marca)
    for av in avisos:
        print("aviso:", av)
    print(f"{len(semanas)} semanas ({semanas[0]['data']} a {semanas[-1]['data']}), {len(lotes)} lotes em {x.saida}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
