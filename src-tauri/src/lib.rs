pub(crate) mod core;
pub mod mcp;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            app.manage(core::watcher::StorageWatcher::default());
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            core::commands::get_active_project,
            core::commands::list_projects,
            core::commands::list_view,
            core::commands::set_storage_search_paths,
            core::commands::choose_project,
            core::commands::locate_project,
            core::commands::remove_project,
            core::commands::switch_project,
            core::commands::create_card,
            core::commands::update_card,
            core::commands::update_board,
            core::commands::update_custom_fields,
            core::commands::move_card,
            core::commands::delete_card,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
