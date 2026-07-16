# Electron E2E Troubleshooting Documentation Design

## Goal

Record the verified Electron E2E sandbox lesson where future agents will see it before running or debugging GUI tests, without presenting an intermediate hypothesis as the root cause.

## Verified Incident Conclusion

When Electron Playwright tests ran inside the filesystem/process sandbox, the Electron GPU child process exited with Windows code `0xC0000135`, the main window remained at an empty URL, and loading `dist-web/index.html` failed with `ERR_FAILED`. Chromium flags and a conditional `app.disableHardwareAcceleration()` experiment did not resolve the sandboxed run.

The same final build passed all three Electron startup tests when the GUI command was run outside the sandbox. Therefore the incident proves an execution-permission problem first, not a missing runtime DLL. `0xC0000135` can resemble a missing dependency, but that diagnosis must not be asserted until the failure reproduces outside the sandbox.

## Documentation Changes

### Agent rule

Add a concise Electron E2E rule under `AGENTS.md` Verification:

- Electron and Playwright Electron commands launch GUI processes and must run outside the sandbox with the required approval.
- For GPU child-process exits, `ERR_FAILED` loading a local page, a blank BrowserWindow URL, or `0xC0000135`, verify sandbox placement before changing code, dependencies, hardware acceleration, or Chromium switches.
- Link to the detailed troubleshooting guide.

### Troubleshooting guide

Create `docs/development/electron-e2e-troubleshooting.md` with:

1. the symptom cluster;
2. a first-response checklist;
3. the exact diagnostic observations that distinguish application failure from environment failure;
4. the approved escalation order;
5. approaches that must not be tried before an unsandboxed reproduction;
6. the verified Schedule command and expected successful result.

The escalation order is: confirm Web/main/preload builds, capture Electron stderr and BrowserWindow state, rerun the unchanged GUI test outside the sandbox, and only if that run still fails investigate Electron distribution files, system runtimes, native rebuilds, or product code.

## Non-goals

- Do not add runtime flags, environment variables, retries, or hardware-acceleration changes to production code.
- Do not claim that every `0xC0000135` failure is sandbox-related.
- Do not move internal agent troubleshooting into README user documentation.
- Do not change GAP-02 behavior or tests as part of this documentation task.

## Verification

- Search the new documents for contradictory claims that `0xC0000135` definitively means missing DLLs.
- Confirm `AGENTS.md` links to the existing troubleshooting file.
- Run `git diff --check` and verify only the approved documentation files changed.
