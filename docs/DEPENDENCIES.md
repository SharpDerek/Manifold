# Dependency review

Historical dependency review from 2026-10-27. Subsequently the user upgraded all Forge packages to 8.0.1 and committed the manifest/lockfile. The successful user-run audit log 2026-10-28T00_36_38_547Z-debug-0.log returned an empty advisory report. The remaining-issues section below describes the superseded Forge 7 tree, not the current installed dependencies.

## Original findings

The first installation succeeded with Node 24.22.1 and npm 11.21.1. Warnings include actual security advisories as well as deprecations; a successful installation does not establish a clean security audit.

| Finding                                               | Installed version                                                    | Action                                                                                                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Electron security advisory                            | 44.7.2                                                               | Update within Electron 44; the installation log reports affected versions below 44.9.1.                                                  |
| Vite development-server advisories                    | 7.1.12                                                               | Update within Vite 7; the log includes affected versions through 7.3.6.                                                                  |
| Zod collection validation memory exhaustion           | 4.1.12                                                               | Update within Zod 4; the log identifies versions below 4.6.6.                                                                            |
| Vitest and mocker file-read/code-injection advisories | 3.2.4                                                                | Move to Vitest 4; merely updating to 3.2.6 leaves mocker advisories affecting versions below 4.1.12.                                     |
| Tinypool worker-option advisories                     | 1.1.1                                                                | Check the version resolved by the Vitest update; the log identifies versions below 2.1.2.                                                |
| Unsupported ESLint                                    | 9.37.0                                                               | Update ESLint to 10 and typescript-eslint to a current compatible version together.                                                      |
| Deprecated build dependencies                         | glob 7/8, inflight, rimraf 3, boolean, lodash.get, @npmcli/move-file | Update their parent dependencies, starting with all Forge packages together. These are transitive dependencies, not application imports. |
| Archive/temp-file advisories                          | tar 6.2.1, extract-zip 2.0.1, tmp 0.0.33                             | Re-audit after parent updates. Do not override major versions blindly: callers may depend on older APIs.                                 |
| Unreviewed esbuild setup script                       | 0.25.12                                                              | Reviewed and approved this exact version with `npm install-scripts approve esbuild`. No blanket script approval.                         |

The test command uses `vitest run`, not its UI server. That limits exposure to server-specific advisories but does not justify retaining vulnerable dependencies. Electron is a development dependency in npm terms but supplies the shipped desktop runtime, so `npm audit --omit=dev` alone is insufficient.

## Remediation and verification

Registry connections fail with EACCES in the agent environment. Run these commands in the normal project terminal with registry access. They resolve compatible releases within the selected lines and save exact versions and a real lockfile:

```powershell
npm install --save-dev --save-exact @electron-forge/cli@7 @electron-forge/maker-zip@7 @electron-forge/plugin-vite@7 electron@44 vite@7 vitest@4 eslint@10 typescript-eslint@8
npm install --save-exact zod@4
npm audit
npm install-scripts ls
npm run check
npm run build
```

Review remaining audit paths after updates. An install-script warning for a new esbuild version requires reviewing that version before approving it. Do not use `npm audit fix --force` or suppress warnings to declare completion. The user ran both upgrade commands successfully. Installed versions: Forge 7.11.2, Electron 44.10.0, Vite 7.3.7, Vitest 4.1.12, ESLint 10.13.0, typescript-eslint 8.72.1, and Zod 4.6.7. Typecheck, lint, and four tests pass with these versions. esbuild 0.28.2 was subsequently reviewed and approved, replacing the obsolete approval. Production bundle compilation passes; final packaging fails downloading from GitHub with EACCES in the agent environment.

## Remaining issues after upgrades

The successful second install log (`2026-10-28T00_34_04_668Z-debug-0.log`) reports only `extract-zip`, `tar`, and `tmp` in its advisory response. A fresh agent-side audit cannot reach the registry, so no zero-vulnerability result is claimed.

- Forge 7.11.2 still requests `@electron/rebuild ^3.7.0`. Installed rebuild 3.7.2 brings tar 6 through rebuild, Electron node-gyp, and cacache. Moving rebuild to 4 would cross Forge's declared compatibility range and needs packaging/native rebuild verification.
- `@electron/packager` requests extract-zip 2. The [extract-zip advisory](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3) lists no patched release. This is used for build-time archive extraction, not for browsing selected project directories.
- `external-editor` requests tmp 0.0.33 through Forge's CLI prompt dependencies. Replacing its parent is preferable to forcing a different tmp API.
- Deprecated glob/inflight/rimraf/boolean/lodash.get/move-file paths remain in the current Forge tree. They require parent migrations or upstream fixes; warning suppression would not repair them.

These are unresolved build-tool risks, not a clean audit. Follow up with a compatible Forge/toolchain migration or reviewed narrowly scoped replacements and verify packaging before release. No major transitive override or warning suppression has been applied.

## References

- [Electron releases](https://releases.electronjs.org/release)
- [Vite support policy](https://vite.dev/releases)
- [Forge releases](https://github.com/electron/forge/releases)
- [Vitest security advisories](https://github.com/vitest-dev/vitest/security/advisories)
- [ESLint support policy](https://eslint.org/version-support/)
- [typescript-eslint compatibility](https://typescript-eslint.io/users/dependency-versions/)
- [npm install-script policy](https://docs.npmjs.com/cli/v11/commands/npm-install-scripts/)
