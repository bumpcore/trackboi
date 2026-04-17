use super::model::*;
use super::service::ProjectStore;
use super::storage::{
    active_snapshot, active_storage_root, ensure_project, json_ok, normalize_storage_search_paths,
    project_status, read_registry, require_active_project, resolve_project_storage,
    storage_candidates, write_registry,
};
use super::watcher::watch_storage_root;
use super::Result;
use serde_json::Value;
use std::path::Path;
use tauri::AppHandle;
use ulid::Ulid;

fn new_id(prefix: &str) -> String {
    format!("{prefix}_{}", Ulid::new())
}

fn active_store(app: &AppHandle, create: bool) -> Result<ProjectStore> {
    let project = require_active_project(app)?;
    let registry = read_registry(app);
    ProjectStore::open(project, &registry, create)
}

fn refresh_storage_watcher(app: &AppHandle) {
    if let Ok(root_path) = active_storage_root(app, false) {
        let _ = watch_storage_root(app, root_path);
    }
}

#[tauri::command]
pub fn get_active_project(app: AppHandle) -> Result<Option<ProjectSnapshot>> {
    let snapshot = active_snapshot(&app)?;
    refresh_storage_watcher(&app);
    Ok(snapshot)
}

#[tauri::command]
pub fn list_projects(app: AppHandle) -> ProjectRegistry {
    read_registry(&app)
}

#[tauri::command]
pub fn list_project_index(app: AppHandle) -> ProjectIndex {
    let registry = read_registry(&app);
    ProjectIndex {
        projects: registry
            .projects
            .iter()
            .map(|project| ProjectIndexEntry {
                id: project.id.clone(),
                name: project.name.clone(),
                path: project.path.clone(),
                storage_path: project.storage_path.clone(),
                status: project_status(project, &registry),
            })
            .collect(),
        active_project_id: registry.active_project_id.clone(),
        storage_search_paths: storage_candidates(&registry, None),
    }
}

#[tauri::command]
pub fn set_storage_search_paths(app: AppHandle, paths: Vec<String>) -> Result<ProjectIndex> {
    let mut registry = read_registry(&app);
    registry.storage_search_paths = Some(normalize_storage_search_paths(&paths)?);
    write_registry(&app, registry)?;
    refresh_storage_watcher(&app);
    Ok(list_project_index(app))
}

#[tauri::command]
pub fn choose_project(app: AppHandle, project_path: String) -> Result<Option<ProjectSnapshot>> {
    let mut registry = read_registry(&app);

    if let Some(project) = registry
        .projects
        .iter()
        .find(|project| project.path == project_path)
        .cloned()
    {
        registry.active_project_id = Some(project.id.clone());
        write_registry(&app, registry)?;
        let snapshot = Some(ensure_project(&app, project)?);
        refresh_storage_watcher(&app);
        return Ok(snapshot);
    }

    let project = Project {
        id: new_id("project"),
        name: Path::new(&project_path)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("Project")
            .into(),
        path: project_path,
        storage_path: None,
    };
    let storage_path =
        resolve_project_storage(&project, &registry, true).map(|(_, storage_path)| storage_path);
    let project = Project {
        storage_path,
        ..project
    };

    registry.projects.push(project.clone());
    registry.active_project_id = Some(project.id.clone());
    write_registry(&app, registry)?;
    let snapshot = Some(ensure_project(&app, project)?);
    refresh_storage_watcher(&app);
    Ok(snapshot)
}

#[tauri::command]
pub fn locate_project(
    app: AppHandle,
    project_id: String,
    project_path: String,
) -> Result<Option<ProjectSnapshot>> {
    let mut registry = read_registry(&app);
    let Some(index) = registry
        .projects
        .iter()
        .position(|project| project.id == project_id)
    else {
        return Err(format!("Unknown project: {project_id}"));
    };

    if let Some(duplicate) = registry
        .projects
        .iter()
        .find(|project| project.id != project_id && project.path == project_path)
        .cloned()
    {
        registry.projects.retain(|project| project.id != project_id);
        registry.active_project_id = Some(duplicate.id.clone());
        write_registry(&app, registry)?;
        let snapshot = Some(ensure_project(&app, duplicate)?);
        refresh_storage_watcher(&app);
        return Ok(snapshot);
    }

    registry.projects[index].path = project_path.clone();
    registry.projects[index].name = Path::new(&project_path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Project")
        .into();
    registry.projects[index].storage_path =
        resolve_project_storage(&registry.projects[index], &registry, true)
            .map(|(_, storage_path)| storage_path);
    registry.active_project_id = Some(project_id);
    let project = registry.projects[index].clone();
    write_registry(&app, registry)?;
    let snapshot = Some(ensure_project(&app, project)?);
    refresh_storage_watcher(&app);
    Ok(snapshot)
}

#[tauri::command]
pub fn remove_project(app: AppHandle, project_id: String) -> Result<Option<ProjectSnapshot>> {
    let mut registry = read_registry(&app);
    let original_len = registry.projects.len();
    registry.projects.retain(|project| project.id != project_id);

    if registry.projects.len() == original_len {
        return Err(format!("Unknown project: {project_id}"));
    }

    if registry.active_project_id.as_deref() == Some(&project_id) {
        registry.active_project_id = registry.projects.first().map(|project| project.id.clone());
    }

    write_registry(&app, registry)?;
    let snapshot = active_snapshot(&app)?;
    refresh_storage_watcher(&app);
    Ok(snapshot)
}

#[tauri::command]
pub fn switch_project(app: AppHandle, project_id: String) -> Result<Option<ProjectSnapshot>> {
    let mut registry = read_registry(&app);
    if !registry
        .projects
        .iter()
        .any(|project| project.id == project_id)
    {
        return Err(format!("Unknown project: {project_id}"));
    }

    registry.active_project_id = Some(project_id);
    write_registry(&app, registry)?;
    let snapshot = active_snapshot(&app)?;
    refresh_storage_watcher(&app);
    Ok(snapshot)
}

#[tauri::command]
pub fn create_card(app: AppHandle, input: CreateCardInput) -> Result<Card> {
    active_store(&app, true)?.create_card(input)
}

#[tauri::command]
pub fn update_card(app: AppHandle, card_id: String, patch: Value) -> Result<Card> {
    active_store(&app, false)?.update_card(&card_id, patch)
}

#[tauri::command]
pub fn update_board(app: AppHandle, board: Board) -> Result<Board> {
    active_store(&app, false)?.update_board(board)
}

#[tauri::command]
pub fn update_custom_fields(
    app: AppHandle,
    custom_fields: Vec<CustomField>,
) -> Result<ProjectMetadata> {
    active_store(&app, false)?.update_custom_fields(custom_fields)
}

#[tauri::command]
pub fn move_card(app: AppHandle, input: MoveCardInput) -> Result<Card> {
    active_store(&app, false)?.move_card(input)
}

#[tauri::command]
pub fn delete_card(app: AppHandle, card_id: String) -> Result<Value> {
    active_store(&app, false)?.delete_card(&card_id)?;
    Ok(json_ok())
}
