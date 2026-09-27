"""Testes da leitura de seguidores públicos (sem internet)."""
import json
import tempfile
import unittest
from pathlib import Path

import perfis

IG = '<meta property="og:description" content="12,3 mil seguidores, 150 seguindo, 900 posts - Veja as fotos" />'
IG_EN = '<meta name="description" content="7,351 Followers, 10 Following, 1,200 Posts - See Instagram photos" />'
YT = '{"subscriberCountText":{"simpleText":"3,12 mil inscritos"}}'
IN = '<meta name="description" content="Kinvo | 7.743 seguidores no LinkedIn. App de investimentos">'


class Perfis(unittest.TestCase):
    def test_numero(self):
        self.assertEqual(perfis.numero("12,3 mil"), (12300, True))
        self.assertEqual(perfis.numero("12.3K"), (12300, True))
        self.assertEqual(perfis.numero("1,2 mi"), (1200000, True))
        self.assertEqual(perfis.numero("7.743"), (7743, False))
        self.assertEqual(perfis.numero("7,351"), (7351, False))
        self.assertEqual(perfis.numero("347"), (347, False))

    def test_paginas(self):
        self.assertEqual(perfis.ler_numero("instagram", IG), (12300, True))
        self.assertEqual(perfis.ler_numero("instagram", IG_EN), (7351, False))
        self.assertEqual(perfis.ler_numero("youtube", YT), (3120, True))
        self.assertEqual(perfis.ler_numero("linkedin", IN), (7743, False))
        self.assertIsNone(perfis.ler_numero("instagram", "<html>Login</html>"))

    def test_urls(self):
        self.assertEqual(perfis.url_da_rede("instagram", "Myprofitweb"), "https://www.instagram.com/Myprofitweb/")
        self.assertEqual(perfis.url_da_rede("instagram", "https://www.instagram.com/kinvoapp/"), "https://www.instagram.com/kinvoapp/")
        self.assertEqual(perfis.url_da_rede("youtube", "UC" + "a" * 22), "https://www.youtube.com/channel/UC" + "a" * 22)
        self.assertEqual(perfis.url_da_rede("youtube", "youtube.com/kinvoapp"), "https://youtube.com/kinvoapp")
        self.assertEqual(perfis.url_da_rede("linkedin", "linkedin.com/company/gorila"), "https://www.linkedin.com/company/gorila")

    def test_rodar_guarda_ultimo_bom(self):
        fontes = {"concorrentes": [{"id": "c1", "nome": "A", "instagram": "@a", "linkedin": "linkedin.com/company/a"}]}
        def get(url, ua):
            if "instagram" in url:
                return IG
            raise OSError("999")
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            (d / "perfis.json").write_text(json.dumps({"perfis": {"c1": {"linkedin": {"n": 500, "aprox": False, "em": "2026-09-20"}}}}))
            reg = perfis.rodar(fontes, d, get, hoje="2026-09-27", pausa=0, log=lambda _: None)
        self.assertEqual(reg["perfis"]["c1"]["instagram"]["n"], 12300)
        self.assertEqual(reg["perfis"]["c1"]["linkedin"], {"n": 500, "aprox": False, "em": "2026-09-20"})  # falhou: fica o último
        self.assertIn("c1:linkedin", reg["falhas"])


if __name__ == "__main__":
    unittest.main()
