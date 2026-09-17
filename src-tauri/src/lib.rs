use std::net::{SocketAddr, TcpListener, TcpStream};
use std::sync::Mutex;
use std::time::Duration;

use tauri::{Manager, RunEvent, State, WebviewWindow};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

mod progress_store;

use progress_store::ProgressStore;

#[derive(Default)]
struct BackendProcess(Mutex<Option<CommandChild>>);

fn stop_backend(process: &BackendProcess) {
    let child = process.0.lock().ok().and_then(|mut current| current.take());

    if let Some(child) = child {
        let _ = child.kill();

        #[cfg(windows)]
        std::thread::sleep(Duration::from_millis(750));
    }
}

#[tauri::command]
fn minimize_main_window(window: WebviewWindow) -> Result<(), String> {
    window
        .minimize()
        .map_err(|error| format!("Impossibile ridurre a icona la finestra: {error}"))
}

#[tauri::command]
fn load_course_progress(
    app: tauri::AppHandle,
    store: State<'_, ProgressStore>,
) -> Result<Option<String>, String> {
    store.synchronized(|| progress_store::load(&app))
}

#[tauri::command]
fn save_course_progress(
    app: tauri::AppHandle,
    store: State<'_, ProgressStore>,
    payload: String,
) -> Result<(), String> {
    store.synchronized(|| progress_store::save(&app, &payload))
}

fn available_loopback_port() -> Result<u16, String> {
    TcpListener::bind(("127.0.0.1", 0))
        .and_then(|listener| listener.local_addr())
        .map(|address| address.port())
        .map_err(|error| format!("Impossibile scegliere una porta locale: {error}"))
}

fn show_startup_error(app: &tauri::AppHandle, message: &str) {
    if let Some(window) = app.get_webview_window("main") {
        let safe_message = message.replace('\\', "\\\\").replace('`', "\\`");
        let script = format!(
            "document.getElementById('status').textContent = `{safe_message}`; \
             document.querySelector('.loader').style.display = 'none';"
        );
        let _ = window.eval(&script);
        let _ = window.show();
    }
}

fn wait_for_backend(app: tauri::AppHandle, port: u16) {
    let address = SocketAddr::from(([127, 0, 0, 1], port));
    for _ in 0..200 {
        if TcpStream::connect_timeout(&address, Duration::from_millis(100)).is_ok() {
            let url = format!("http://127.0.0.1:{port}");
            match url.parse() {
                Ok(url) => {
                    if let Some(window) = app.get_webview_window("main") {
                        if window.navigate(url).is_ok() {
                            let _ = window.show();
                            let _ = window.set_focus();
                            return;
                        }
                    }
                }
                Err(error) => {
                    show_startup_error(&app, &format!("Indirizzo locale non valido: {error}"));
                    return;
                }
            }
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    show_startup_error(
        &app,
        "Il servizio locale non ha risposto. Chiudi JAVA_linguo e riavvialo.",
    );
}

pub fn run() {
    let application = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .manage(BackendProcess::default())
        .manage(ProgressStore::default())
        .invoke_handler(tauri::generate_handler![
            minimize_main_window,
            load_course_progress,
            save_course_progress
        ])
        .setup(|app| {
            let port = available_loopback_port()?;
            let port_argument = port.to_string();
            let (mut events, child) = app
                .shell()
                .sidecar("java-linguo-backend")
                .map_err(|error| error.to_string())?
                .args(["--desktop", "--port", &port_argument])
                .spawn()
                .map_err(|error| error.to_string())?;

            app.state::<BackendProcess>()
                .0
                .lock()
                .map_err(|_| "Stato del backend non disponibile")?
                .replace(child);

            tauri::async_runtime::spawn(async move { while events.recv().await.is_some() {} });

            let handle = app.handle().clone();
            std::thread::spawn(move || wait_for_backend(handle, port));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("errore durante l'avvio di JAVA_linguo");

    application.run(|app, event| {
        if let RunEvent::ExitRequested { .. } = event {
            stop_backend(&app.state::<BackendProcess>());
        }
    });
}
