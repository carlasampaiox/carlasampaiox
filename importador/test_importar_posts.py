"""Testes do importador. Rode com: python3 -m unittest -v (dentro de importador/)."""
import datetime as dt
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import importar_posts as ip

REF = dt.date(2026, 9, 26)


class Utilidades(unittest.TestCase):
    def test_normalizar_link(self):
        n = ip.normalizar_link
        self.assertEqual(n("https://www.instagram.com/p/ABC/?igsh=x"), n("instagram.com/p/ABC"))
        self.assertEqual(n("https://www.instagram.com/reel/ABC/"), n("https://instagram.com/p/ABC/"))
        self.assertEqual(n("https://youtu.be/xyz"), "youtube.com/watch?v=xyz")
        self.assertEqual(n("https://m.youtube.com/watch?v=xyz&t=3"), "youtube.com/watch?v=xyz")
        self.assertEqual(n("https://www.youtube.com/shorts/xyz"), "youtube.com/watch?v=xyz")
        self.assertEqual(n(""), "")

    def test_usuario_instagram(self):
        u = ip.usuario_instagram
        self.assertEqual(u("@perfil.x"), "perfil.x")
        self.assertEqual(u("https://www.instagram.com/perfil_x/?hl=pt"), "perfil_x")
        self.assertEqual(u("instagram.com/perfil"), "perfil")
        self.assertEqual(u("https://www.instagram.com/p/ABC/"), "")
        self.assertEqual(u(""), "")
        self.assertEqual(u("nome com espaço"), "")

    def test_canal_youtube(self):
        c = ip.canal_youtube
        self.assertEqual(c("@canal"), {"handle": "@canal"})
        self.assertEqual(c("https://www.youtube.com/@canal/videos"), {"handle": "@canal"})
        self.assertEqual(c("https://youtube.com/channel/UC" + "a" * 22), {"id": "UC" + "a" * 22})
        self.assertEqual(c("https://youtube.com/user/fulano"), {"user": "fulano"})
        self.assertEqual(c(""), {})

    def test_duracao(self):
        self.assertEqual(ip.duracao_segundos("PT1H2M3S"), 3723)
        self.assertEqual(ip.duracao_segundos("PT45S"), 45)
        self.assertEqual(ip.duracao_segundos("P1DT1S"), 86401)
        self.assertEqual(ip.duracao_segundos("x"), 0)

    def test_gancho_e_limpeza(self):
        self.assertEqual(ip.gancho("#tag\n@alguem\nO erro que custa caro — veja"), "O erro que custa caro, veja")
        longo = "palavra " * 40
        g = ip.gancho(longo, 50)
        self.assertTrue(g.endswith("...") and len(g) <= 53)
        self.assertNotIn("—", ip.limpar("a — b – c"))
        self.assertNotIn("–", ip.limpar("a — b – c"))

    def test_tipo_video(self):
        self.assertEqual(ip.tipo_video(b"\x00\x00\x00\x18ftypmp42...."), "mp4")
        self.assertEqual(ip.tipo_video(b"\xff\xd8\xff"), "")

    def test_tipo_imagem(self):
        self.assertEqual(ip.tipo_imagem(b"\xff\xd8\xff\xe0abc"), "jpg")
        self.assertEqual(ip.tipo_imagem(b"\x89PNG\r\n\x1a\n...."), "png")
        self.assertEqual(ip.tipo_imagem(b"<html>"), "")


class Selecao(unittest.TestCase):
    def post(self, url, dias, likes, com=0):
        return ip.Post("instagram", "@x", url, (REF - dt.timedelta(days=dias)).isoformat(), "Reels", "t",
                       curtidas=likes, comentarios=com)

    def test_escolhe_melhores_da_janela_sem_repetir(self):
        ps = [self.post("https://instagram.com/p/a", 1, 10), self.post("https://instagram.com/p/b", 3, 500),
              self.post("https://instagram.com/p/c", 20, 99999), self.post("https://instagram.com/p/b/", 3, 500),
              self.post("https://instagram.com/p/d", 5, 100, 200)]
        r = ip.escolher(ps, 14, 2, REF)
        self.assertEqual([p.url for p in r], ["https://instagram.com/p/d", "https://instagram.com/p/b"])

    def test_exclui_links_ja_salvos_antes_de_ranquear(self):
        ps = [self.post("https://instagram.com/p/a", 1, 10), self.post("https://instagram.com/p/b", 1, 900)]
        r = ip.escolher(ps, 14, 1, REF, excluir={ip.normalizar_link("instagram.com/p/b")})
        self.assertEqual([p.url for p in r], ["https://instagram.com/p/a"])

    def test_sinal_so_com_numeros_reais(self):
        p = ip.Post("instagram", "@x", "u", "2026-09-20", "Reels", "t", curtidas=None, comentarios=12)
        self.assertEqual(p.sinal(), "12 comentários")
        y = ip.Post("youtube", "Canal", "u", "2026-09-20", "Shorts", "t", views=12345)
        self.assertEqual(y.sinal(), "12.345 visualizações")
        um = ip.Post("instagram", "@x", "u", "2026-09-20", "Reels", "t", curtidas=1, comentarios=1, views=1)
        self.assertEqual(um.sinal(), "1 visualização, 1 curtida, 1 comentário")


