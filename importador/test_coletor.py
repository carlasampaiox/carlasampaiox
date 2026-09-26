"""Testes do motor de coleta com feeds de exemplo (sem internet)."""
import datetime as dt
import tempfile
import unittest
from pathlib import Path

import coletor
import importar_posts as ip

HOJE = dt.date(2026, 9, 26)

YT = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <title>Canal Teste</title>
 <entry><yt:videoId>AAA</yt:videoId><title>Como declarar ações — guia</title>
  <link rel="alternate" href="https://www.youtube.com/watch?v=AAA"/><published>2026-09-20T10:00:00+00:00</published>
  <media:group><media:thumbnail url="https://i.ytimg.com/vi/AAA/hqdefault.jpg" width="480" height="360"/>
  <media:description>Descrição A</media:description>
  <media:community><media:starRating count="120" average="5.0" min="1" max="5"/><media:statistics views="9000"/></media:community></media:group></entry>
 <entry><yt:videoId>BBB</yt:videoId><title>Vídeo antigo</title>
  <link rel="alternate" href="https://www.youtube.com/watch?v=BBB"/><published>2026-06-01T10:00:00+00:00</published>
  <media:group><media:thumbnail url="https://i.ytimg.com/vi/BBB/hqdefault.jpg"/>
  <media:community><media:starRating count="3"/><media:statistics views="1000"/></media:community></media:group></entry>
 <entry><yt:videoId>CCC</yt:videoId><title>Short</title>
  <link rel="alternate" href="https://www.youtube.com/shorts/CCC"/><published>2026-09-22T10:00:00+00:00</published>
  <media:group><media:thumbnail url="https://i.ytimg.com/vi/CCC/hqdefault.jpg"/>
  <media:community><media:starRating count="10"/><media:statistics views="1500"/></media:community></media:group></entry>
