# Monta index.html a partir de shell.html + app.css + app.js + demo.json
# Uso: python3 build.py           gera index.html
#      python3 build.py --check   só confere se index.html está atualizado (usado no CI)
import json, sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
LIMITE = 16 * 1024 * 1024  # limite de tamanho da página do artifact


def montar():
    ler = lambda n: (AQUI / n).read_text(encoding='utf-8')
    demo = json.loads(ler('demo.json'))
    return (ler('shell.html')
            .replace('/*CSS*/', ler('app.css'))
            .replace('/*DEMO*/', json.dumps(demo, ensure_ascii=False).replace('</', '<\\/'))
            .replace('/*JS*/', ler('app.js')))


s = montar()
if len(s.encode()) > LIMITE:
    sys.exit('index.html passou de 16 MB, o limite do artifact')
destino = AQUI / 'index.html'
if '--check' in sys.argv:
    if not destino.exists() or destino.read_text(encoding='utf-8') != s:
        sys.exit('index.html desatualizado: rode python3 build.py e faça commit')
    print('index.html atualizado')
else:
    destino.write_text(s, encoding='utf-8')
    print('index.html gerado')
