use super::model::*;
use super::{Result, DEFAULT_BOARD_ID, DEFAULT_STORAGE_SEARCH_PATHS, PROJECT_METADATA_FILE};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

pub(crate) fn now() -> String {
    Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

pub(crate) fn default_columns() -> Vec<Column> {
    vec![
        Column {
            id: "todo".into(),
            name: "To Do".into(),
        },
        Column {
            id: "doing".into(),
            name: "Doing".into(),
        },
        Column {
            id: "done".into(),
            name: "Done".into(),
        },
    ]
}

pub(crate) fn default_storage_search_paths() -> Vec<String> {
    DEFAULT_STORAGE_SEARCH_PATHS
        .iter()
        .map(|path| path.to_string())
        .collect()
}

pub(crate) fn global_scope() -> WorkScope {
    WorkScope {
        kind: "project".into(),
        ref_: "global".into(),
    }
}

pub(crate) fn scope_for_git_context(git: &GitContext) -> WorkScope {
    git.branch
        .as_ref()
        .map(|branch| WorkScope {
            kind: "branch".into(),
            ref_: branch.clone(),
        })
        .unwrap_or_else(global_scope)
}

fn registry_path(app: &AppHandle) -> Result<PathBuf> {
    Ok(app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?
        .join("config.json"))
}

fn storage_root(project_path: &str, storage_path: &str) -> PathBuf {
    Path::new(project_path).join(storage_path)
}

fn cards_path(root_path: &Path) -> PathBuf {
    root_path.join("cards")
}

fn boards_path(root_path: &Path) -> PathBuf {
    root_path.join("boards")
}

fn board_path(root_path: &Path) -> PathBuf {
    boards_path(root_path).join(format!("{DEFAULT_BOARD_ID}.json"))
}

fn project_metadata_path(root_path: &Path) -> PathBuf {
    root_path.join(PROJECT_METADATA_FILE)
}

fn card_path(root_path: &Path, card_id: &str) -> PathBuf {
    cards_path(root_path).join(format!("{card_id}.json"))
}

pub(crate) fn atomic_write_json<T: Serialize>(path: &Path, value: &T) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let temp_path = path.with_extension(
        path.extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| format!("{extension}.tmp"))
            .unwrap_or_else(|| "tmp".into()),
    );
    let content = format!(
        "{}\n",
        serde_json::to_string_pretty(value).map_err(|error| error.to_string())?
    );
    fs::write(&temp_path, content).map_err(|error| error.to_string())?;
    fs::rename(&temp_path, path).map_err(|error| error.to_string())?;
    Ok(())
}

fn read_json<T: for<'de> Deserialize<'de>>(path: &Path) -> Result<T> {
    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&content).map_err(|error| error.to_string())
}

fn empty_registry() -> ProjectRegistry {
    ProjectRegistry {
        projects: vec![],
        active_project_id: None,
        storage_search_paths: Some(default_storage_search_paths()),
    }
}

pub(crate) fn normalize_storage_search_paths(paths: &[String]) -> Result<Vec<String>> {
    let mut normalized = Vec::new();

    for path in paths {
        let next_path = path
            .trim()
            .replace('\\', "/")
            .trim_start_matches("./")
            .to_string();
        if next_path.is_empty()
            || next_path.starts_with('/')
            || next_path.split('/').any(|part| part == "..")
        {
            return Err("Storage paths must be relative paths inside the project".into());
        }
        if !normalized.contains(&next_path) {
            normalized.push(next_path);
        }
    }

    if normalized.is_empty() {
        return Err("Add at least one storage search path".into());
    }

    Ok(normalized)
}

fn sanitize_registry(registry: ProjectRegistry) -> ProjectRegistry {
    let storage_search_paths = registry
        .storage_search_paths
        .as_ref()
        .and_then(|paths| normalize_storage_search_paths(paths).ok())
        .unwrap_or_else(default_storage_search_paths);
    let active_project_id = registry
        .active_project_id
        .filter(|id| registry.projects.iter().any(|project| &project.id == id))
        .or_else(|| registry.projects.first().map(|project| project.id.clone()));

    ProjectRegistry {
        projects: registry.projects,
        active_project_id,
        storage_search_paths: Some(storage_search_paths),
    }
}

pub(crate) fn read_registry(app: &AppHandle) -> ProjectRegistry {
    registry_path(app)
        .ok()
        .and_then(|path| read_json::<ProjectRegistry>(&path).ok())
        .map(sanitize_registry)
        .unwrap_or_else(empty_registry)
}

