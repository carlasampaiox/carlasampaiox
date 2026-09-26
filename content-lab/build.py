# Monta index.html a partir de shell.html + app.css + app.js + demo.json
import json
s=open('shell.html').read(); demo=json.load(open('demo.json'))
s=s.replace('/*CSS*/',open('app.css').read()).replace('/*DEMO*/',json.dumps(demo,ensure_ascii=False).replace('</','<\\/')).replace('/*JS*/',open('app.js').read())
open('index.html','w').write(s); print('index.html gerado')
