use std::io::{self, BufRead, Write};

pub fn run_stdio() -> Result<(), String> {
    let stdin = io::stdin();
    let mut stdout = io::stdout();

    writeln!(
    stdout,
    "{{\"jsonrpc\":\"2.0\",\"method\":\"trackboi/ready\",\"params\":{{\"status\":\"placeholder\"}}}}"
  )
  .map_err(|error| error.to_string())?;
    stdout.flush().map_err(|error| error.to_string())?;

    for line in stdin.lock().lines() {
        let line = line.map_err(|error| error.to_string())?;
        if line.trim().is_empty() {
            continue;
        }

        writeln!(
      stdout,
      "{{\"jsonrpc\":\"2.0\",\"error\":{{\"code\":-32601,\"message\":\"MCP server is not implemented yet\"}}}}"
    )
    .map_err(|error| error.to_string())?;
        stdout.flush().map_err(|error| error.to_string())?;
    }

    Ok(())
}
