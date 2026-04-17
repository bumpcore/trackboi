use super::model::*;
use super::storage::{active_project_path, project_status, resolve_project_storage};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::process::Command;

pub(crate) const MANUAL_SOURCE_ID: &str = "manual";

pub(crate) struct ProjectSourceContext<'a> {
    pub registry: &'a ProjectRegistry,
}

pub(crate) trait ProjectSourceProvider {
    fn source_id(&self) -> String;
    fn kind(&self, context: &ProjectSourceContext) -> ProjectSourceKind;
    fn label(&self, context: &ProjectSourceContext) -> String;
    fn enumerate(&self, context: &ProjectSourceContext) -> Vec<ProjectEntry>;
}

pub(crate) struct ManualRegistryProvider;

impl ProjectSourceProvider for ManualRegistryProvider {
    fn source_id(&self) -> String {
        MANUAL_SOURCE_ID.into()
    }

    fn kind(&self, _context: &ProjectSourceContext) -> ProjectSourceKind {
        ProjectSourceKind::Manual
    }

    fn label(&self, _context: &ProjectSourceContext) -> String {
        "Projects".into()
    }

    fn enumerate(&self, context: &ProjectSourceContext) -> Vec<ProjectEntry> {
        context
            .registry
            .projects
            .iter()
            .map(|project| ProjectEntry {
                project_id: project.id.clone(),
                name: project.name.clone(),
                path: project.path.clone(),
                storage_path: project.storage_path.clone(),
                status: project_status(project, context.registry),
            })
            .collect()
    }
}

fn canonical_storage_key(entry: &ProjectEntry, registry: &ProjectRegistry) -> Option<PathBuf> {
    let project = Project {
        id: entry.project_id.clone(),
        name: entry.name.clone(),
        path: entry.path.clone(),
        storage_path: entry.storage_path.clone(),
    };
    resolve_project_storage(&project, registry, false).map(|(root_path, _)| root_path)
}

pub(crate) fn assemble_view(
    providers: &[Box<dyn ProjectSourceProvider>],
    registry: &ProjectRegistry,
) -> ProjectView {
    let context = ProjectSourceContext { registry };
    let mut seen_paths: HashSet<PathBuf> = HashSet::new();
    let mut sources: Vec<ProjectSource> = Vec::with_capacity(providers.len());

    for provider in providers {
        let entries = provider.enumerate(&context);
        let mut kept = Vec::with_capacity(entries.len());

        for entry in entries {
            let key = canonical_storage_key(&entry, registry)
                .unwrap_or_else(|| PathBuf::from(&entry.path));
            if seen_paths.insert(key) {
                kept.push(entry);
            }
        }

        sources.push(ProjectSource {
            id: provider.source_id(),
            kind: provider.kind(&context),
            label: provider.label(&context),
            entries: kept,
        });
    }

    ProjectView {
        sources,
        active_project_id: registry.active_project_id.clone(),
        storage_search_paths: super::storage::storage_candidates(registry, None),
    }
}

pub(crate) struct GitWorktreesProvider;

impl ProjectSourceProvider for GitWorktreesProvider {
    fn source_id(&self) -> String {
        "git_worktrees".into()
    }

    fn kind(&self, context: &ProjectSourceContext) -> ProjectSourceKind {
        ProjectSourceKind::GitWorktrees {
            repo_root: active_repo_root(context).unwrap_or_default(),
        }
    }

    fn label(&self, context: &ProjectSourceContext) -> String {
        match active_repo_root(context) {
            Some(root) => {
                let name = Path::new(&root)
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("repository");
                format!("Worktrees of {name}")
            }
            None => "Worktrees".into(),
        }
    }

    fn enumerate(&self, context: &ProjectSourceContext) -> Vec<ProjectEntry> {
        let Some(repo_root) = active_repo_root(context) else {
            return vec![];
        };
        let Some(worktree_paths) = list_worktrees(Path::new(&repo_root)) else {
            return vec![];
        };

        worktree_paths
            .into_iter()
            .filter_map(|path| build_worktree_entry(&path, context.registry))
            .collect()
    }
}

fn active_repo_root(context: &ProjectSourceContext) -> Option<String> {
    let path = active_project_path(context.registry)?;
    find_git_root(Path::new(&path)).map(|p| p.to_string_lossy().into_owned())
}

fn find_git_root(start_path: &Path) -> Option<PathBuf> {
    let mut current = start_path.to_path_buf();
    for _ in 0..64 {
        if current.join(".git").exists() {
            return Some(current);
        }
        if !current.pop() {
            return None;
        }
    }
    None
}

