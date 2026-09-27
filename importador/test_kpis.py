"""Testes da conversão da planilha de KPIs (sem openpyxl)."""
import datetime as dt
import unittest

import kpis


class Valor(unittest.TestCase):
    def test_formatos(self):
        self.assertEqual(kpis.valor(7351, "estoque"), (7351, False))
        self.assertEqual(kpis.valor("37,6 mil", "soma"), (37600, True))
        self.assertEqual(kpis.valor("7,5mil ", "soma"), (7500, True))
        self.assertEqual(kpis.valor("10 mil", "soma"), (10000, True))
        self.assertEqual(kpis.valor(3.5, "horas"), (3.5, False))
        self.assertEqual(kpis.valor("`9", "soma"), (9, False))
        self.assertEqual(kpis.valor("-", "soma"), (None, False))
        self.assertEqual(kpis.valor(" ", "soma"), (None, False))
        self.assertEqual(kpis.valor("603/171", "soma"), (None, False))

    def test_tempo(self):
        self.assertEqual(kpis.valor("21''", "tempo"), (21, False))
        self.assertEqual(kpis.valor('54"', "tempo"), (54, False))
        self.assertEqual(kpis.valor("1'20''", "tempo"), (80, False))
        self.assertEqual(kpis.valor("1' 45\"", "tempo"), (105, False))
        self.assertEqual(kpis.valor(0.9023, "tempo"), (None, False))  # taxa de rejeição antiga: fica fora


class Grade(unittest.TestCase):
    def test_semanas(self):
        d1, d2 = dt.datetime(2026, 9, 14), dt.datetime(2026, 9, 21)
        linhas = [["Dado / Período", "Fonte", d1, d2, None],
                  ["Instagram", None, None, None],
                  ["Número atual de seguidores", "BM Insights", 7344, 7351],
                  ["Alcance semanal", "BM Insights - Resultados", "32,7 mil", "37,6 mil"],
                  [None],
                  ["Youtube Mycapitalks", None],
                  ["Visualizações na semana", "Analytics Youtube", 6, " "],
                  ["Blog", None],
                  ["Tempo de engaj.", "Google Analytics", 0.88, "21''"],
                  ["Novos clientes total acumulado mês", None, 605, "603/171"],
                  ["Linha nova", None, 1, 2]]
        cfg, sem, avisos = kpis.semanas_da_grade(linhas)
        self.assertEqual([s["data"] for s in sem], ["2026-09-14", "2026-09-21"])
        s = sem[1]
        self.assertEqual((s["start"], s["end"]), ("2026-09-14", "2026-09-20"))  # 7 dias antes do preenchimento
        self.assertEqual(s["valores"]["instagram"], {"seguidores": 7351, "alcance": 37600})
        self.assertEqual(s["aprox"], {"instagram": ["alcance"]})
        self.assertNotIn("mycapitalks", s["valores"])  # célula vazia não vira zero
        self.assertEqual(sem[0]["valores"]["mycapitalks"], {"visualizacoes": 6})
        self.assertEqual(s["valores"]["blog"], {"tempoEngajamento": 21})
        self.assertNotIn("blog", sem[0]["valores"])
        self.assertEqual(avisos, ["linha sem correspondência em Blog: Linha nova"])
        ig = next(g for g in cfg["grupos"] if g["id"] == "instagram")
        self.assertEqual(ig["metricas"][0]["fonte"], "BM Insights")
        self.assertEqual([g["id"] for g in cfg["grupos"]],
                         ["instagram", "facebook", "youtube", "mycapitalks", "linkedin", "blog", "site"])


if __name__ == "__main__":
    unittest.main()
