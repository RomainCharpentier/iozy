# iOS (SwiftUI + SwiftData)

**Out of service since 2026-08-29.** The API needs a session and this client never opens one, so all its calls get 401. Do not "fix" it while doing other work. There are three possible outcomes (catch it up, freeze it, remove it). They are weighed in `../docs/AUDIT_TECHNIQUE.md` (finding C4). The choice is a product decision and it has not been made. Ask before you invest in it.

What it would take to bring it back: the four `/auth/*` routes, the `XSRF-TOKEN` cookie sent back as `X-XSRF-TOKEN` on writes (the helpers `post`/`patch`/`postEmpty`/`delete` in `APIClient.swift`), a login screen and a gate in `IozyCoreApp.swift`. Details are in `README.md`.

## If you must touch it

- You need a Mac with Xcode 15+ and XcodeGen: `xcodegen generate`, then open `IozyCore.xcodeproj` (ignored by git, generated from `project.yml`). On this Windows machine you cannot build or test this folder.
- Organised by feature: `DesignSystem/`, `Models/`, `Networking/` (`APIClient` + one extension per domain), `Features/` (one folder per screen).
- An API call goes in `APIClient+<Domain>.swift`, never in a view. DTOs are Codable `struct`s that mirror the Java DTOs 1:1.
- No hard-coded colours or fonts: use `Theme.xxx` and the components in `DesignSystem/`.
- A trap met twice: `private`/`fileprivate` are invisible from another file, so anything shared (DTOs, network helpers) must be `internal`. Never make a Foundation type (`UUID`, …) conform to a protocol it already implements.
- To rename the app: only `Config.xcconfig` (`APP_NAME`, `APP_BUNDLE_ID`), then `xcodegen generate`.
