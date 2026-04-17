use crate::core::model::{CreateCardInput, WorkScope};
use crate::core::service::ProjectStore;
use crate::core::storage::global_scope;
use rmcp::{
    handler::server::{router::tool::ToolRouter, wrapper::Parameters},
    model::*,
    tool, tool_handler, tool_router, ErrorData as McpError, ServerHandler, ServiceExt,
};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

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
        let store = ProjectStore::open_project_path(&args.project_path, true).map_err(mcp_error)?;
        let snapshot = store.read_snapshot().map_err(mcp_error)?;
        structured(snapshot)
    }

    /// List cards in the default board for a repository path.
    #[tool(description = "List cards in the default board for a repository path")]
    fn list_cards(
        &self,
        Parameters(args): Parameters<ProjectPathArgs>,
    ) -> Result<CallToolResult, McpError> {
        let store = ProjectStore::open_project_path(&args.project_path, true).map_err(mcp_error)?;
        let snapshot = store.read_snapshot().map_err(mcp_error)?;
        structured(snapshot.cards)
    }

    /// Create a card in the default board for a repository path.
    #[tool(description = "Create a card in the default board for a repository path")]
    fn create_card(
        &self,
        Parameters(args): Parameters<CreateCardArgs>,
    ) -> Result<CallToolResult, McpError> {
        let store = ProjectStore::open_project_path(&args.project_path, true).map_err(mcp_error)?;
        let card = store.create_card(args.into()).map_err(mcp_error)?;
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

impl From<CreateCardArgs> for CreateCardInput {
    fn from(args: CreateCardArgs) -> Self {
        Self {
            title: args.title,
            description: args.description,
            parent_id: args.parent_id,
            column: args.column,
            scope: args.scope.map(WorkScope::from),
        }
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

fn default_column() -> String {
    "todo".into()
}
