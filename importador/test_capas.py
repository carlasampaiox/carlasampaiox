"""Testes das capas de Reels (sem internet)."""
import json
import tempfile
import unittest
from pathlib import Path

import capas

JPG = b"\xff\xd8\xff\xe0" + b"0" * 32
EMBED = '<div><img class="EmbeddedMediaImage" alt="x" src="https://scontent.cdninstagram.com/v/a.jpg?x=1&amp;y=2" /></div>'
REEL = '<script>{"display_url":"https:\\/\\/scontent.cdninstagram.com\\/v\\/b.jpg"}</script>'


class Capas(unittest.TestCase):
    def test_codigo(self):
        self.assertEqual(capas.codigo("https://www.instagram.com/reel/DczS-mgtF3g/"), "DczS-mgtF3g")
        self.assertEqual(capas.codigo("https://instagram.com/perfil/p/DdHhbprhDQ0"), "DdHhbprhDQ0")
        self.assertEqual(capas.codigo("Dc8ywUMxL2c"), "Dc8ywUMxL2c")
        self.assertIsNone(capas.codigo("# comentário"))

    def test_url_da_capa(self):
        self.assertEqual(capas.url_da_capa(EMBED), "https://scontent.cdninstagram.com/v/a.jpg?x=1&y=2")
        self.assertEqual(capas.url_da_capa(REEL), "https://scontent.cdninstagram.com/v/b.jpg")
        self.assertIsNone(capas.url_da_capa("<html>login</html>"))

    def test_rodar(self):
        def get(u):
            if "AAAAAAAAAA/embed/captioned" in u:
                return EMBED.encode()
            if "BBBBBBBBBB/embed" in u:
                return b"<html>login</html>"
            if "BBBBBBBBBB" in u:
                return REEL.encode()
            if "cdninstagram" in u:
                return JPG
            raise OSError("403")
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "pend.txt"
            p.write_text("https://www.instagram.com/reel/AAAAAAAAAA/\nBBBBBBBBBB\nCCCCCCCCCC\n\nAAAAAAAAAA\n")
            reg = capas.rodar(p, Path(d), get, pausa=0, log=lambda _: None)
            self.assertEqual(reg["capas"], {"AAAAAAAAAA": "ig-AAAAAAAAAA.jpg", "BBBBBBBBBB": "ig-BBBBBBBBBB.jpg"})
            self.assertIn("CCCCCCCCCC", reg["falhas"])
            self.assertEqual((Path(d) / "midia" / "ig-AAAAAAAAAA.jpg").read_bytes(), JPG)
            self.assertEqual(json.loads((Path(d) / "capas.json").read_text())["capas"], reg["capas"])


if __name__ == "__main__":
    unittest.main()
