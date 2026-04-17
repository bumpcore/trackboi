use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Column {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomField {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub field_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Board {
    pub version: u8,
    pub name: String,
    pub columns: Vec<Column>,
    #[serde(default)]
    pub custom_fields: Vec<CustomField>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMetadata {
    pub version: u8,
    pub project_id: String,
    pub name: String,
    pub storage_path: String,
    pub created_at: String,
    #[serde(default)]
    pub custom_fields: Vec<CustomField>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkScope {
    pub kind: String,
    #[serde(rename = "ref")]
    pub ref_: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Card {
    pub id: String,
    #[serde(default = "default_board_id")]
    pub board_id: String,
    pub title: String,
    pub description: String,
    pub parent_id: Option<String>,
    pub scope: WorkScope,
    pub column: String,
    pub rank: String,
    pub labels: Vec<String>,
    pub assignee: Option<String>,
    #[serde(default)]
    pub field_values: Map<String, Value>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub storage_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRegistry {
    pub projects: Vec<Project>,
    pub active_project_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub storage_search_paths: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectIndexEntry {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub storage_path: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectIndex {
    pub projects: Vec<ProjectIndexEntry>,
    pub active_project_id: Option<String>,
    pub storage_search_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitContext {
    pub is_git_repo: bool,
    pub root: Option<String>,
    pub branch: Option<String>,
    pub detached: bool,
    pub dirty: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSnapshot {
    pub project: Project,
    pub metadata: ProjectMetadata,
    pub git: GitContext,
    pub board: Board,
    pub cards: Vec<Card>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCardInput {
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub parent_id: Option<String>,
    pub column: String,
    #[serde(default)]
    pub scope: Option<WorkScope>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveCardInput {
    pub card_id: String,
    pub to_column: String,
    #[serde(default)]
    pub before_card_id: Option<String>,
}

fn default_board_id() -> String {
    "default".into()
}