fn list_worktrees(repo_root: &Path) -> Option<Vec<PathBuf>> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo_root)
        .arg("worktree")
        .arg("list")
        .arg("--porcelain")
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    Some(parse_worktree_list(&String::from_utf8_lossy(&output.stdout)))
}

fn parse_worktree_list(stdout: &str) -> Vec<PathBuf> {
    stdout
        .lines()
        .filter_map(|line| line.strip_prefix("worktree "))
        .map(PathBuf::from)
        .collect()
}

fn build_worktree_entry(path: &Path, registry: &ProjectRegistry) -> Option<ProjectEntry> {
    let path_string = path.to_string_lossy().into_owned();
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("worktree")
        .to_string();
    let synthetic = Project {
        id: worktree_project_id(&path_string),
        name: name.clone(),
        path: path_string.clone(),
        storage_path: None,
    };
    let (storage_path, status) = match resolve_project_storage(&synthetic, registry, false) {
        Some((root_path, storage_path)) => {
            let status = if super::storage::board_path(&root_path).exists() {
                ProjectStatus::Ready
            } else {
                ProjectStatus::Uninitialized
            };
            (Some(storage_path), status)
        }
        None => (None, ProjectStatus::Uninitialized),
    };
    if !path.exists() {
        return Some(ProjectEntry {
            project_id: synthetic.id,
            name,
            path: path_string,
            storage_path,
            status: ProjectStatus::Missing,
        });
    }
    Some(ProjectEntry {
        project_id: synthetic.id,
        name,
        path: path_string,
        storage_path,
        status,
    })
}

pub(crate) fn worktree_project_id(canonical_path: &str) -> String {
    format!("worktree:{canonical_path}")
}

pub(crate) fn workspace_project_id(canonical_path: &str) -> String {
    format!("workspace:{canonical_path}")
}

// Discovered-entry ids encode their path as "<source>:<canonical_path>". This lets
// active_project_from_registry resolve them without running providers, which would
// recurse (providers read the active project path while computing the view).
pub(crate) fn decode_discovered_path(project_id: &str) -> Option<String> {
    for prefix in &["worktree:", "workspace:"] {
        if let Some(rest) = project_id.strip_prefix(prefix) {
            return Some(rest.to_string());
        }
    }
    None
}

pub(crate) fn find_entry_by_id(
    project_id: &str,
    registry: &ProjectRegistry,
) -> Option<ProjectEntry> {
    let view = assemble_view(&default_providers(), registry);
    view.sources
        .into_iter()
        .flat_map(|source| source.entries)
        .find(|entry| entry.project_id == project_id)
}

pub(crate) struct CodeWorkspaceProvider;

#[derive(serde::Deserialize)]
struct CodeWorkspaceFile {
    folders: Vec<CodeWorkspaceFolder>,
}

#[derive(serde::Deserialize)]
struct CodeWorkspaceFolder {
    path: String,
    #[serde(default)]
    name: Option<String>,
}

impl ProjectSourceProvider for CodeWorkspaceProvider {
    fn source_id(&self) -> String {
        "code_workspace".into()
    }

    fn kind(&self, context: &ProjectSourceContext) -> ProjectSourceKind {
        ProjectSourceKind::CodeWorkspace {
            file_path: active_workspace_file(context)
                .map(|path| path.to_string_lossy().into_owned())
                .unwrap_or_default(),
        }
    }

    fn label(&self, context: &ProjectSourceContext) -> String {
        match active_workspace_file(context) {
            Some(path) => {
                let name = path
                    .file_stem()
                    .and_then(|name| name.to_str())
                    .unwrap_or("workspace");
                format!("Workspace: {name}")
            }
            None => "Workspace folders".into(),
        }
    }

    fn enumerate(&self, context: &ProjectSourceContext) -> Vec<ProjectEntry> {
        let Some(workspace_path) = active_workspace_file(context) else {
            return vec![];
        };
        let Some(workspace_dir) = workspace_path.parent() else {
            return vec![];
        };
        let Some(contents) = std::fs::read_to_string(&workspace_path).ok() else {
            return vec![];
        };
        let Ok(workspace) = serde_json::from_str::<CodeWorkspaceFile>(&contents) else {
            return vec![];
        };

        workspace
            .folders
            .into_iter()
            .filter_map(|folder| build_workspace_entry(&folder, workspace_dir, context.registry))
            .collect()
    }
}

