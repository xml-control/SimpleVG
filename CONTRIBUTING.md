# Contributing to SimpleVG

Thanks for your interest! SimpleVG is a small project, so the process is light.

## Getting set up

1. Install the [.NET 10 SDK](https://dotnet.microsoft.com/download).
2. Fork and clone the repo, then run `dotnet run` and open <http://localhost:5123>.
3. The front end lives in `wwwroot/` and is plain JavaScript with no build step. Refresh the browser to see changes.

## Reporting bugs

Open an issue with:
- What you did, what you expected, and what happened
- Browser and OS
- If possible, a small SVG that reproduces the problem

## Pull requests

- Keep changes focused: one fix or feature per PR.
- Match the existing code style.
- Make sure `dotnet build` succeeds and try your change in the browser, including undo/redo where relevant.
- If you add a feature, update the matching page in `wwwroot/help/`.
- Don't commit build output (`bin/`, `obj/`), editor settings or personal files.

By contributing, you agree that your contribution is licensed under the project's [MIT License](LICENSE).
