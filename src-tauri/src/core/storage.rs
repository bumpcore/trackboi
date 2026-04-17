use super::model::*;
use super::{Result, DEFAULT_BOARD_ID, DEFAULT_STORAGE_SEARCH_PATHS, PROJECT_METADATA_FILE};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
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

pub(crate) fn storage_root(project_path: &str, storage_path: &str) -> PathBuf {
    Path::new(project_path).join(storage_path)
}

pub(crate) fn cards_path(root_path: &Path) -> PathBuf {
    root_path.join("cards")
}

pub(crate) fn boards_path(root_path: &Path) -> PathBuf {
    root_path.join("boards")
}

pub(crate) fn board_path(root_path: &Path) -> PathBuf {
    boards_path(root_path).join(format!("{DEFAULT_BOARD_ID}.json"))
}

pub(crate) fn project_metadata_path(root_path: &Path) -> PathBuf {
    root_path.join(PROJECT_METADATA_FILE)
}

pub(crate) fn card_path(root_path: &Path, card_id: &str) -> PathBuf {
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

pub(crate) fn read_json<T: for<'de> Deserialize<'de>>(path: &Path) -> Result<T> {
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
    // active_project_id may reference a discovered (non-manual) entry, so we cannot
    // filter it against registry.projects alone. Only fall back to the first manual
    // entry when no active is set at all; stale ids resolve to None at lookup time.
    let active_project_id = registry
        .active_project_id
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
    let id = registry.active_project_id.as_ref()?;
    if let Some(project) = registry.projects.iter().find(|project| &project.id == id) {
        return Some(project.clone());
    }
    // Discovered-entry ids encode their own path; synthesize a minimal Project
    // so we never recurse into assemble_view here.
    let path = super::sources::decode_discovered_path(id)?;
    let name = Path::new(&path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Project")
        .to_string();
    Some(Project {
        id: id.clone(),
        name,
        path,
        storage_path: None,
    })
}

pub(crate) fn active_project_path(registry: &ProjectRegistry) -> Option<String> {
    active_project_from_registry(registry).map(|project| project.path)
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

pub(crate) fn storage_exists(root_path: &Path) -> bool {
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

pub(crate) fn read_git_context(project_path: &str) -> GitContext {
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
    let dirty = Command::new("git")
        .arg("-C")
        .arg(&root)
        .arg("status")
        .arg("--porcelain")
        .output()
        .ok()
        .filter(|output| output.status.success())
        .map(|output| !output.stdout.is_empty());

    GitContext {
        is_git_repo: true,
        root: Some(root.to_string_lossy().to_string()),
        detached: branch.is_none(),
        branch,
        dirty,
    }
}

pub(crate) fn project_status(project: &Project, registry: &ProjectRegistry) -> ProjectStatus {
    if !Path::new(&project.path).exists() {
        return ProjectStatus::Missing;
    }

    let Some((root_path, _)) = resolve_project_storage(project, registry, false) else {
        return ProjectStatus::Uninitialized;
    };

    if !board_path(&root_path).exists() {
        return ProjectStatus::Uninitialized;
    }

    ProjectStatus::Ready
}

pub(crate) fn ensure_project(app: &AppHandle, project: Project) -> Result<ProjectSnapshot> {
    let registry = read_registry(app);
    let store = super::service::ProjectStore::open(project, &registry, true)?;
    store.ensure_project_files()?;
    remember_project_storage(app, &store.project().id, &store.storage_path)?;
    store.read_snapshot()
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_preserves_discovered_active_id() {
        let registry = ProjectRegistry {
            projects: vec![Project {
                id: "proj_manual".into(),
                name: "Manual".into(),
                path: "/tmp/manual".into(),
                storage_path: Some(".trackboi".into()),
            }],
            active_project_id: Some("worktree:/tmp/elsewhere".into()),
            storage_search_paths: Some(default_storage_search_paths()),
        };
        let sanitized = sanitize_registry(registry);
        assert_eq!(
            sanitized.active_project_id.as_deref(),
            Some("worktree:/tmp/elsewhere")
        );
    }

    #[test]
    fn active_project_resolves_discovered_worktree_id_without_recursion() {
        let registry = ProjectRegistry {
            projects: vec![],
            active_project_id: Some("worktree:/tmp/sibling".into()),
            storage_search_paths: Some(default_storage_search_paths()),
        };
        // If this call recurses into assemble_view it would stack-overflow; reaching
        // this assertion means the resolution stayed on the non-recursive path.
        let project = active_project_from_registry(&registry).expect("active resolves");
        assert_eq!(project.path, "/tmp/sibling");
        assert_eq!(project.id, "worktree:/tmp/sibling");
    }

    #[test]
    fn sanitize_falls_back_when_active_is_none() {
        let registry = ProjectRegistry {
            projects: vec![Project {
                id: "proj_manual".into(),
                name: "Manual".into(),
                path: "/tmp/manual".into(),
                storage_path: Some(".trackboi".into()),
            }],
            active_project_id: None,
            storage_search_paths: Some(default_storage_search_paths()),
        };
        let sanitized = sanitize_registry(registry);
        assert_eq!(sanitized.active_project_id.as_deref(), Some("proj_manual"));
    }
}