fn active_workspace_file(context: &ProjectSourceContext) -> Option<PathBuf> {
    let project_path = active_project_path(context.registry)?;
    let dir = PathBuf::from(&project_path);
    if !dir.is_dir() {
        return None;
    }
    let entries = std::fs::read_dir(&dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) == Some("code-workspace") {
            return Some(path);
        }
    }
    None
}

fn build_workspace_entry(
    folder: &CodeWorkspaceFolder,
    workspace_dir: &Path,
    registry: &ProjectRegistry,
) -> Option<ProjectEntry> {
    let resolved = if Path::new(&folder.path).is_absolute() {
        PathBuf::from(&folder.path)
    } else {
        workspace_dir.join(&folder.path)
    };
    let canonical = resolved.canonicalize().unwrap_or(resolved);
    let path_string = canonical.to_string_lossy().into_owned();
    let name = folder.name.clone().unwrap_or_else(|| {
        canonical
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("folder")
            .to_string()
    });
    let synthetic = Project {
        id: workspace_project_id(&path_string),
        name: name.clone(),
        path: path_string.clone(),
        storage_path: None,
    };
    let (storage_path, status) = match resolve_project_storage(&synthetic, registry, false) {
        Some((root_path, storage_path)) => {
            let status = if super::storage::board_path(&root_path).exists() {
                ProjectStatus::Ready
            } else {
                ProjectStatus::Uninitialized
            };
            (Some(storage_path), status)
        }
        None => (None, ProjectStatus::Uninitialized),
    };
    if !canonical.exists() {
        return Some(ProjectEntry {
            project_id: synthetic.id,
            name,
            path: path_string,
            storage_path,
            status: ProjectStatus::Missing,
        });
    }
    Some(ProjectEntry {
        project_id: synthetic.id,
        name,
        path: path_string,
        storage_path,
        status,
    })
}

