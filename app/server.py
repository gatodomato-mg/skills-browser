from __future__ import annotations

import json
import os
import re
import subprocess
import threading
import webbrowser
from html import unescape
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
UPSTREAM = "https://www.skills.sh"
GLOBAL_SKILLS = Path.home() / ".agents" / "skills"


def upstream(path: str, method: str = "GET", body: dict | None = None):
    data = None
    headers = {"Accept": "application/json", "User-Agent": "skills-browser-local/1.0"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = Request(UPSTREAM + path, data=data, headers=headers, method=method)
    with urlopen(req, timeout=30) as response:
        raw = response.read()
        return response.status, json.loads(raw.decode("utf-8"))


def installed_skills():
    if not GLOBAL_SKILLS.exists():
        return []
    items = []
    for folder in sorted(GLOBAL_SKILLS.iterdir(), key=lambda p: p.name.lower()):
        if not folder.is_dir():
            continue
        name = folder.name
        source = "origem não rastreada"
        skill_file = folder / "SKILL.md"
        if skill_file.exists():
            for line in skill_file.read_text(encoding="utf-8", errors="replace").splitlines():
                if line.lower().startswith("source:"):
                    source = line.split(":", 1)[1].strip()
                    break
        items.append({"name": name, "source": source, "agents": []})
    return items


def leaderboard_fallback(page: int, view: str):
    req = Request(UPSTREAM + "/", headers={"User-Agent": "skills-browser-local/1.0"})
    with urlopen(req, timeout=30) as response:
        html = unescape(response.read().decode("utf-8")).replace(r'\"', '"')
    match = re.search(r'"skills":(\[.*?\]),"page":(\d+),"total":(\d+),"hasMore":(true|false),"totalSkills":(\d+),"allTimeTotal":(\d+),"view":"([^"]+)"', html)
    if not match:
        raise RuntimeError("Não foi possível ler o ranking público")
    skills = json.loads(match.group(1))
    per_page = 50
    start = max(0, page) * per_page
    slice_skills = skills[start:start + per_page]
    total = int(match.group(3))
    return {
        "skills": slice_skills,
        "page": page,
        "total": total,
        "hasMore": start + len(slice_skills) < total,
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "SkillsBrowser/1.0"

    def send_json(self, status: int, payload):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        parsed = urlparse(self.path)
        try:
            if parsed.path == "/api/meta":
                try:
                    status, data = upstream("/api/meta")
                    return self.send_json(status, data)
                except Exception:
                    data = leaderboard_fallback(0, "all-time")
                    return self.send_json(200, {"totalSkills": data["total"], "allTimeTotal": data["total"]})
            if parsed.path == "/api/installed":
                return self.send_json(200, {"skills": installed_skills()})
            if parsed.path == "/api/leaderboard":
                query = parse_qs(parsed.query)
                view = query.get("view", ["all-time"])[0]
                page = int(query.get("page", ["0"])[0])
                try:
                    status, data = upstream(f"/api/leaderboard?view={quote(view)}&page={page}")
                    return self.send_json(status, data)
                except Exception:
                    data = leaderboard_fallback(page, view)
                    return self.send_json(200, data)
            if parsed.path == "/api/search":
                query = parse_qs(parsed.query)
                q = query.get("q", [""])[0]
                limit = query.get("limit", ["100"])[0]
                status, data = upstream(f"/api/search?q={quote(q)}&limit={quote(limit)}")
                return self.send_json(status, data)
            return self.serve_file(parsed.path)
        except Exception as exc:
            self.send_json(502, {"message": str(exc)})

    def do_POST(self):
        parsed = urlparse(self.path)
        length = int(self.headers.get("Content-Length", "0") or 0)
        payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        try:
            if parsed.path == "/api/descriptions":
                status, data = upstream("/api/descriptions", "POST", payload)
                return self.send_json(status, data)
            if parsed.path == "/api/install":
                source = str(payload["source"])
                skill_id = str(payload["skillId"])
                if payload.get("sourceType") == "well-known":
                    spec = f"https://{source}/"
                    command = f"npx skills add {spec} --skill {skill_id} -g -y"
                else:
                    command = f"npx skills add {source}@{skill_id} -g -y"
                return self.stream_command(command)
            if parsed.path == "/api/remove":
                name = str(payload["name"])
                return self.stream_command(f"npx skills remove {name} -g -y")
            return self.send_json(404, {"message": "Endpoint não encontrado"})
        except Exception as exc:
            self.send_json(502, {"message": str(exc)})

    def serve_file(self, path: str):
        rel = "index.html" if path in ("", "/") else path.lstrip("/")
        file_path = (ROOT / rel).resolve()
        if ROOT not in file_path.parents and file_path != ROOT:
            return self.send_json(403, {"message": "Acesso negado"})
        if not file_path.is_file():
            return self.send_json(404, {"message": "Arquivo não encontrado"})
        content_type = "text/html; charset=utf-8" if file_path.suffix == ".html" else "text/javascript; charset=utf-8" if file_path.suffix == ".js" else "text/css; charset=utf-8" if file_path.suffix == ".css" else "application/octet-stream"
        raw = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def stream_command(self, command: str):
        self.send_response(200)
        self.send_header("Content-Type", "application/octet-stream")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()

        shell = "npx.cmd" if os.name == "nt" else "npx"
        args = command.split(maxsplit=1)
        process = subprocess.Popen(
            [shell, *args[1].split()],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=Path.home(),
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        assert process.stdout is not None
        for line in process.stdout:
            self.wfile.write(line.encode("utf-8"))
            self.wfile.flush()
        code = process.wait()
        self.wfile.write(f"[[exit:{code}]]".encode("utf-8"))

    def log_message(self, format: str, *args):
        return


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 8765), Handler)
    threading.Timer(0.4, lambda: webbrowser.open("http://127.0.0.1:8765/")).start()
    print("Skills Browser em http://127.0.0.1:8765")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
