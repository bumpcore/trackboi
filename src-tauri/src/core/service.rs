use super::model::*;
use super::rank::rank_between;
use super::storage::{
    atomic_write_json, board_path, boards_path, card_path, cards_path, default_columns,
    default_storage_search_paths, normalize_scope, read_git_context, read_json,
    resolve_project_storage, scope_for_git_context,
};
use super::{Result, DEFAULT_BOARD_ID};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use ulid::Ulid;

pub(crate) struct ProjectStore {
    project: Project,
    root_path: PathBuf,
    pub(crate) storage_path: String,
}

impl ProjectStore {
    pub(crate) fn open(project: Project, registry: &ProjectRegistry, create: bool) -> Result<Self> {
        let (root_path, storage_path) = resolve_project_storage(&project, registry, create)
            .ok_or_else(|| "Trackboi storage has not been created for this project".to_string())?;

        Ok(Self {
            project: Project {
                storage_path: Some(storage_path.clone()),
                ..project
            },
            root_path,
            storage_path,
        })
    }

    pub(crate) fn open_project_path(project_path: &str, create: bool) -> Result<Self> {
        let project_path = PathBuf::from(project_path);
        let project_path = if project_path.is_absolute() {
            project_path
        } else {
            std::env::current_dir()
                .map_err(|error| error.to_string())?
                .join(project_path)
        };
        let project_path = project_path
            .canonicalize()
            .map_err(|error| format!("Project path does not exist: {error}"))?;
        let name = project_name(&project_path);
        let project = Project {
            id: new_id("project"),
            name,
            path: project_path.to_string_lossy().to_string(),
            storage_path: None,
        };
        let registry = ProjectRegistry {
            projects: vec![project.clone()],
            active_project_id: Some(project.id.clone()),
            storage_search_paths: Some(default_storage_search_paths()),
            active_workspace_file: None,
        };

        Self::open(project, &registry, create)
    }

    pub(crate) fn project(&self) -> Project {
        if let Ok(metadata) = read_json::<ProjectMetadata>(&project_metadata_path(&self.root_path))
        {
            return Project {
                id: metadata.project_id,
                name: metadata.name,
                path: self.project.path.clone(),
                storage_path: Some(self.storage_path.clone()),
            };
        }

        self.project.clone()
    }

    pub(crate) fn ensure_project_files(&self) -> Result<()> {
        fs::create_dir_all(boards_path(&self.root_path)).map_err(|error| error.to_string())?;
        fs::create_dir_all(cards_path(&self.root_path)).map_err(|error| error.to_string())?;

        let project = self.project();
        let metadata_path = project_metadata_path(&self.root_path);
        if !metadata_path.exists() {
            atomic_write_json(
                &metadata_path,
                &ProjectMetadata {
                    version: 1,
                    project_id: project.id.clone(),
                    name: project.name.clone(),
                    storage_path: self.storage_path.clone(),
                    created_at: now(),
                    custom_fields: vec![],
                },
            )?;
        }

        let path = board_path(&self.root_path);
        if !path.exists() {
            atomic_write_json(
                &path,
                &Board {
                    version: 1,
                    name: if project.name.is_empty() {
                        project_name(Path::new(&project.path))
                    } else {
                        project.name
                    },
                    columns: default_columns(),
                    custom_fields: vec![],
                },
            )?;
        }

        Ok(())
    }

