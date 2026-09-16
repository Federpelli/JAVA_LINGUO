"""Avvia JAVA_linguo e il laboratorio Docker isolato usando Python standard."""

from __future__ import annotations

import argparse
import hmac
import json
import math
import os
import re
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import uuid
import webbrowser
from collections import deque
from http import HTTPStatus
from http.cookies import CookieError, SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist" / "client"
VERSION_FILE = ROOT / "VERSION"
DEFAULT_REPOSITORY = "https://github.com/Federpelli/JAVA_LINGUO"
LEGACY_SANDBOX_IMAGE = "eclipse-temurin:25-jdk"
DEFAULT_SANDBOX_IMAGE = (
    "eclipse-temurin:25-jdk@"
    "sha256:e787e08ef76f4c16866108cd7f9fcd96a68eef3ac6cc76866897d4d02d5a2262"
)
MAX_REQUEST_BYTES = 64_000
MAX_CODE_CHARACTERS = 30_000
MAX_OUTPUT_BYTES = 20_000
RUN_TIMEOUT_SECONDS = 12
REQUEST_TIMEOUT_SECONDS = 15
MAX_CONCURRENT_RUNS = 1
RATE_LIMIT_REQUESTS = 12
RATE_LIMIT_WINDOW_SECONDS = 60
SESSION_COOKIE_NAME = "java_linguo_session"
SANDBOX_USER = "65532:65532"
WINDOWS_CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
LAB_API_TOKEN = secrets.token_urlsafe(32)
IMAGE_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/:@-]{0,199}$")
PINNED_IMAGE_PATTERN = re.compile(r"^.+@sha256:[0-9a-f]{64}$")
ALLOWED_COMMANDS = {
    "java --version": ("java", "--version"),
    "javac Main.java": ("javac", "Main.java"),
    "java Main.java": ("java", "Main.java"),
}
SECURITY_HEADERS = {
    "Content-Security-Policy": (
        "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; "
        "form-action 'self'; script-src 'self' 'unsafe-inline'; script-src-attr 'none'; "
        "style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; "
        "connect-src 'self'; manifest-src 'self'"
    ),
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-Permitted-Cross-Domain-Policies": "none",
}

_rate_limit_timestamps: deque[float] = deque()
_rate_limit_lock = threading.Lock()
_sandbox_slots = threading.BoundedSemaphore(MAX_CONCURRENT_RUNS)


def quiet_subprocess_options() -> dict[str, int]:
    """Evita finestre console temporanee quando il backend desktop avvia un comando."""
    return {"creationflags": WINDOWS_CREATE_NO_WINDOW} if os.name == "nt" else {}


def load_environment() -> None:
    env_file = ROOT / ".env"
    if not env_file.exists():
        return
    for raw_line in env_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def app_version() -> str:
    try:
        return VERSION_FILE.read_text(encoding="utf-8").strip()
    except OSError:
        return "dev"


def sandbox_image() -> str:
    image = os.getenv("JAVA_SANDBOX_IMAGE", DEFAULT_SANDBOX_IMAGE).strip()
    if image == LEGACY_SANDBOX_IMAGE:
        return DEFAULT_SANDBOX_IMAGE
    return image if IMAGE_PATTERN.fullmatch(image) else DEFAULT_SANDBOX_IMAGE


def image_is_pinned(image: str) -> bool:
    return PINNED_IMAGE_PATTERN.fullmatch(image) is not None


def ensure_build() -> None:
    if (DIST / "index.html").exists():
        return
    print("Prima compilazione dell'interfaccia in corso…")
    npm = "npm.cmd" if os.name == "nt" else "npm"
    result = subprocess.run(
        [npm, "run", "build"],
        cwd=ROOT,
        check=False,
        **quiet_subprocess_options(),
    )
    if result.returncode != 0 or not (DIST / "index.html").exists():
        raise RuntimeError("Esegui 'npm install' e poi 'npm run build'.")


def choose_port(preferred: int) -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        try:
            probe.bind(("127.0.0.1", preferred))
            return preferred
        except OSError:
            probe.bind(("127.0.0.1", 0))
            return int(probe.getsockname()[1])