pub(crate) fn write_registry(
    app: &AppHandle,
    registry: ProjectRegistry,
) -> Result<ProjectRegistry> {
    let next_registry = sanitize_registry(registry);
    atomic_write_json(&registry_path(app)?, &next_registry)?;
    Ok(next_registry)
}

pub(crate) fn active_project_from_registry(registry: &ProjectRegistry) -> Option<Project> {
    registry
        .active_project_id
        .as_ref()
        .and_then(|id| registry.projects.iter().find(|project| &project.id == id))
        .cloned()
}

pub(crate) fn storage_candidates(
    registry: &ProjectRegistry,
    project: Option<&Project>,
) -> Vec<String> {
    let configured = registry
        .storage_search_paths
        .clone()
        .filter(|paths| !paths.is_empty())
        .unwrap_or_else(default_storage_search_paths);
    let mut candidates = Vec::new();

    if let Some(storage_path) = project.and_then(|project| project.storage_path.clone()) {
        candidates.push(storage_path);
    }

    for path in configured {
        if !candidates.contains(&path) {
            candidates.push(path);
        }
    }

    candidates
}

fn storage_exists(root_path: &Path) -> bool {
    board_path(root_path).exists()
        || project_metadata_path(root_path).exists()
        || cards_path(root_path).exists()
}

fn initial_storage_path(project: &Project, registry: &ProjectRegistry) -> String {
    let candidates = storage_candidates(registry, Some(project));
    if candidates == default_storage_search_paths()
        && Path::new(&project.path).join(".etc").exists()
    {
        return ".etc/.trackboi".into();
    }

    candidates
        .first()
        .cloned()
        .unwrap_or_else(|| DEFAULT_STORAGE_SEARCH_PATHS[0].into())
}

pub(crate) fn resolve_project_storage(
    project: &Project,
    registry: &ProjectRegistry,
    create: bool,
) -> Option<(PathBuf, String)> {
    for candidate in storage_candidates(registry, Some(project)) {
        let root_path = storage_root(&project.path, &candidate);
        if storage_exists(&root_path) {
            return Some((root_path, candidate));
        }
    }

    if !create {
        return None;
    }

    let storage_path = initial_storage_path(project, registry);
    Some((storage_root(&project.path, &storage_path), storage_path))
}

fn write_project_metadata(root_path: &Path, project: &Project, storage_path: &str) -> Result<()> {
    let metadata_path = project_metadata_path(root_path);
    if metadata_path.exists() {
        return Ok(());
    }

    atomic_write_json(
        &metadata_path,
        &serde_json::json!({
          "version": 1,
          "projectId": project.id,
          "name": project.name,
          "storagePath": storage_path,
          "createdAt": now(),
        }),
    )
}

fn remember_project_storage(app: &AppHandle, project_id: &str, storage_path: &str) -> Result<()> {
    let mut registry = read_registry(app);
    if let Some(project) = registry
        .projects
        .iter_mut()
        .find(|project| project.id == project_id)
    {
        if project.storage_path.as_deref() != Some(storage_path) {
            project.storage_path = Some(storage_path.into());
            write_registry(app, registry)?;
        }
    }
    Ok(())
}

fn find_git_root(start_path: &Path) -> Option<PathBuf> {
    let mut current_path = start_path.to_path_buf();

    for _ in 0..64 {
        if current_path.join(".git").exists() {
            return Some(current_path);
        }

        if !current_path.pop() {
            return None;
        }
    }

    None
}

fn read_git_context(project_path: &str) -> GitContext {
    let Some(root) = find_git_root(Path::new(project_path)) else {
        return GitContext {
            is_git_repo: false,
            root: None,
            branch: None,
            detached: false,
            dirty: None,
        };
    };

    let branch = fs::read_to_string(root.join(".git").join("HEAD"))
        .ok()
        .and_then(|head| {
            head.trim()
                .strip_prefix("ref: refs/heads/")
                .map(|branch| branch.to_string())
        });

    GitContext {
        is_git_repo: true,
        root: Some(root.to_string_lossy().to_string()),
        detached: branch.is_none(),
        branch,
        dirty: None,
    }
}

pub(crate) fn project_status(project: &Project, registry: &ProjectRegistry) -> String {
    if !Path::new(&project.path).exists() {
        return "missing".into();
    }

    let Some((root_path, _)) = resolve_project_storage(project, registry, false) else {
        return "uninitialized".into();
    };

    if !board_path(&root_path).exists() {
        return "uninitialized".into();
    }

    "ready".into()
}

