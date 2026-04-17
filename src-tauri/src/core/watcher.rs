use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Default)]
pub(crate) struct StorageWatcher {
    watcher: Mutex<Option<RecommendedWatcher>>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectChangedPayload {
    root_path: String,
}

pub(crate) fn watch_storage_root(app: &AppHandle, root_path: PathBuf) -> Result<(), String> {
    let state = app.state::<StorageWatcher>();
    let app_handle = app.clone();
    let root_path_for_event = root_path.clone();
    let mut watcher = notify::recommended_watcher(move |event: notify::Result<notify::Event>| {
        if event.is_err() {
            return;
        }

        let _ = app_handle.emit(
            "trackboi://project-changed",
            ProjectChangedPayload {
                root_path: root_path_for_event.to_string_lossy().to_string(),
            },
        );
    })
    .map_err(|error| error.to_string())?;

    watcher
        .watch(&root_path, RecursiveMode::Recursive)
        .map_err(|error| error.to_string())?;
    *state.watcher.lock().map_err(|error| error.to_string())? = Some(watcher);
    Ok(())
}
