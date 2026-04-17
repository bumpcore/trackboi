fn main() {
    if std::env::args().nth(1).as_deref() == Some("mcp") {
        if let Err(error) = app_lib::mcp::run_stdio() {
            eprintln!("{error}");
            std::process::exit(1);
        }
        return;
    }

    app_lib::run();
}