class Plano(unittest.TestCase):
    ESTADO = {"brands": [{"id": "m", "channels": {"instagram": {"handle": "@minha"}},
                          "competitors": [{"id": "a", "instagram": "@ativo"}, {"id": "p", "instagram": "@parado"},
                                          {"id": "n", "instagram": "@novo"}, {"id": "x", "instagram": ""}]}]}
    CONTROLE = {"perfis": {
        "minha": {"ultimaConsulta": "2026-09-20", "ultimoPost": "2026-09-18", "postsSemana": 1},
        "ativo": {"ultimaConsulta": "2026-09-24", "ultimoPost": "2026-09-24", "postsSemana": 4},
        "parado": {"ultimaConsulta": "2026-09-01", "ultimoPost": "2024-01-01", "postsSemana": 0}}}

    def test_nunca_consultado_vem_primeiro_e_respeita_limite_diario(self):
        r = ip.planejar(self.ESTADO, self.CONTROLE, 150, dt.date(2026, 10, 26), REF)
        self.assertEqual([c["handle"] for c in r["consultar"]], ["novo"])
        self.assertEqual(r["custoHoje"], 5)

    def test_reserva_bloqueia_consultas(self):
        r = ip.planejar(self.ESTADO, self.CONTROLE, 15, dt.date(2026, 10, 26), REF)
        self.assertEqual(r["consultar"], [])
        self.assertIn("reserva", r["motivo"])

    def test_pouco_credito_estica_intervalos(self):
        c = dict(self.CONTROLE, perfis=dict(self.CONTROLE["perfis"], novo={"ultimaConsulta": "2026-09-22", "postsSemana": 4, "ultimoPost": "2026-09-22"}))
        muito = ip.planejar(self.ESTADO, c, 150, dt.date(2026, 10, 26), REF)
        pouco = ip.planejar(self.ESTADO, c, 30, dt.date(2026, 10, 26), REF)
        self.assertGreater(pouco["fatorEconomia"], muito["fatorEconomia"])
        self.assertLessEqual(len(pouco["fila"]), len(muito["fila"]))

    def test_gasto_do_mes_cabe_no_plano_gratis(self):
        """Simula 30 dias: nunca passa de 150 créditos nem fica abaixo da reserva."""
        controle, saldo, gasto = {"perfis": {}}, 150, 0
        for d in range(30):
            dia = REF + dt.timedelta(days=d)
            r = ip.planejar(self.ESTADO, controle, saldo, REF + dt.timedelta(days=30), dia)
            for c in r["consultar"]:
                saldo -= 5
                gasto += 5
                ritmo = {"ativo": 4, "minha": 1, "novo": 2, "parado": 0}[c["handle"]]
                ult = "2024-01-01" if c["handle"] == "parado" else dia.isoformat()
                controle["perfis"][c["handle"]] = {"ultimaConsulta": dia.isoformat(), "ultimoPost": ult, "postsSemana": ritmo}
        self.assertLessEqual(gasto, 135)
        self.assertGreaterEqual(saldo, 15)
        self.assertEqual(len(controle["perfis"]), 4)

    def test_atualizar_controle(self):
        c = {}
        posts = [ip.Post("instagram", "@a", f"u{i}", (REF - dt.timedelta(days=i * 3)).isoformat(), "Reels", "t") for i in range(12)]
        ip.atualizar_controle(c, "A", posts, REF)
        self.assertEqual(c["perfis"]["a"]["ultimoPost"], REF.isoformat())
        self.assertEqual(c["perfis"]["a"]["postsSemana"], 2.5)  # 10 posts em 28 dias


class Vidiq(unittest.TestCase):
    TXT = """## @perfil — 2 reels

### AAA — 6.2K plays, 1.9K likes, 12 comments, 80s, posted 2026-09-24, pinned
https://www.instagram.com/reel/AAA/
> "Primeira linha — do gancho

resto..."

### BBB — 153 plays, 7 likes, 26s, posted 2026-09-23
https://www.instagram.com/reel/BBB/
> "Outro"

Reel AAA — 6235 plays — pinned
[Image: source: capa-a.jpg]
Reel BBB — 153 plays
[Image: source: capa-b.jpg]
"""

    def test_leitura(self):
        ps = ip.ler_vidiq_reels(self.TXT, Path("/base"))
        self.assertEqual(len(ps), 2)
        a, b = ps
        self.assertEqual((a.views, a.curtidas, a.comentarios, a.duracao, a.data), (6235, 1900, 12, 80, "2026-09-24"))
        self.assertEqual(a.sinal(), "6.235 visualizações, 1,9 mil curtidas, 12 comentários")
        self.assertEqual(a.titulo, "Primeira linha, do gancho")
        self.assertEqual(a.arquivo_local, "/base/capa-a.jpg")
        self.assertEqual(b.comentarios, 0)  # sem comentários na resposta = zero
        self.assertEqual(a.perfil, "@perfil")

    def test_numero_abreviado(self):
        self.assertEqual(ip.numero_abreviado("175.4K"), (175400, "175,4 mil"))
        self.assertEqual(ip.numero_abreviado("1.7M"), (1700000, "1,7 mi"))
        self.assertEqual(ip.numero_abreviado("42"), (42, "42"))


