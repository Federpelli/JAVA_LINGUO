import hashlib
import json
import re
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import build_sidecar, collect_desktop_artifacts


ROOT = Path(__file__).resolve().parents[1]


class DesktopConfigurationTests(unittest.TestCase):
    def test_product_name_and_versions_are_synchronized(self) -> None:
        tauri_config = json.loads((ROOT / "src-tauri" / "tauri.conf.json").read_text())
        package = json.loads((ROOT / "package.json").read_text())
        cargo_manifest = (ROOT / "src-tauri" / "Cargo.toml").read_text()
        app_version = (ROOT / "app" / "version.ts").read_text()
        version = (ROOT / "VERSION").read_text().strip()

        self.assertEqual(tauri_config["productName"], "JAVA_linguo")
        self.assertEqual(tauri_config["identifier"], "com.federpelli25.java-linguo")
        self.assertTrue(tauri_config["app"]["windows"][0]["fullscreen"])
        self.assertEqual(tauri_config["version"], version)
        self.assertEqual(package["version"], version)
        self.assertIn(f'version = "{version}"', cargo_manifest)
        self.assertEqual(re.search(r"APP_VERSION = '([^']+)'", app_version).group(1), version)
        self.assertEqual(
            tauri_config["bundle"]["externalBin"],
            ["binaries/java-linguo-backend"],
        )

    def test_desktop_and_web_icons_are_packaged(self) -> None:
        tauri_config = json.loads((ROOT / "src-tauri" / "tauri.conf.json").read_text())

        for icon in tauri_config["bundle"]["icon"]:
            self.assertTrue((ROOT / "src-tauri" / icon).is_file(), icon)
        self.assertTrue((ROOT / "public" / "favicon.svg").is_file())

    def test_signed_tauri_updater_is_configured(self) -> None:
        tauri_config = json.loads((ROOT / "src-tauri" / "tauri.conf.json").read_text())
        capability = json.loads((ROOT / "src-tauri" / "capabilities" / "default.json").read_text())
        loopback_capability = json.loads(
            (ROOT / "src-tauri" / "capabilities" / "loopback-updater.json").read_text()
        )
        cargo_manifest = (ROOT / "src-tauri" / "Cargo.toml").read_text()
        package = json.loads((ROOT / "package.json").read_text())
        workflow = (ROOT / ".github" / "workflows" / "desktop-release.yml").read_text()

        updater = tauri_config["plugins"]["updater"]
        installer_hooks = tauri_config["bundle"]["windows"]["nsis"]["installerHooks"]
        installer_hook_source = (ROOT / "src-tauri" / installer_hooks).read_text()
        self.assertTrue(tauri_config["bundle"]["createUpdaterArtifacts"])
        self.assertEqual(
            tauri_config["app"]["security"]["capabilities"],
            ["default", "loopback-updater"],
        )
        self.assertTrue(updater["pubkey"])
        self.assertEqual(
            updater["endpoints"],
            [
                "https://github.com/Federpelli/JAVA_LINGUO/releases/latest/download/latest.json",
                "https://github.com/Federpelli25/JAVA_linguo/releases/latest/download/latest.json",
            ],
        )
        self.assertIn("updater:default", capability["permissions"])
        self.assertIn("process:allow-restart", capability["permissions"])
        self.assertFalse(loopback_capability["local"])
        self.assertEqual(loopback_capability["windows"], ["main"])
        self.assertEqual(
            loopback_capability["remote"],
            {"urls": ["http://127.0.0.1:*"]},
        )
        self.assertIn("updater:allow-check", loopback_capability["permissions"])
        self.assertIn(
            "core:window:allow-is-fullscreen",
            loopback_capability["permissions"],
        )
        self.assertIn(
            "core:window:allow-set-fullscreen",
            loopback_capability["permissions"],
        )
        self.assertIn(
            "updater:allow-download-and-install",
            loopback_capability["permissions"],
        )
        self.assertIn("process:allow-restart", loopback_capability["permissions"])
        self.assertNotIn("core:default", loopback_capability["permissions"])
        self.assertFalse(
            any(
                permission == "shell:allow-spawn"
                or (
                    isinstance(permission, dict)
                    and permission.get("identifier") == "shell:allow-spawn"
                )
                for permission in loopback_capability["permissions"]
            )
        )
        self.assertIn('tauri-plugin-updater = "=2.11.0"', cargo_manifest)
        self.assertIn('tauri-plugin-opener = "=2.5.4"', cargo_manifest)
        self.assertEqual(package["dependencies"]["@tauri-apps/plugin-opener"], "2.5.5")
        self.assertIn(
            {
                "identifier": "opener:allow-open-url",
                "allow": [
                    {
                        "url": "https://github.com/Federpelli/JAVA_LINGUO/releases/latest"
                    }
                ],
            },
            capability["permissions"],
        )
        self.assertIn(
            {
                "identifier": "opener:allow-open-url",
                "allow": [
                    {
                        "url": "https://github.com/Federpelli/JAVA_LINGUO/releases/latest"
                    }
                ],
            },
            loopback_capability["permissions"],
        )
        self.assertIn("TAURI_SIGNING_PRIVATE_KEY", workflow)
        self.assertEqual(workflow.count("bundles: app,dmg"), 2)
        self.assertRegex(workflow, r"tauri-apps/tauri-action@[0-9a-f]{40}")
        self.assertIn("NSIS_HOOK_PREINSTALL", installer_hook_source)
        self.assertIn("NSIS_HOOK_PREUNINSTALL", installer_hook_source)
        self.assertIn("java-linguo-backend.exe", installer_hook_source)
        self.assertIn("taskkill.exe", installer_hook_source)

        rust_source = (ROOT / "src-tauri" / "src" / "lib.rs").read_text()
        self.assertIn("stop_backend(&app.state::<BackendProcess>())", rust_source)
        self.assertIn("tauri_plugin_opener::init()", rust_source)
        self.assertIn('format!("http://127.0.0.1:{port}")', rust_source)

        update_center = (ROOT / "app" / "update-center.tsx").read_text(encoding="utf-8")
        self.assertIn("errorDetail(error)", update_center)
        self.assertIn("Dettaglio tecnico", update_center)
        self.assertIn("openUrl(RELEASES_URL)", update_center)

        fullscreen_shortcut = (ROOT / "app" / "fullscreen-shortcut.tsx").read_text(
            encoding="utf-8"
        )
        layout = (ROOT / "app" / "layout.tsx").read_text(encoding="utf-8")
        self.assertEqual(package["dependencies"]["@tauri-apps/api"], "2.11.1")
        self.assertIn("event.key !== 'Escape'", fullscreen_shortcut)
        self.assertIn("appWindow.isFullscreen()", fullscreen_shortcut)
        self.assertIn("appWindow.setFullscreen(false)", fullscreen_shortcut)
        self.assertIn("<FullscreenShortcut />", layout)

        page = (ROOT / "app" / "page.tsx").read_text(encoding="utf-8")
        error_boundary = (ROOT / "app" / "error.tsx").read_text(encoding="utf-8")
        self.assertIn("function selectSlide(", page)
        self.assertIn("currentSlide: number", page)
        self.assertIn("scrollIntoView({ behavior: 'auto', block: 'start' })", page)
        self.assertIn("lessonHeadingRef.current?.focus({ preventScroll: true })", page)
        self.assertIn("[app:error-boundary]", error_boundary)
        self.assertIn("Riprova", error_boundary)

    def test_java_editor_and_terminal_input_are_exposed(self) -> None:
        package = json.loads((ROOT / "package.json").read_text())
        page = (ROOT / "app" / "page.tsx").read_text(encoding="utf-8")
        editor = (ROOT / "app" / "java-code-editor.tsx").read_text(encoding="utf-8")

        self.assertEqual(package["dependencies"]["@codemirror/lang-java"], "6.0.2")
        self.assertEqual(package["dependencies"]["@uiw/react-codemirror"], "4.25.11")
        self.assertIn("vscodeDark", editor)
        self.assertIn("java()", editor)
        self.assertIn("Scrivi un comando", page)
        self.assertIn('placeholder="es. java Main.java"', page)

    def test_sidecar_name_matches_tauri_target_convention(self) -> None:
        self.assertEqual(
            build_sidecar.sidecar_filename("x86_64-pc-windows-msvc"),
            "java-linguo-backend-x86_64-pc-windows-msvc.exe",
        )
        self.assertEqual(
            build_sidecar.sidecar_filename("aarch64-apple-darwin"),
            "java-linguo-backend-aarch64-apple-darwin",
        )


class DesktopArtifactTests(unittest.TestCase):
    def test_windows_installer_gets_stable_name_and_checksum(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            temporary_root = Path(temporary)
            bundle_root = temporary_root / "bundle"
            installer = bundle_root / "nsis" / "generated.exe"
            installer.parent.mkdir(parents=True)
            installer.write_bytes(b"installer-test")

            with patch.object(collect_desktop_artifacts, "ROOT", temporary_root), patch.object(
                collect_desktop_artifacts, "BUNDLE_ROOT", bundle_root
            ):
                artifacts = collect_desktop_artifacts.collect("windows", "x64", "0.4.0")

            output = temporary_root / "desktop-artifacts" / (
                "JAVA_linguo-v0.4.0-windows-x64.setup.exe"
            )
            checksum = output.with_suffix(".exe.sha256")
            self.assertEqual(artifacts, [output, checksum])
            self.assertEqual(output.read_bytes(), b"installer-test")
            self.assertEqual(
                checksum.read_text().split()[0],
                hashlib.sha256(b"installer-test").hexdigest(),
            )


if __name__ == "__main__":
    unittest.main()
