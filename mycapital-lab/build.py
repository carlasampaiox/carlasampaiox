# Monta index.html do Mycapital Lab: shell.html daqui + app.js, app.css e demo.json do Content Lab + tema.css daqui
# O código é o mesmo do Content Lab; o que muda é a casca (logo, título), o tema e window.__LAB__ (marca única).
# Uso: python3 build.py           gera index.html
#      python3 build.py --check   só confere se index.html está atualizado (usado no CI)
import json, sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
LAB = AQUI.parent / 'content-lab'
LIMITE = 16 * 1024 * 1024  # limite de tamanho da página do artifact


def montar():
    ler = lambda p: p.read_text(encoding='utf-8')
    demo = json.loads(ler(LAB / 'demo.json'))
    demo = {k: v for k, v in demo.items() if not k.startswith('brands') or k == 'brands' or k.startswith('brands/mycapital/')}
    demo['brands'] = {k: v for k, v in demo.get('brands', {}).items() if k == 'mycapital'}
    return (ler(AQUI / 'shell.html')
            .replace('/*CSS*/', ler(LAB / 'app.css') + '\n' + ler(AQUI / 'tema.css'))
            .replace('/*DEMO*/', json.dumps(demo, ensure_ascii=False).replace('</', '<\\/'))
            .replace('/*JS*/', ler(LAB / 'app.js')))


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
