use super::model::*;
use super::rank::rank_between;
use super::storage::{
    active_snapshot, active_storage_root, atomic_write_json, card_path_for_active_project,
    card_path_in_root, ensure_project, json_ok, normalize_scope, normalize_storage_search_paths,
    project_metadata_path_for_active_project, project_status, read_card, read_project,
    read_project_metadata_file, read_registry, remove_file, require_active_project,
    resolve_project_storage, scope_for_git_context, storage_candidates, write_registry,
};
use super::{Result, DEFAULT_BOARD_ID};
use serde_json::{Map, Value};
use std::path::Path;
use tauri::AppHandle;
use ulid::Ulid;

fn new_id(prefix: &str) -> String {
    format!("{prefix}_{}", Ulid::new())
}

fn apply_card_patch(mut card: Card, patch: Value) -> Result<Card> {
    let Some(patch) = patch.as_object() else {
        return Ok(card);
    };

    if let Some(value) = patch.get("title") {
        if let Some(title) = value.as_str() {
            card.title = title.trim().into();
        }
    }
    if let Some(value) = patch.get("description") {
        if let Some(description) = value.as_str() {
            card.description = description.trim().into();
        }
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
    if let Some(value) = patch.get("column") {
        if let Some(column) = value.as_str() {
            card.column = column.into();
        }
    }
    if let Some(value) = patch.get("rank") {
        if let Some(rank) = value.as_str() {
            card.rank = rank.into();
        }
    }
    if let Some(value) = patch.get("boardId") {
        if let Some(board_id) = value.as_str() {
            card.board_id = board_id.into();
        }
    }
    if let Some(value) = patch.get("labels") {
        if let Some(labels) = value.as_array() {
            card.labels = labels
                .iter()
                .filter_map(|label| label.as_str().map(|label| label.to_string()))
                .collect();
        }
    }
    if patch.contains_key("assignee") {
        card.assignee = patch
            .get("assignee")
            .and_then(|value| value.as_str().map(|value| value.to_string()));
    }
    if let Some(value) = patch.get("fieldValues") {
        if let Some(values) = value.as_object() {
            card.field_values = values.clone();
        }
    }

    if card.title.trim().is_empty() {
        return Err("Card title is required".into());
    }

    card.updated_at = super::storage::now();
    Ok(card)
}

#[tauri::command]
pub fn get_active_project(app: AppHandle) -> Result<Option<ProjectSnapshot>> {
    active_snapshot(&app)
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
        return Ok(Some(ensure_project(&app, project)?));
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
    Ok(Some(ensure_project(&app, project)?))
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
        return Ok(Some(ensure_project(&app, duplicate)?));
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
    Ok(Some(ensure_project(&app, project)?))
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
    active_snapshot(&app)
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
    active_snapshot(&app)
}

#[tauri::command]
pub fn create_card(app: AppHandle, input: CreateCardInput) -> Result<Card> {
    let project = require_active_project(&app)?;
    let root_path = active_storage_root(&app, true)?;
    let snapshot = read_project(&app, project)?;
    let mut column_cards = snapshot
        .cards
        .iter()
        .filter(|card| card.column == input.column)
        .collect::<Vec<_>>();
    column_cards.sort_by(|left, right| left.rank.cmp(&right.rank));
    let timestamp = super::storage::now();
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
        field_values: Map::new(),
        created_at: timestamp.clone(),
        updated_at: timestamp,
    };

    atomic_write_json(&card_path_in_root(&root_path, &card.id), &card)?;
    Ok(card)
}

#[tauri::command]
pub fn update_card(app: AppHandle, card_id: String, patch: Value) -> Result<Card> {
    let path = card_path_for_active_project(&app, &card_id)?;
    let current = read_card(&path)?;
    let next = apply_card_patch(current, patch)?;
    atomic_write_json(&path, &next)?;
    Ok(next)
}

#[tauri::command]
pub fn update_board(app: AppHandle, board: Board) -> Result<Board> {
    let path = super::storage::board_path_for_active_project(&app)?;
    atomic_write_json(&path, &board)?;
    Ok(board)
}

#[tauri::command]
pub fn update_custom_fields(
    app: AppHandle,
    custom_fields: Vec<CustomField>,
) -> Result<ProjectMetadata> {
    let path = project_metadata_path_for_active_project(&app)?;
    let mut metadata = read_project_metadata_file(&path)?;
    metadata.custom_fields = custom_fields;
    atomic_write_json(&path, &metadata)?;
    Ok(metadata)
}

#[tauri::command]
pub fn move_card(app: AppHandle, input: MoveCardInput) -> Result<Card> {
    let project = require_active_project(&app)?;
    let root_path = active_storage_root(&app, false)?;
    let snapshot = read_project(&app, project)?;
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
        updated_at: super::storage::now(),
        ..moving
    };

    atomic_write_json(&card_path_in_root(&root_path, &input.card_id), &next)?;
    Ok(next)
}

#[tauri::command]
pub fn delete_card(app: AppHandle, card_id: String) -> Result<Value> {
    remove_file(card_path_for_active_project(&app, &card_id)?)?;
    Ok(json_ok())
}
