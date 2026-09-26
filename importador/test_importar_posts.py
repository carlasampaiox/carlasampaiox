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