    pub(crate) fn read_snapshot(&self) -> Result<ProjectSnapshot> {
        self.ensure_project_files()?;
        let mut metadata = read_json::<ProjectMetadata>(&project_metadata_path(&self.root_path))?;
        let board = read_json::<Board>(&board_path(&self.root_path))?;
        if metadata.custom_fields.is_empty() && !board.custom_fields.is_empty() {
            metadata.custom_fields = board.custom_fields.clone();
            atomic_write_json(&project_metadata_path(&self.root_path), &metadata)?;
        }

        let mut cards = Vec::new();
        let card_dir = cards_path(&self.root_path);
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
                if card.board_id == DEFAULT_BOARD_ID {
                    cards.push(card);
                }
            }
        }

        cards.sort_by(|left, right| {
            left.column
                .cmp(&right.column)
                .then(left.rank.cmp(&right.rank))
        });

        let project = self.project();
        Ok(ProjectSnapshot {
            project,
            metadata,
            git: read_git_context(&self.project.path),
            board,
            cards,
        })
    }

    pub(crate) fn create_card(&self, input: CreateCardInput) -> Result<Card> {
        let snapshot = self.read_snapshot()?;
        let mut column_cards = snapshot
            .cards
            .iter()
            .filter(|card| card.column == input.column)
            .collect::<Vec<_>>();
        column_cards.sort_by(|left, right| left.rank.cmp(&right.rank));
        let timestamp = now();
        let title = input.title.trim().to_string();

        if title.is_empty() {
            return Err("Card title is required".into());
        }

        let card = Card {
            id: new_id("card"),
            board_id: DEFAULT_BOARD_ID.into(),
            title,
            description: input.description.unwrap_or_default().trim().into(),
            parent_id: input.parent_id,
            scope: input
                .scope
                .unwrap_or_else(|| scope_for_git_context(&snapshot.git)),
            column: input.column,
            rank: rank_between(column_cards.last().map(|card| card.rank.as_str()), None)?,
            labels: vec![],
            assignee: None,
            field_values: Default::default(),
            created_at: timestamp.clone(),
            updated_at: timestamp,
        };

        atomic_write_json(&card_path(&self.root_path, &card.id), &card)?;
        Ok(card)
    }

    pub(crate) fn update_card(&self, card_id: &str, patch: Value) -> Result<Card> {
        let path = card_path(&self.root_path, card_id);
        let current = read_json::<Card>(&path)?;
        let next = apply_card_patch(current, patch)?;
        atomic_write_json(&path, &next)?;
        Ok(next)
    }

    pub(crate) fn update_board(&self, board: Board) -> Result<Board> {
        atomic_write_json(&board_path(&self.root_path), &board)?;
        Ok(board)
    }

    pub(crate) fn update_custom_fields(
        &self,
        custom_fields: Vec<CustomField>,
    ) -> Result<ProjectMetadata> {
        let path = project_metadata_path(&self.root_path);
        let mut metadata = read_json::<ProjectMetadata>(&path)?;
        metadata.custom_fields = custom_fields;
        atomic_write_json(&path, &metadata)?;
        Ok(metadata)
    }

    pub(crate) fn move_card(&self, input: MoveCardInput) -> Result<Card> {
        let snapshot = self.read_snapshot()?;
        let moving = snapshot
            .cards
            .iter()
            .find(|card| card.id == input.card_id)
            .cloned()
            .ok_or_else(|| format!("Unknown card: {}", input.card_id))?;
        let mut target_cards = snapshot
            .cards
            .iter()
            .filter(|card| card.id != input.card_id && card.column == input.to_column)
            .collect::<Vec<_>>();
        target_cards.sort_by(|left, right| left.rank.cmp(&right.rank));

        let before_index = input.before_card_id.as_ref().and_then(|before_card_id| {
            target_cards
                .iter()
                .position(|card| &card.id == before_card_id)
        });
        let previous_rank = match before_index {
            Some(index) if index > 0 => Some(target_cards[index - 1].rank.as_str()),
            Some(0) => None,
            _ => target_cards.last().map(|card| card.rank.as_str()),
        };
        let next_rank = before_index.map(|index| target_cards[index].rank.as_str());
        let next = Card {
            column: input.to_column,
            rank: rank_between(previous_rank, next_rank)?,
            updated_at: now(),
            ..moving
        };

        atomic_write_json(&card_path(&self.root_path, &input.card_id), &next)?;
        Ok(next)
    }

    pub(crate) fn delete_card(&self, card_id: &str) -> Result<()> {
        fs::remove_file(card_path(&self.root_path, card_id)).map_err(|error| error.to_string())
    }
}

fn apply_card_patch(mut card: Card, patch: Value) -> Result<Card> {
    let Some(patch) = patch.as_object() else {
        return Ok(card);
    };

    if let Some(value) = patch.get("title").and_then(|value| value.as_str()) {
        card.title = value.trim().into();
    }
    if let Some(value) = patch.get("description").and_then(|value| value.as_str()) {
        card.description = value.trim().into();
    }
    if patch.contains_key("parentId") {
        card.parent_id = patch
            .get("parentId")
            .and_then(|value| value.as_str().map(|value| value.to_string()));
    }
    if let Some(value) = patch.get("scope") {
        let scope = serde_json::from_value::<WorkScope>(value.clone())
            .map_err(|error| error.to_string())?;
        card.scope = normalize_scope(scope);
    }
    if let Some(value) = patch.get("column").and_then(|value| value.as_str()) {
        card.column = value.into();
    }
    if let Some(value) = patch.get("rank").and_then(|value| value.as_str()) {
        card.rank = value.into();
    }
    if let Some(value) = patch.get("boardId").and_then(|value| value.as_str()) {
        card.board_id = value.into();
    }
    if let Some(labels) = patch.get("labels").and_then(|value| value.as_array()) {
        card.labels = labels
            .iter()
            .filter_map(|label| label.as_str().map(|label| label.to_string()))
            .collect();
    }
    if patch.contains_key("assignee") {
        card.assignee = patch
            .get("assignee")
            .and_then(|value| value.as_str().map(|value| value.to_string()));
    }
    if let Some(values) = patch.get("fieldValues").and_then(|value| value.as_object()) {
        card.field_values = values.clone();
    }

    if card.title.trim().is_empty() {
        return Err("Card title is required".into());
    }

    card.updated_at = now();
    Ok(card)
}

fn project_metadata_path(root_path: &Path) -> PathBuf {
    root_path.join(super::PROJECT_METADATA_FILE)
}

fn now() -> String {
    super::storage::now()
}

fn new_id(prefix: &str) -> String {
    format!("{prefix}_{}", Ulid::new())
}

fn project_name(project_path: &Path) -> String {
    project_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Project")
        .into()
}