pub(crate) fn default_providers() -> Vec<Box<dyn ProjectSourceProvider>> {
    vec![
        Box::new(ManualRegistryProvider),
        Box::new(GitWorktreesProvider),
        Box::new(CodeWorkspaceProvider),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::storage::default_storage_search_paths;

    fn make_registry(projects: Vec<Project>) -> ProjectRegistry {
        ProjectRegistry {
            active_project_id: projects.first().map(|project| project.id.clone()),
            projects,
            storage_search_paths: Some(default_storage_search_paths()),
        }
    }

    fn make_entry(id: &str, path: &str) -> ProjectEntry {
        ProjectEntry {
            project_id: id.into(),
            name: id.into(),
            path: path.into(),
            storage_path: Some(".trackboi".into()),
            status: ProjectStatus::Uninitialized,
        }
    }

    struct StaticProvider {
        id: String,
        entries: Vec<ProjectEntry>,
    }

    impl ProjectSourceProvider for StaticProvider {
        fn source_id(&self) -> String {
            self.id.clone()
        }
        fn kind(&self, _: &ProjectSourceContext) -> ProjectSourceKind {
            ProjectSourceKind::Manual
        }
        fn label(&self, _: &ProjectSourceContext) -> String {
            self.id.clone()
        }
        fn enumerate(&self, _: &ProjectSourceContext) -> Vec<ProjectEntry> {
            self.entries.clone()
        }
    }

    #[test]
    fn empty_providers_produce_empty_view() {
        let registry = make_registry(vec![]);
        let view = assemble_view(&[], &registry);
        assert!(view.sources.is_empty());
        assert_eq!(view.active_project_id, None);
    }

    #[test]
    fn single_source_passes_entries_through() {
        let registry = make_registry(vec![]);
        let providers: Vec<Box<dyn ProjectSourceProvider>> = vec![Box::new(StaticProvider {
            id: "s1".into(),
            entries: vec![make_entry("p1", "/tmp/alpha"), make_entry("p2", "/tmp/beta")],
        })];
        let view = assemble_view(&providers, &registry);
        assert_eq!(view.sources.len(), 1);
        assert_eq!(view.sources[0].entries.len(), 2);
    }

    #[test]
    fn disjoint_sources_keep_all_entries() {
        let registry = make_registry(vec![]);
        let providers: Vec<Box<dyn ProjectSourceProvider>> = vec![
            Box::new(StaticProvider {
                id: "s1".into(),
                entries: vec![make_entry("p1", "/tmp/alpha")],
            }),
            Box::new(StaticProvider {
                id: "s2".into(),
                entries: vec![make_entry("p2", "/tmp/beta")],
            }),
        ];
        let view = assemble_view(&providers, &registry);
        assert_eq!(view.sources[0].entries.len(), 1);
        assert_eq!(view.sources[1].entries.len(), 1);
    }

    #[test]
    fn overlapping_sources_prefer_first_seen() {
        let registry = make_registry(vec![]);
        let providers: Vec<Box<dyn ProjectSourceProvider>> = vec![
            Box::new(StaticProvider {
                id: "s1".into(),
                entries: vec![make_entry("manual_p", "/tmp/alpha")],
            }),
            Box::new(StaticProvider {
                id: "s2".into(),
                entries: vec![make_entry("discovered_p", "/tmp/alpha")],
            }),
        ];
        let view = assemble_view(&providers, &registry);
        assert_eq!(view.sources[0].entries.len(), 1);
        assert_eq!(view.sources[0].entries[0].project_id, "manual_p");
        assert_eq!(view.sources[1].entries.len(), 0);
    }

    #[test]
    fn manual_registry_produces_one_entry_per_project() {
        let registry = make_registry(vec![Project {
            id: "proj_1".into(),
            name: "Alpha".into(),
            path: "/tmp/alpha".into(),
            storage_path: Some(".trackboi".into()),
        }]);
        let providers: Vec<Box<dyn ProjectSourceProvider>> = vec![Box::new(ManualRegistryProvider)];
        let view = assemble_view(&providers, &registry);
        assert_eq!(view.sources.len(), 1);
        assert_eq!(view.sources[0].entries.len(), 1);
        assert_eq!(view.sources[0].entries[0].project_id, "proj_1");
    }

    #[test]
    fn parses_porcelain_worktree_list() {
        let stdout = "\
worktree /home/user/repo
HEAD abcdef
branch refs/heads/main

worktree /home/user/repo-spike
HEAD 123456
branch refs/heads/spike/foo

worktree /home/user/repo-bare
bare
";
        let paths = parse_worktree_list(stdout);
        assert_eq!(paths.len(), 3);
        assert_eq!(paths[0], PathBuf::from("/home/user/repo"));
        assert_eq!(paths[1], PathBuf::from("/home/user/repo-spike"));
        assert_eq!(paths[2], PathBuf::from("/home/user/repo-bare"));
    }

    #[test]
    fn parses_empty_worktree_list() {
        assert!(parse_worktree_list("").is_empty());
    }

    #[test]
    fn worktree_project_id_is_deterministic() {
        assert_eq!(
            worktree_project_id("/tmp/alpha"),
            worktree_project_id("/tmp/alpha")
        );
        assert_ne!(
            worktree_project_id("/tmp/alpha"),
            worktree_project_id("/tmp/beta")
        );
    }

    #[test]
    fn find_entry_by_id_locates_manual_entry() {
        let registry = make_registry(vec![Project {
            id: "proj_1".into(),
            name: "Alpha".into(),
            path: "/tmp/alpha".into(),
            storage_path: Some(".trackboi".into()),
        }]);
        let entry = find_entry_by_id("proj_1", &registry);
        assert!(entry.is_some());
        assert_eq!(entry.unwrap().name, "Alpha");
    }

    #[test]
    fn find_entry_by_id_returns_none_for_missing() {
        let registry = make_registry(vec![]);
        assert!(find_entry_by_id("nonexistent", &registry).is_none());
    }

    #[test]
    fn parses_code_workspace_folders() {
        let json = r#"{
            "folders": [
                { "path": "../alpha" },
                { "name": "Bravo", "path": "/abs/beta" }
            ]
        }"#;
        let workspace: CodeWorkspaceFile =
            serde_json::from_str(json).expect("valid code-workspace JSON");
        assert_eq!(workspace.folders.len(), 2);
        assert_eq!(workspace.folders[0].path, "../alpha");
        assert_eq!(workspace.folders[1].name.as_deref(), Some("Bravo"));
    }

    #[test]
    fn workspace_id_is_deterministic_and_distinct_from_worktree() {
        assert_eq!(
            workspace_project_id("/tmp/alpha"),
            workspace_project_id("/tmp/alpha")
        );
        assert_ne!(
            workspace_project_id("/tmp/alpha"),
            worktree_project_id("/tmp/alpha")
        );
    }

    #[test]
    fn decode_discovered_path_recognizes_both_prefixes() {
        assert_eq!(
            decode_discovered_path("worktree:/tmp/a"),
            Some("/tmp/a".into())
        );
        assert_eq!(
            decode_discovered_path("workspace:/tmp/b"),
            Some("/tmp/b".into())
        );
        assert_eq!(decode_discovered_path("proj_ulid_abc"), None);
    }
}
