use super::model::*;
use super::storage::{project_status, resolve_project_storage};
use std::collections::HashSet;
use std::path::PathBuf;

pub(crate) const MANUAL_SOURCE_ID: &str = "manual";

pub(crate) struct ProjectSourceContext<'a> {
    pub registry: &'a ProjectRegistry,
}

pub(crate) trait ProjectSourceProvider {
    fn source_id(&self) -> String;
    fn kind(&self) -> ProjectSourceKind;
    fn label(&self, context: &ProjectSourceContext) -> String;
    fn enumerate(&self, context: &ProjectSourceContext) -> Vec<ProjectEntry>;
}

pub(crate) struct ManualRegistryProvider;

impl ProjectSourceProvider for ManualRegistryProvider {
    fn source_id(&self) -> String {
        MANUAL_SOURCE_ID.into()
    }

    fn kind(&self) -> ProjectSourceKind {
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
            kind: provider.kind(),
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

pub(crate) fn default_providers() -> Vec<Box<dyn ProjectSourceProvider>> {
    vec![Box::new(ManualRegistryProvider)]
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
        fn kind(&self) -> ProjectSourceKind {
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
}
