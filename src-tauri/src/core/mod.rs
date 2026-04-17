pub mod commands;
pub(crate) mod model;
pub(crate) mod rank;
pub(crate) mod service;
pub(crate) mod storage;
pub(crate) mod watcher;

pub(crate) type Result<T> = std::result::Result<T, String>;

pub(crate) const DEFAULT_BOARD_ID: &str = "default";
pub(crate) const PROJECT_METADATA_FILE: &str = "project.json";
pub(crate) const DEFAULT_STORAGE_SEARCH_PATHS: [&str; 3] =
    [".trackboi", ".etc/.trackboi", ".etc/trackboi"];
