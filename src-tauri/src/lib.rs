use tauri::Manager;
use std::fs;

#[tauri::command]
fn generate_pdf(html: String) -> Result<String, String> {
    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join("markdown-editor-export.html");
    fs::write(&file_path, html).map_err(|e| e.to_string())?;
    Ok(file_path.to_string_lossy().into_owned())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![generate_pdf])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
