"""Servidor local do protótipo MentCare (somente biblioteca padrão do Python).

Uso:
    python serve.py              -> http://localhost:8080  (apenas este computador)
    python serve.py --lan        -> também acessível por outros PCs da rede
    python serve.py --port 9000

Por que servir por http://localhost em vez de abrir o arquivo direto:
  - o localStorage fica numa origem estável (http://localhost:8080);
  - localhost é "contexto seguro", então crypto.subtle (hash de senha) funciona.
Acessar por http://<IP-da-rede> NÃO é contexto seguro: o cadastro/login de
contas criadas pelo usuário falha. Para testes em outro PC, use HTTPS ou
rode o servidor nele.
"""
import argparse
import http.server
import socket
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PAGE = "MentCare_V1.html"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def do_GET(self):
        if self.path in ("/", ""):
            self.path = "/" + PAGE
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8080)
    ap.add_argument("--lan", action="store_true", help="aceita conexões da rede local")
    ap.add_argument("--no-browser", action="store_true")
    args = ap.parse_args()

    host = "0.0.0.0" if args.lan else "127.0.0.1"
    srv = http.server.ThreadingHTTPServer((host, args.port), Handler)
    url = f"http://localhost:{args.port}"
    print(f"MentCare rodando em {url}  (Ctrl+C para parar)")
    if args.lan:
        ip = socket.gethostbyname(socket.gethostname())
        print(f"Rede local: http://{ip}:{args.port}  (atenção: sem HTTPS, contas novas não funcionam)")
    if not args.no_browser:
        webbrowser.open(url)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nEncerrado.")


if __name__ == "__main__":
    main()
