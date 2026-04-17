use crate::core::model::{
    Board, Card, GitContext, Project, ProjectMetadata, ProjectSnapshot, WorkScope,
};
use crate::core::rank::rank_between;
use crate::core::storage::{atomic_write_json, default_columns, global_scope, now};
use crate::core::{DEFAULT_BOARD_ID, DEFAULT_STORAGE_SEARCH_PATHS, PROJECT_METADATA_FILE};
use rmcp::{
    handler::server::{router::tool::ToolRouter, wrapper::Parameters},
    model::*,
    tool, tool_handler, tool_router, ErrorData as McpError, ServerHandler, ServiceExt,
};
use schemars::JsonSchema;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use ulid::Ulid;

#[derive(Clone)]
pub struct TrackboiMcp {
    tool_router: ToolRouter<Self>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct ProjectPathArgs {
    /// Absolute or relative path to the project/repository root.
    project_path: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct CreateCardArgs {
    /// Absolute or relative path to the project/repository root.
    project_path: String,
    title: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default = "default_column")]
    column: String,
    #[serde(default)]
    parent_id: Option<String>,
    #[serde(default)]
    scope: Option<WorkScopeInput>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct WorkScopeInput {
    /// Either "project" or "branch".
    kind: String,
    /// "global" for project scope, or a git branch name for branch scope.
    #[serde(rename = "ref")]
    ref_: String,
}

struct Store {
    project_path: PathBuf,
    root_path: PathBuf,
    storage_path: String,
}

pub async fn run_stdio() -> Result<(), Box<dyn std::error::Error>> {
    let service = TrackboiMcp::new()
        .serve((tokio::io::stdin(), tokio::io::stdout()))
        .await?;
    service.waiting().await?;
    Ok(())
}

#[tool_router]
impl TrackboiMcp {
    pub fn new() -> Self {
        Self {
            tool_router: Self::tool_router(),
        }
    }

    /// Read the current Trackboi project snapshot for a repository path.
    #[tool(description = "Read the Trackboi project snapshot for a repository path")]
    fn get_project(
        &self,
        Parameters(args): Parameters<ProjectPathArgs>,
    ) -> Result<CallToolResult, McpError> {
        let store = Store::open(&args.project_path, true).map_err(mcp_error)?;
        let snapshot = store.read_snapshot().map_err(mcp_error)?;
        structured(snapshot)
    }

    /// List cards in the default board for a repository path.
    #[tool(description = "List cards in the default board for a repository path")]
    fn list_cards(
        &self,
        Parameters(args): Parameters<ProjectPathArgs>,
    ) -> Result<CallToolResult, McpError> {
        let store = Store::open(&args.project_path, true).map_err(mcp_error)?;
        let snapshot = store.read_snapshot().map_err(mcp_error)?;
        structured(snapshot.cards)
    }

    /// Create a card in the default board for a repository path.
    #[tool(description = "Create a card in the default board for a repository path")]
    fn create_card(
        &self,
        Parameters(args): Parameters<CreateCardArgs>,
    ) -> Result<CallToolResult, McpError> {
        let store = Store::open(&args.project_path, true).map_err(mcp_error)?;
        let card = store.create_card(args).map_err(mcp_error)?;
        structured(card)
    }
}

#[tool_handler]
impl ServerHandler for TrackboiMcp {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            capabilities: ServerCapabilities::builder().enable_tools().build(),
            server_info: Implementation {
                name: "trackboi".into(),
                title: Some("Trackboi".into()),
                version: env!("CARGO_PKG_VERSION").into(),
                description: Some("Project-local task board MCP server".into()),
                icons: None,
                website_url: None,
            },
            instructions: Some(
                "Trackboi MCP exposes project-path based tools for reading and writing Trackboi cards."
                    .into(),
            ),
            ..Default::default()
        }
    }
}

impl Store {
    fn open(project_path: &str, create: bool) -> Result<Self, String> {
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

        for storage_path in DEFAULT_STORAGE_SEARCH_PATHS {
            let root_path = project_path.join(storage_path);
            if storage_exists(&root_path) {
                return Ok(Self {
                    project_path,
                    root_path,
                    storage_path: storage_path.into(),
                });
            }
        }

        if !create {
            return Err("Trackboi storage has not been created for this project".into());
        }

        let storage_path = DEFAULT_STORAGE_SEARCH_PATHS[0].to_string();
        let root_path = project_path.join(&storage_path);
        fs::create_dir_all(cards_path(&root_path)).map_err(|error| error.to_string())?;
        fs::create_dir_all(boards_path(&root_path)).map_err(|error| error.to_string())?;

        let store = Self {
            project_path,
            root_path,
            storage_path,
        };
        store.ensure_project_files()?;
        Ok(store)
    }