class Fluxo(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.pasta = Path(self.tmp.name)
        self.env = mock.patch.dict(os.environ, {"META_ACCESS_TOKEN": "t", "IG_USER_ID": "1", "YOUTUBE_API_KEY": "k"})
        self.env.start()

    def tearDown(self):
        self.env.stop()
        self.tmp.cleanup()

    def test_pacote_e_lote(self):
        pac = ip.montar_pacote(ip.ESTADO_EXEMPLO, ip.buscador_simulado(REF), self.pasta, ip.Config(), REF, log=lambda _: None)
        urls = [i["doc"]["url"] for i in pac["itens"]]
        # o link já salvo não volta
        self.assertNotIn("https://www.instagram.com/p/concorrentea1/", urls)
        # post de 20 dias atrás fica fora da janela de 14
        self.assertNotIn("https://www.instagram.com/p/concorrentea3/", urls)
        # 3 do Instagram + 3 do YouTube em compnews, 1 ref do Instagram
        cols = [i["colecao"] for i in pac["itens"]]
        self.assertEqual(cols.count("compnews"), 6)
        self.assertEqual(cols.count("refs"), 1)
        # perfil inexistente vira aviso, não quebra a execução
        self.assertTrue(any("naoexiste" in a for a in pac["avisos"]))
        # nada de travessão nos textos gerados
        texto = json.dumps([i["doc"] for i in pac["itens"]], ensure_ascii=False)
        self.assertNotIn("—", texto)
        self.assertNotIn(" – ", texto)
        # Reels chega como vídeo (Business Discovery não tem capa) e traz visualizações
        reels = [i for i in pac["itens"] if i["doc"].get("format") == "Reels"]
        self.assertTrue(reels and all(i["mediaType"] == "video" and i["arquivo"].endswith(".mp4") for i in reels))
        self.assertIn("visualizações", reels[0]["doc"]["signal"])
        # imagens baixadas
        for a in pac["arquivos"]:
            self.assertTrue((self.pasta / "midia" / a).is_file())

        aid = "0123456789abcdef0123456789abcdef"
        lote = ip.montar_lote(pac, {pac["arquivos"][0]: aid, pac["arquivos"][1]: "invalido"})
        self.assertEqual(len(lote), len(pac["itens"]))
        self.assertTrue(all(x["op"] == "set" and x["doc_id"].startswith("imp-") for x in lote))
        com_midia = [x for x in lote if "media" in x["data"]]
        self.assertTrue(com_midia and all(x["data"]["media"] == aid for x in com_midia))
        # id do documento é estável: rodar de novo não duplica
        self.assertEqual([x["doc_id"] for x in lote], [x["doc_id"] for x in ip.montar_lote(pac, {})])

    def test_sem_chaves_gera_avisos(self):
        with mock.patch.dict(os.environ, {"META_ACCESS_TOKEN": "", "YOUTUBE_API_KEY": ""}):
            pac = ip.montar_pacote(ip.ESTADO_EXEMPLO, ip.buscador_simulado(REF), self.pasta, ip.Config(), REF, log=lambda _: None)
        self.assertEqual(pac["itens"], [])
        self.assertGreaterEqual(len(pac["avisos"]), 2)

    def test_id_instagram_por_marca(self):
        with mock.patch.dict(os.environ, {"IG_USER_ID_MY_CAPITAL": "99"}):
            self.assertEqual(ip.id_instagram_da_marca({"id": "my-capital"}), "99")
        self.assertEqual(ip.id_instagram_da_marca({"id": "outra"}), "1")

    def test_montar_estado_do_dump(self):
        d = self.pasta / "dump"
        (d / "brands/mc/competitors").mkdir(parents=True)
        (d / "brands/mc/compnews").mkdir(parents=True)
        (d / "brands/mc.json").write_text(json.dumps({"name": "Mc", "channels": {}}))
        (d / "brands/mc/competitors/c1.json").write_text(json.dumps({"id": "c1", "version": 3, "data": {"name": "A", "instagram": "@a"}}))
        (d / "brands/mc/compnews/n1.json").write_text(json.dumps({"url": "https://instagram.com/p/x"}))
        e = ip.montar_estado(d)
        self.assertEqual(e["brands"][0]["id"], "mc")
        self.assertEqual(e["brands"][0]["competitors"][0]["instagram"], "@a")
        self.assertEqual(e["brands"][0]["existingLinks"], ["https://instagram.com/p/x"])

    def test_explicar_erro_da_meta(self):
        corpo = json.dumps({"error": {"message": "Invalid token", "code": 190}})
        self.assertIn("token da Meta", ip.explicar_erro(corpo, 400))


if __name__ == "__main__":
    unittest.main()
