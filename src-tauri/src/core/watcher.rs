use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
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

// Access events fire when files are opened for reading. The snapshot refresh reads every
// card/board file, so forwarding Access events creates a feedback loop: read → emit → refresh → read.
fn should_emit(kind: &EventKind) -> bool {
    !matches!(kind, EventKind::Access(_))
}

pub(crate) fn watch_storage_root(app: &AppHandle, root_path: PathBuf) -> Result<(), String> {
    let state = app.state::<StorageWatcher>();
    let app_handle = app.clone();
    let root_path_for_event = root_path.clone();
    let mut watcher = notify::recommended_watcher(move |event: notify::Result<notify::Event>| {
        let Ok(event) = event else {
            return;
        };

        if !should_emit(&event.kind) {
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

#[cfg(test)]
mod tests {
    use super::should_emit;
    use notify::event::{AccessKind, AccessMode, CreateKind, ModifyKind, RemoveKind, RenameMode};
    use notify::EventKind;

    #[test]
    fn drops_access_events_to_prevent_feedback_loop() {
        assert!(!should_emit(&EventKind::Access(AccessKind::Open(
            AccessMode::Any
        ))));
        assert!(!should_emit(&EventKind::Access(AccessKind::Close(
            AccessMode::Any
        ))));
        assert!(!should_emit(&EventKind::Access(AccessKind::Read)));
    }

    #[test]
    fn forwards_content_events() {
        assert!(should_emit(&EventKind::Create(CreateKind::File)));
        assert!(should_emit(&EventKind::Modify(ModifyKind::Data(
            notify::event::DataChange::Any
        ))));
        assert!(should_emit(&EventKind::Modify(ModifyKind::Metadata(
            notify::event::MetadataKind::Any
        ))));
        assert!(should_emit(&EventKind::Modify(ModifyKind::Name(
            RenameMode::Any
        ))));
        assert!(should_emit(&EventKind::Remove(RemoveKind::File)));
    }
}