def valid_port(value: str) -> int:
    """Converte una porta CLI, accettando 0 per l'assegnazione automatica."""
    try:
        port = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("la porta deve essere un numero intero") from error
    if not 0 <= port <= 65535:
        raise argparse.ArgumentTypeError("la porta deve essere compresa tra 0 e 65535")
    return port


def parse_arguments(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Avvia JAVA_linguo in locale.")
    parser.add_argument(
        "--desktop",
        action="store_true",
        help="modalità sidecar: non apre il browser e non attende input in caso di errore",
    )
    parser.add_argument(
        "--port",
        type=valid_port,
        help="porta locale esatta; usa 0 per farla scegliere al sistema operativo",
    )
    return parser.parse_args(argv)


def normalized_command(command: str) -> str:
    return " ".join(command.strip().split())


def command_arguments(command: str) -> tuple[str, ...]:
    normalized = normalized_command(command)
    try:
        return ALLOWED_COMMANDS[normalized]
    except KeyError as error:
        raise ValueError(
            "Comando non consentito. Usa: java --version, javac Main.java o java Main.java."
        ) from error


def host_is_allowed(host_header: str, server_port: int) -> bool:
    if not host_header:
        return False
    try:
        parsed = urlparse(f"//{host_header}")
        port = parsed.port
    except ValueError:
        return False
    return (
        parsed.username is None
        and parsed.password is None
        and parsed.path == ""
        and parsed.hostname in {"127.0.0.1", "localhost"}
        and port == server_port
    )


def origin_is_allowed(origin: str, server_port: int) -> bool:
    return origin in {
        f"http://127.0.0.1:{server_port}",
        f"http://localhost:{server_port}",
    }


def session_cookie_is_valid(cookie_header: str) -> bool:
    if not cookie_header:
        return False
    cookies = SimpleCookie()
    try:
        cookies.load(cookie_header)
    except CookieError:
        return False
    morsel = cookies.get(SESSION_COOKIE_NAME)
    return morsel is not None and hmac.compare_digest(morsel.value, LAB_API_TOKEN)


def rate_limit_allows_request(now: float | None = None) -> tuple[bool, int]:
    current = time.monotonic() if now is None else now
    cutoff = current - RATE_LIMIT_WINDOW_SECONDS
    with _rate_limit_lock:
        while _rate_limit_timestamps and _rate_limit_timestamps[0] <= cutoff:
            _rate_limit_timestamps.popleft()
        if len(_rate_limit_timestamps) >= RATE_LIMIT_REQUESTS:
            retry_after = math.ceil(
                RATE_LIMIT_WINDOW_SECONDS - (current - _rate_limit_timestamps[0])
            )
            return False, max(1, retry_after)
        _rate_limit_timestamps.append(current)
    return True, 0


def reset_rate_limit() -> None:
    """Azzera il contatore globale; usato all'avvio e dai test."""
    with _rate_limit_lock:
        _rate_limit_timestamps.clear()


def docker_status(image: str) -> tuple[bool, str]:
    docker = shutil.which("docker")
    if docker is None:
        return False, "Docker non è installato o non è presente nel PATH."
    try:
        daemon = subprocess.run(
            [docker, "info", "--format", "{{.ServerVersion}}"],
            capture_output=True,
            text=True,
            timeout=4,
            check=False,
            **quiet_subprocess_options(),
        )
    except (OSError, subprocess.TimeoutExpired):
        return False, "Docker non risponde. Avvia Docker Desktop e riprova."
    if daemon.returncode != 0:
        return False, "Docker Desktop non è in esecuzione."
    try:
        image_check = subprocess.run(
            [docker, "image", "inspect", image],
            capture_output=True,
            text=True,
            timeout=4,
            check=False,
            **quiet_subprocess_options(),
        )
    except (OSError, subprocess.TimeoutExpired):
        return False, "Non è stato possibile verificare l'immagine Java."
    if image_check.returncode != 0:
        return False, f"Immagine assente. Esegui: docker pull {image}"
    pin_status = "immagine fissata" if image_is_pinned(image) else "immagine personalizzata"
    return True, f"Docker {daemon.stdout.strip()} · utente non-root · {pin_status}"


def build_docker_command(
    source_file: Path,
    command: str,
    container_name: str,
    image: str,
) -> list[str]:
    docker = shutil.which("docker") or "docker"
    source_mount = (
        f"type=bind,source={source_file.resolve()},target=/workspace/Main.java,readonly"
    )
    return [
        docker,
        "run",
        "--name",
        container_name,
        "--rm",
        "--network",
        "none",
        "--memory",
        "256m",
        "--memory-swap",
        "256m",
        "--cpus",
        "1",
        "--pids-limit",
        "64",
        "--read-only",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges=true",
        "--user",
        SANDBOX_USER,
        "--ipc",
        "none",
        "--ulimit",
        "nofile=256:256",
        "--pull",
        "never",
        "--init",
        "--tmpfs",
        "/tmp:rw,nosuid,nodev,noexec,size=32m,mode=1777",
        "--tmpfs",
        "/workspace:rw,nosuid,nodev,size=32m,mode=1777",
        "--mount",
        source_mount,
        "--workdir",
        "/workspace",
        "--env",
        "HOME=/tmp",
        image,
        *command_arguments(command),
    ]


def force_remove_container(container_name: str) -> None:
    docker = shutil.which("docker") or "docker"
    try:
        subprocess.run(
            [docker, "rm", "--force", container_name],
            capture_output=True,
            timeout=4,
            check=False,
            **quiet_subprocess_options(),
        )
    except (OSError, subprocess.SubprocessError):
        pass


def run_docker_process(
    docker_command: list[str],
    container_name: str,
) -> tuple[int, str, bool, bool]:
    process = subprocess.Popen(
        docker_command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        **quiet_subprocess_options(),
    )
    captured = bytearray()
    output_limit_reached = threading.Event()

    def read_bounded_output() -> None:
        if process.stdout is None:
            return
        while True:
            chunk = process.stdout.read(4096)
            if not chunk:
                break
            remaining = MAX_OUTPUT_BYTES - len(captured)
            if remaining > 0:
                captured.extend(chunk[:remaining])
            if len(chunk) > remaining and not output_limit_reached.is_set():
                output_limit_reached.set()
                force_remove_container(container_name)

    reader = threading.Thread(target=read_bounded_output, daemon=True)
    reader.start()
    timed_out = False
    try:
        return_code = process.wait(timeout=RUN_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        timed_out = True
        force_remove_container(container_name)
        try:
            return_code = process.wait(timeout=4)
        except subprocess.TimeoutExpired:
            process.kill()
            return_code = process.wait(timeout=2)
    reader.join(timeout=2)

    output = bytes(captured).decode("utf-8", errors="replace").strip()
    if timed_out:
        notice = f"Esecuzione interrotta dopo {RUN_TIMEOUT_SECONDS} secondi."
    elif output_limit_reached.is_set():
        notice = f"Output interrotto al limite di {MAX_OUTPUT_BYTES} byte."
        return_code = 125
    else:
        notice = ""
    if notice:
        output = f"{output}\n\n{notice}".strip()
    return return_code, output, timed_out, output_limit_reached.is_set()


def run_in_sandbox(code: str, command: str, image: str) -> dict[str, object]:
    if len(code) > MAX_CODE_CHARACTERS:
        raise ValueError(f"Il file supera il limite di {MAX_CODE_CHARACTERS} caratteri.")
    normalized = normalized_command(command)
    command_arguments(normalized)
    ready, reason = docker_status(image)
    if not ready:
        raise RuntimeError(reason)

    container_name = f"java-linguo-{uuid.uuid4().hex[:12]}"
    started = time.monotonic()
    with tempfile.TemporaryDirectory(prefix="java-linguo-lab-") as temporary:
        source_file = Path(temporary) / "Main.java"
        source_file.write_text(code, encoding="utf-8")
        docker_command = build_docker_command(source_file, normalized, container_name, image)
        return_code, output, timed_out, _ = run_docker_process(
            docker_command,
            container_name,
        )
        if not output:
            output = "Comando completato senza output."
        return {
            "ok": return_code == 0 and not timed_out,
            "command": normalized,
            "exitCode": 124 if timed_out else return_code,
            "durationMs": round((time.monotonic() - started) * 1000),
            "output": output,
        }


class AppHandler(SimpleHTTPRequestHandler):
    server_version = "JAVALinguo"
    sys_version = ""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST), **kwargs)

    def setup(self) -> None:
        super().setup()
        self.connection.settimeout(REQUEST_TIMEOUT_SECONDS)

    def end_headers(self) -> None:
        for name, value in SECURITY_HEADERS.items():
            self.send_header(name, value)
        super().end_headers()

    def send_json(
        self,
        payload: dict[str, object],
        status: HTTPStatus = HTTPStatus.OK,
        extra_headers: dict[str, str] | None = None,
    ) -> None:
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status.value)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(encoded)))
        for name, value in (extra_headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(encoded)

    def request_host_is_allowed(self) -> bool:
        return host_is_allowed(self.headers.get("Host", ""), self.server.server_port)

    def do_HEAD(self) -> None:  # noqa: N802
        if not self.request_host_is_allowed():
            self.send_error(HTTPStatus.MISDIRECTED_REQUEST, "Host non consentito")
            return
        super().do_HEAD()

    def do_GET(self) -> None:  # noqa: N802
        if not self.request_host_is_allowed():
            self.send_error(HTTPStatus.MISDIRECTED_REQUEST, "Host non consentito")
            return
        if urlparse(self.path).path == "/app-config.json":
            image = sandbox_image()
            self.send_json(
                {
                    "appVersion": app_version(),
                    "githubRepositoryUrl": os.getenv("GITHUB_REPOSITORY_URL", DEFAULT_REPOSITORY),
                    "labSandbox": {
                        "available": False,
                        "message": "La sandbox verrà verificata quando apri il laboratorio.",
                        "image": image,
                        "commands": list(ALLOWED_COMMANDS),
                    },
                },
                extra_headers={
                    "Set-Cookie": (
                        f"{SESSION_COOKIE_NAME}={LAB_API_TOKEN}; "
                        "Path=/api/lab; HttpOnly; SameSite=Strict"
                    )
                },
            )
            return
        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        if not self.request_host_is_allowed():
            self.send_json(
                {"ok": False, "error": "Host non consentito."},
                HTTPStatus.MISDIRECTED_REQUEST,
            )
            return
        request_path = urlparse(self.path).path
        if request_path not in {"/api/lab/command", "/api/lab/status"}:
            self.send_json({"ok": False, "error": "Endpoint non trovato."}, HTTPStatus.NOT_FOUND)
            return
        if not origin_is_allowed(self.headers.get("Origin", ""), self.server.server_port):
            self.send_json({"ok": False, "error": "Origine non consentita."}, HTTPStatus.FORBIDDEN)
            return
        allowed, retry_after = rate_limit_allows_request()
        if not allowed:
            self.send_json(
                {"ok": False, "error": "Troppe esecuzioni. Attendi e riprova."},
                HTTPStatus.TOO_MANY_REQUESTS,
                extra_headers={"Retry-After": str(retry_after)},
            )
            return
        if not session_cookie_is_valid(self.headers.get("Cookie", "")):
            self.send_json({"ok": False, "error": "Sessione non valida."}, HTTPStatus.FORBIDDEN)
            return
        if self.headers.get_content_type() != "application/json":
            self.send_json({"ok": False, "error": "Invia dati JSON."}, HTTPStatus.UNSUPPORTED_MEDIA_TYPE)
            return
        if self.headers.get("Transfer-Encoding"):
            self.send_json(
                {"ok": False, "error": "Transfer-Encoding non supportato."},
                HTTPStatus.BAD_REQUEST,
            )
            return
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            content_length = 0
        if content_length <= 0 or content_length > MAX_REQUEST_BYTES:
            self.send_json({"ok": False, "error": "Richiesta vuota o troppo grande."}, HTTPStatus.BAD_REQUEST)
            return
        if not _sandbox_slots.acquire(blocking=False):
            self.send_json(
                {"ok": False, "error": "Il laboratorio sta già eseguendo un comando."},
                HTTPStatus.TOO_MANY_REQUESTS,
                extra_headers={"Retry-After": "1"},
            )
            return
        try:
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            if not isinstance(payload, dict):
                raise ValueError("Il corpo JSON deve essere un oggetto.")
            if request_path == "/api/lab/status":
                image = sandbox_image()
                available, reason = docker_status(image)
                self.send_json(
                    {
                        "available": available,
                        "message": reason,
                        "image": image,
                        "commands": list(ALLOWED_COMMANDS),
                    }
                )
                return
            code = payload.get("code", "")
            command = payload.get("command", "")
            if not isinstance(code, str) or not isinstance(command, str):
                raise ValueError("Codice e comando devono essere testo.")
            self.send_json(run_in_sandbox(code, command, sandbox_image()))
        except (json.JSONDecodeError, UnicodeDecodeError, ValueError) as error:
            self.send_json({"ok": False, "error": str(error)}, HTTPStatus.BAD_REQUEST)
        except RuntimeError as error:
            self.send_json({"ok": False, "error": str(error)}, HTTPStatus.SERVICE_UNAVAILABLE)
        except socket.timeout:
            self.send_json(
                {"ok": False, "error": "Richiesta scaduta."},
                HTTPStatus.REQUEST_TIMEOUT,
            )
        except (OSError, subprocess.SubprocessError):
            self.send_json(
                {"ok": False, "error": "Il laboratorio non ha potuto avviare il container."},
                HTTPStatus.INTERNAL_SERVER_ERROR,
            )
        finally:
            _sandbox_slots.release()

    def do_OPTIONS(self) -> None:  # noqa: N802
        if not self.request_host_is_allowed():
            self.send_json(
                {"ok": False, "error": "Host non consentito."},
                HTTPStatus.MISDIRECTED_REQUEST,
            )
            return
        self.send_json(
            {"ok": False, "error": "Metodo non consentito."},
            HTTPStatus.METHOD_NOT_ALLOWED,
            extra_headers={"Allow": "GET, HEAD, POST"},
        )

    def log_message(self, format: str, *args: object) -> None:
        if len(args) > 1 and str(args[1]) == "200":
            return
        super().log_message(format, *args)


class LocalAppServer(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 16


def main(argv: list[str] | None = None) -> int:
    arguments = parse_arguments(argv)
    load_environment()
    try:
        ensure_build()
    except RuntimeError as error:
        print(f"Errore: {error}")
        if not arguments.desktop:
            input("Premi Invio per chiudere…")
        return 1

    if arguments.port is None:
        try:
            preferred_port = int(os.getenv("APP_PORT", "8765"))
        except ValueError:
            preferred_port = 8765
        port = choose_port(preferred_port)
    else:
        port = arguments.port
    reset_rate_limit()
    try:
        server = LocalAppServer(("127.0.0.1", port), AppHandler)
    except OSError as error:
        print(f"Errore: la porta locale non è disponibile ({error}).")
        if not arguments.desktop:
            input("Premi Invio per chiudere…")
        return 1
    actual_port = server.server_port
    url = f"http://127.0.0.1:{actual_port}"
    no_browser = (
        arguments.desktop
        or os.getenv("JAVA_LINGUO_NO_BROWSER") == "1"
        or os.getenv("STUDIO_JAVA_NO_BROWSER") == "1"
    )
    if not no_browser:
        threading.Timer(0.7, lambda: webbrowser.open(url)).start()
    print(f"JAVA_LINGUO_URL={url}", flush=True)
    print(f"\nJAVA_linguo {app_version()} è attivo su {url}")
    print("Il codice del laboratorio viene eseguito soltanto in Docker.")
    print("Premi Ctrl+C per chiudere.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nJAVA_linguo chiuso.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
