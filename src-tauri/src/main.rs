use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "trackboi")]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Subcommand)]
enum Command {
    /// Run the Trackboi MCP server over stdio.
    Mcp,
}

fn main() {
    let cli = Cli::parse();

    if matches!(cli.command, Some(Command::Mcp)) {
        let runtime = tokio::runtime::Runtime::new().expect("failed to start tokio runtime");
        if let Err(error) = runtime.block_on(app_lib::mcp::run_stdio()) {
            eprintln!("{error}");
            std::process::exit(1);
        }
        return;
    }

    app_lib::run();
}
