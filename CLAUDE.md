# Repositório da Carla

- `content-lab/`: a central de conteúdo publicada como artifact. Leia `content-lab/CLAUDE.md` antes de mexer.
- `importador/`: script que importa posts com prévia (Instagram e YouTube) para o Content Lab. Leia `importador/README.md`.

Regras: responder em português do Brasil, nunca usar travessão nem meia-risca como pontuação, não inventar números, nunca guardar chaves no repositório nem no artifact (só em `.env` local ou nas variáveis do ambiente).

Antes de cada commit: `python3 -m unittest` em `importador/`, `python3 build.py --check` e `node --check app.js` em `content-lab/`.