pub(crate) fn read_project(app: &AppHandle, project: Project) -> Result<ProjectSnapshot> {
    let registry = read_registry(app);
    let (root_path, storage_path) = resolve_project_storage(&project, &registry, false)
        .ok_or_else(|| "Trackboi storage has not been created for this project".to_string())?;
    let board = read_json::<Board>(&board_path(&root_path))?;
    let card_dir = cards_path(&root_path);
    let mut cards = Vec::new();

    if card_dir.exists() {
        for entry in fs::read_dir(&card_dir).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let path = entry.path();
            if !path.is_file()
                || path.extension().and_then(|extension| extension.to_str()) != Some("json")
            {
                continue;
            }

            let mut card = read_json::<Card>(&path)?;
            if let Some(id) = path.file_stem().and_then(|stem| stem.to_str()) {
                if card.id != id {
                    return Err(format!(
                        "Card id {} does not match filename {}",
                        card.id, id
                    ));
                }
            }
            card.scope = normalize_scope(card.scope);
            cards.push(card);
        }
    }

    cards.sort_by(|left, right| {
        left.column
            .cmp(&right.column)
            .then(left.rank.cmp(&right.rank))
    });
    let git = read_git_context(&project.path);

    Ok(ProjectSnapshot {
        project: Project {
            name: if project.name.is_empty() {
                board.name.clone()
            } else {
                project.name
            },
            storage_path: Some(storage_path),
            ..project
        },
        git,
        board,
        cards,
    })
}

pub(crate) fn ensure_project(app: &AppHandle, project: Project) -> Result<ProjectSnapshot> {
    let registry = read_registry(app);
    let (root_path, storage_path) = resolve_project_storage(&project, &registry, true)
        .ok_or_else(|| "Unable to resolve Trackboi storage path".to_string())?;

    fs::create_dir_all(boards_path(&root_path)).map_err(|error| error.to_string())?;
    fs::create_dir_all(cards_path(&root_path)).map_err(|error| error.to_string())?;
    write_project_metadata(&root_path, &project, &storage_path)?;

    let path = board_path(&root_path);
    if !path.exists() {
        let board = Board {
            version: 1,
            name: if project.name.is_empty() {
                Path::new(&project.path)
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("Project")
                    .into()
            } else {
                project.name.clone()
            },
            columns: default_columns(),
            custom_fields: vec![],
        };
        atomic_write_json(&path, &board)?;
    }

    remember_project_storage(app, &project.id, &storage_path)?;
    read_project(
        app,
        Project {
            storage_path: Some(storage_path),
            ..project
        },
    )
}

pub(crate) fn active_snapshot(app: &AppHandle) -> Result<Option<ProjectSnapshot>> {
    let Some(project) = active_project_from_registry(&read_registry(app)) else {
        return Ok(None);
    };

    if !Path::new(&project.path).exists() {
        return Ok(None);
    }

    Ok(Some(ensure_project(app, project)?))
}

pub(crate) fn require_active_project(app: &AppHandle) -> Result<Project> {
    active_project_from_registry(&read_registry(app)).ok_or_else(|| "Choose a project first".into())
}

pub(crate) fn normalize_scope(scope: WorkScope) -> WorkScope {
    if scope.kind == "branch" && !scope.ref_.trim().is_empty() {
        return scope;
    }

    global_scope()
}

pub(crate) fn card_path_for_active_project(app: &AppHandle, card_id: &str) -> Result<PathBuf> {
    let project = require_active_project(app)?;
    let registry = read_registry(app);
    let (root_path, _) = resolve_project_storage(&project, &registry, false)
        .ok_or_else(|| "Trackboi storage has not been created for this project".to_string())?;
    Ok(card_path(&root_path, card_id))
}

pub(crate) fn board_path_for_active_project(app: &AppHandle) -> Result<PathBuf> {
    let project = require_active_project(app)?;
    let registry = read_registry(app);
    let (root_path, _) = resolve_project_storage(&project, &registry, false)
        .ok_or_else(|| "Trackboi storage has not been created for this project".to_string())?;
    Ok(board_path(&root_path))
}

pub(crate) fn card_path_in_root(root_path: &Path, card_id: &str) -> PathBuf {
    card_path(root_path, card_id)
}

pub(crate) fn remove_file(path: impl AsRef<Path>) -> Result<()> {
    fs::remove_file(path).map_err(|error| error.to_string())
}

pub(crate) fn read_card(path: &Path) -> Result<Card> {
    read_json(path)
}

pub(crate) fn active_storage_root(app: &AppHandle, create: bool) -> Result<PathBuf> {
    let project = require_active_project(app)?;
    let registry = read_registry(app);
    let (root_path, _) = resolve_project_storage(&project, &registry, create)
        .ok_or_else(|| "Unable to resolve Trackboi storage path".to_string())?;
    Ok(root_path)
}

pub(crate) fn json_ok() -> Value {
    serde_json::json!({ "ok": true })
}
