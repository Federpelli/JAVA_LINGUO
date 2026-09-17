fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "minimize_main_window",
            "load_course_progress",
            "save_course_progress",
        ]),
    ))
    .expect("impossibile preparare la build Tauri")
}