</feed>"""

NEWS = """<?xml version="1.0"?><rss version="2.0"><channel><title>Google</title>
<item><title>Receita libera lote de restituição - InfoMoney</title><link>https://news.google.com/rss/articles/X1</link>
<pubDate>Thu, 24 Sep 2026 12:00:00 GMT</pubDate><source url="https://www.infomoney.com.br">InfoMoney</source></item>
<item><title>Receita libera novo lote de restituição hoje - Valor</title><link>https://news.google.com/rss/articles/X3</link>
<pubDate>Thu, 24 Sep 2026 13:00:00 GMT</pubDate><source url="https://valor.globo.com">Valor</source></item>
<item><title>Quanto rendem R$ 45 milhões da Mega-Sena - G1</title><link>https://news.google.com/rss/articles/X4</link>
<pubDate>Thu, 24 Sep 2026 13:00:00 GMT</pubDate><source url="https://g1.globo.com">G1</source></item>
<item><title>Conc lança recurso de imposto de renda - Exame</title><link>https://news.google.com/rss/articles/X5</link>
<pubDate>Thu, 24 Sep 2026 13:00:00 GMT</pubDate><source url="https://exame.com">Exame</source></item>
<item><title>Ibovespa cai com petróleo - Conc</title><link>https://news.google.com/rss/articles/X6</link>
<pubDate>Thu, 24 Sep 2026 13:00:00 GMT</pubDate><source url="https://conc.com">Conc</source></item>
<item><title>Notícia velha - Valor</title><link>https://news.google.com/rss/articles/X2</link>
<pubDate>Thu, 01 Jan 2026 12:00:00 GMT</pubDate><source url="https://valor.globo.com">Valor</source></item>
</channel></rss>"""

BLOG = """<?xml version="1.0"?><rss version="2.0"><channel><title>Blog</title>
<item><title>Agenda de dividendos de outubro</title><link>https://blog.exemplo/agenda</link>
<pubDate>Fri, 25 Sep 2026 12:00:00 GMT</pubDate><description>&lt;p&gt;Resumo do post&lt;/p&gt;</description></item>
</channel></rss>"""

FONTES = {"marca": {"id": "m", "noticias": [{"busca": "imposto de renda", "tema": "IR"}]},
          "concorrentes": [{"id": "c1", "nome": "Conc", "youtube": "UC" + "a" * 22,
                            "blogs": ["https://blog.exemplo/feed/"], "busca": "\"Conc\""},
                           {"id": "c2", "nome": "SemCanal", "youtube": "https://www.youtube.com/@naoexiste"}]}


def buscar(url: str) -> bytes:
    if "feeds/videos.xml" in url:
        return YT.encode()
    if "news.google.com" in url:
        return NEWS.encode()
    if url == "https://blog.exemplo/feed/":
        return BLOG.encode()
    if "i.ytimg.com" in url:
        return b"\xff\xd8\xff\xe0" + b"0" * 32
    if "@naoexiste" in url:
        return b"<html>sem canal</html>"
    raise ip.ErroAPI("não simulado: " + url)


class Coletor(unittest.TestCase):
    def test_coleta(self):
        with tempfile.TemporaryDirectory() as d:
            r = coletor.coletar(FONTES, buscar, Path(d), HOJE, log=lambda _: None)
            cols = [i["colecao"] for i in r["itens"]]
            # notícia recente do nicho entra, a velha não; a mesma notícia não se repete no concorrente
            news = [i["doc"] for i in r["itens"] if i["colecao"] == "news"]
            # só relevantes e sem repetir o mesmo fato: a restituição entra 1 vez, Mega-Sena e velha ficam fora
            titulos = [n["title"] for n in news]
            self.assertEqual(sum("restituição" in t for t in titulos), 1)
            self.assertFalse(any("Mega-Sena" in t or "velha" in t for t in titulos))
            self.assertIn(news[0]["source"], ("InfoMoney", "Valor"))
            # notícia do concorrente: menciona o nome e não foi publicada por ele
            sobre = [i["doc"]["title"] for i in r["itens"] if i["doc"].get("kind") == "noticia"]
            self.assertEqual(sobre, ["Conc lança recurso de imposto de renda"])
            self.assertEqual(news[0]["tag"], "IR")
            # YouTube: só vídeos de 30 dias, com números do RSS e capa baixada
            yt = [i for i in r["itens"] if i["doc"].get("channel") == "youtube"]
            self.assertEqual([i["doc"]["url"] for i in yt],
                             ["https://www.youtube.com/watch?v=AAA", "https://www.youtube.com/watch?v=CCC"])
            self.assertIn("9.000 visualizações, 120 curtidas", yt[0]["doc"]["signal"])
            self.assertNotIn("—", yt[0]["doc"]["title"])
            self.assertEqual(yt[1]["doc"]["format"], "Shorts")
            self.assertTrue(all((Path(d) / "midia" / i["arquivo"]).is_file() for i in yt))
            # blog vira conteúdo do concorrente, com resumo sem HTML
            bl = [i["doc"] for i in r["itens"] if i["doc"].get("channel") == "blog"]
            self.assertEqual(bl[0]["summary"], "Resumo do post")
            # canal não encontrado vira aviso
            self.assertTrue(any("SemCanal" in a for a in r["avisos"]))
            self.assertIn("compnews", cols)

    def test_resolver_canal(self):
        self.assertEqual(coletor.resolver_canal("UC" + "b" * 22, buscar), "UC" + "b" * 22)
        html = b'... "channelId":"UC' + b"c" * 22 + b'" ...'
        self.assertEqual(coletor.resolver_canal("@canal", lambda u: html), "UC" + "c" * 22)


class Enriquecer(unittest.TestCase):
    def test_link_real_e_trecho(self):
        itens = [{"brandId": "m", "colecao": "news", "doc": {"url": "https://news.google.com/rss/articles/A"}},
                 {"brandId": "m", "colecao": "news", "doc": {"url": "https://news.google.com/rss/articles/B"}},
                 {"brandId": "m", "colecao": "news", "doc": {"url": "https://site.com/c"}}]
        dec = lambda urls: [{"success": True, "decoded_url": "https://valor.com/a"}, {"success": False, "message": "x"}]
        txt = lambda u: "Metade dos investidores atrasa o imposto de renda da bolsa, diz a pesquisa. Segunda frase com detalhes do estudo. Terceira."
        n = coletor.enriquecer_noticias(itens, lambda _: None, dec, txt)
        self.assertEqual(n, 1)
        self.assertEqual(itens[0]["doc"]["url"], "https://valor.com/a")
        self.assertEqual(itens[0]["aliases"], ["https://news.google.com/rss/articles/A"])
        self.assertTrue(itens[0]["contexto"].startswith("Metade dos investidores"))
        self.assertNotIn("Terceira", itens[0]["contexto"])
        self.assertEqual(itens[1]["doc"]["url"], "https://news.google.com/rss/articles/B")  # falhou: mantém

    def test_tendencias(self):
        env = {"related_queries": {"rising": [{"query": "isenção 60 mil ações", "formatted_value": "+450%"}],
                                   "top": [{"query": "ir ações", "value": 100}]},
               "interest_over_time": [{"date": "2026-09-20", "value": 70}]}
        def explorar(termo):
            if termo == "quebrado":
                raise RuntimeError("429")
            return env
        em_alta = lambda: [{"trend": "restituição imposto de renda", "traffic": "20 mil+"}, {"trend": "futebol hoje", "traffic": "1 mi+"}]
        t = coletor.tendencias({"tendencias": {"termos": ["imposto de renda", "quebrado"]}}, lambda _: None, explorar, em_alta)
        self.assertEqual(t["termos"][0]["subindo"][0], {"busca": "isenção 60 mil ações", "valor": "+450%"})
        self.assertEqual([x["assunto"] for x in t["emAlta"]], ["restituição imposto de renda"])
        self.assertTrue(any("quebrado" in a for a in t["avisos"]))


if __name__ == "__main__":
    unittest.main()