    fn ensure_project_files(&self) -> Result<(), String> {
        let project = self.project();
        if !metadata_path(&self.root_path).exists() {
            atomic_write_json(
                &metadata_path(&self.root_path),
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

        if !board_path(&self.root_path).exists() {
            atomic_write_json(
                &board_path(&self.root_path),
                &Board {
                    version: 1,
                    name: project.name,
                    columns: default_columns(),
                    custom_fields: vec![],
                },
            )?;
        }

        Ok(())
    }

    fn read_snapshot(&self) -> Result<ProjectSnapshot, String> {
        self.ensure_project_files()?;
        let mut metadata = read_json::<ProjectMetadata>(&metadata_path(&self.root_path))?;
        let board = read_json::<Board>(&board_path(&self.root_path))?;
        if metadata.custom_fields.is_empty() && !board.custom_fields.is_empty() {
            metadata.custom_fields = board.custom_fields.clone();
            atomic_write_json(&metadata_path(&self.root_path), &metadata)?;
        }

        let mut cards = Vec::new();
        let cards_dir = cards_path(&self.root_path);
        if cards_dir.exists() {
            for entry in fs::read_dir(&cards_dir).map_err(|error| error.to_string())? {
                let entry = entry.map_err(|error| error.to_string())?;
                let path = entry.path();
                if path.extension().and_then(|extension| extension.to_str()) != Some("json") {
                    continue;
                }
                let card = read_json::<Card>(&path)?;
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

        Ok(ProjectSnapshot {
            project: self.project(),
            metadata,
            git: git_context(&self.project_path),
            board,
            cards,
        })
    }

    fn create_card(&self, args: CreateCardArgs) -> Result<Card, String> {
        self.ensure_project_files()?;
        let snapshot = self.read_snapshot()?;
        let title = args.title.trim();
        if title.is_empty() {
            return Err("Card title is required".into());
        }

        let mut column_cards = snapshot
            .cards
            .iter()
            .filter(|card| card.column == args.column)
            .collect::<Vec<_>>();
        column_cards.sort_by(|left, right| left.rank.cmp(&right.rank));
        let timestamp = now();
        let card = Card {
            id: new_id("card"),
            board_id: DEFAULT_BOARD_ID.into(),
            title: title.into(),
            description: args.description.unwrap_or_default().trim().into(),
            parent_id: args.parent_id,
            scope: args.scope.map(WorkScope::from).unwrap_or_else(global_scope),
            column: args.column,
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

    fn project(&self) -> Project {
        if let Ok(metadata) = read_json::<ProjectMetadata>(&metadata_path(&self.root_path)) {
            return Project {
                id: metadata.project_id,
                name: metadata.name,
                path: self.project_path.to_string_lossy().to_string(),
                storage_path: Some(self.storage_path.clone()),
            };
        }

        let name = self
            .project_path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("Project")
            .to_string();

        Project {
            id: new_id("project"),
            name,
            path: self.project_path.to_string_lossy().to_string(),
            storage_path: Some(self.storage_path.clone()),
        }
    }
}

impl From<WorkScopeInput> for WorkScope {
    fn from(scope: WorkScopeInput) -> Self {
        if scope.kind == "branch" && !scope.ref_.trim().is_empty() {
            return WorkScope {
                kind: "branch".into(),
                ref_: scope.ref_,
            };
        }

        global_scope()
    }
}

fn structured(value: impl Serialize) -> Result<CallToolResult, McpError> {
    Ok(CallToolResult::structured(
        serde_json::to_value(value)
            .map_err(|error| McpError::internal_error(error.to_string(), None))?,
    ))
}

fn mcp_error(error: String) -> McpError {
    McpError::internal_error(error, None)
}

fn new_id(prefix: &str) -> String {
    format!("{prefix}_{}", Ulid::new())
}

fn default_column() -> String {
    "todo".into()
}

fn read_json<T: DeserializeOwned>(path: &Path) -> Result<T, String> {
    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&content).map_err(|error| error.to_string())
}

fn storage_exists(root_path: &Path) -> bool {
    board_path(root_path).exists()
        || metadata_path(root_path).exists()
        || cards_path(root_path).exists()
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

fn metadata_path(root_path: &Path) -> PathBuf {
    root_path.join(PROJECT_METADATA_FILE)
}

fn card_path(root_path: &Path, card_id: &str) -> PathBuf {
    cards_path(root_path).join(format!("{card_id}.json"))
}

fn git_context(project_path: &Path) -> GitContext {
    let Some(root) = find_git_root(project_path) else {
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
