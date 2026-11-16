# Server & Port Configuration

**SimpleVG** is hosted via a lightweight VB.NET (ASP.NET Core) server and listens on port `5123` by default (`http://localhost:5123`). The server binds to `localhost` only.

You can customize the HTTP binding port using `appsettings.json`, command-line arguments, or environment variables.

---

## Configuration Options

### 1. Modifying `appsettings.json` (Recommended for default setups)

Located in the project root (or next to the published `SimpleVG` executable), `appsettings.json` allows you to permanently change the default listening port:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "Port": 8080
}
```

---

### 2. Command-Line Parameter (`--Port`)

When running from source:

```bash
dotnet run -- --Port=8080
```

When running a published build:

```cmd
SimpleVG.exe --Port=8080
```

---

### 3. Environment Variable (`Port`)

Set the `Port` environment variable prior to launching the application.

**Windows Command Prompt**:
```cmd
set Port=8080
dotnet run
```

**PowerShell**:
```powershell
$env:Port="8080"
dotnet run
```

**Linux / macOS**:
```bash
Port=8080 dotnet run
```

---

## Configuration Precedence Order

If the port is configured in multiple places simultaneously, SimpleVG evaluates settings in the following priority order:

1. **Command-Line Argument (`--Port`)** — *Highest Priority*
2. **Environment Variable (`Port`)**
3. **`appsettings.json` (`Port`)** — *Default Base Configuration*
