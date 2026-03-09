use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{Emitter, Manager};

const MENU_EVENT_NAME: &str = "native-menu-action";
const MENU_OPEN_FILE: &str = "file.open";
const MENU_OPEN_FOLDER: &str = "file.open_folder";
const MENU_SAVE: &str = "file.save";
const MENU_SAVE_AS: &str = "file.save_as";
const MENU_EXPORT_MARKDOWN: &str = "file.export_markdown";
const MENU_EXPORT_PDF: &str = "file.export_pdf";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DirectoryEntry {
    id: String,
    name: String,
    path: String,
    parent_id: Option<String>,
    entry_type: String,
}

#[tauri::command]
fn export_pdf_preview(html: String) -> Result<(), String> {
    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join("markdown-editor-export.html");
    fs::write(&file_path, html).map_err(|e| e.to_string())?;
    open::that_detached(&file_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn move_file(from: String, to: String) -> Result<(), String> {
    let to_path = std::path::Path::new(&to);
    if to_path.exists() {
        return Err(format!("Target already exists: {}", to));
    }
    if let Some(parent) = to_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    fs::rename(&from, &to).map_err(|e| e.to_string())
}

#[tauri::command]
fn scan_markdown_directory(path: String) -> Result<Vec<DirectoryEntry>, String> {
    let root = PathBuf::from(path);
    if !root.is_dir() {
        return Err("Selected path is not a directory".to_string());
    }

    let mut entries = Vec::new();
    collect_directory_entries(&root, None, &mut entries)?;
    Ok(entries)
}

fn collect_directory_entries(
    path: &Path,
    parent_id: Option<String>,
    entries: &mut Vec<DirectoryEntry>,
) -> Result<bool, String> {
    let mut child_paths = fs::read_dir(path)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok().map(|e| e.path()))
        .collect::<Vec<_>>();

    child_paths.sort_by(|a, b| a.file_name().cmp(&b.file_name()));

    let mut child_entries = Vec::new();
    let mut has_visible_children = false;
    let current_id = path.to_string_lossy().into_owned();

    for child_path in child_paths {
        if child_path.is_dir() {
            if collect_directory_entries(&child_path, Some(current_id.clone()), &mut child_entries)? {
                has_visible_children = true;
            }
            continue;
        }

        if is_supported_text_file(&child_path) {
            has_visible_children = true;
            child_entries.push(DirectoryEntry {
                id: child_path.to_string_lossy().into_owned(),
                name: child_path
                    .file_name()
                    .map(|n| n.to_string_lossy().into_owned())
                    .unwrap_or_else(|| "Untitled".to_string()),
                path: child_path.to_string_lossy().into_owned(),
                parent_id: Some(current_id.clone()),
                entry_type: "doc".to_string(),
            });
        }
    }

    if !has_visible_children {
        return Ok(false);
    }

    entries.push(DirectoryEntry {
        id: current_id,
        name: path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| path.to_string_lossy().into_owned()),
        path: path.to_string_lossy().into_owned(),
        parent_id,
        entry_type: "folder".to_string(),
    });
    entries.extend(child_entries);

    Ok(true)
}

fn is_supported_text_file(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.to_ascii_lowercase()),
        Some(ext) if matches!(ext.as_str(), "md" | "markdown" | "txt")
    )
}

fn build_menu<R: tauri::Runtime>(app: &tauri::App<R>) -> tauri::Result<tauri::menu::Menu<R>> {
    let app_menu = SubmenuBuilder::new(app, "Markdown Editor")
        .about(None)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(
            &MenuItemBuilder::with_id(MENU_OPEN_FILE, "Open...")
                .accelerator("CmdOrCtrl+O")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(MENU_OPEN_FOLDER, "Open Folder...")
                .accelerator("CmdOrCtrl+Shift+O")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id(MENU_SAVE, "Save")
                .accelerator("CmdOrCtrl+S")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(MENU_SAVE_AS, "Save As...")
                .accelerator("CmdOrCtrl+Shift+S")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id(MENU_EXPORT_MARKDOWN, "Export Markdown...")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(MENU_EXPORT_PDF, "Export PDF...")
                .build(app)?,
        )
        .separator()
        .item(&PredefinedMenuItem::close_window(app, None)?)
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .fullscreen()
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize()
        .build()?;

    MenuBuilder::new(app)
        .item(&app_menu)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&window_menu)
        .build()
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let menu = build_menu(app)?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let menu_id = event.id().as_ref();
            if menu_id == MENU_EXPORT_PDF {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.print();
                }
                return;
            }

            if !matches!(
                menu_id,
                MENU_OPEN_FILE | MENU_OPEN_FOLDER | MENU_SAVE | MENU_SAVE_AS | MENU_EXPORT_MARKDOWN
            ) {
                return;
            }

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.emit(MENU_EVENT_NAME, menu_id);
            }
        })
        .invoke_handler(tauri::generate_handler![
            export_pdf_preview,
            read_text_file,
            write_text_file,
            move_file,
            scan_markdown_directory
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
