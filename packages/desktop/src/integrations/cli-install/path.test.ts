import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import path from "node:path";
import { resolveCliInstallSourcePath, resolveCliShimPath } from "./path";

describe("cli-install-path", () => {
  it("uses the bundled shim for packaged macOS installs", () => {
    expect(
      resolveCliInstallSourcePath({
        platform: "darwin",
        isPackaged: true,
        executablePath: "/Applications/Whis.app/Contents/MacOS/Whis",
        shimPath: "/Applications/Whis.app/Contents/Resources/bin/whis",
      }),
    ).toBe("/Applications/Whis.app/Contents/Resources/bin/whis");
  });

  it("prefers the original AppImage path on linux", () => {
    expect(
      resolveCliInstallSourcePath({
        platform: "linux",
        isPackaged: true,
        executablePath: "/tmp/.mount_whis123/whis",
        shimPath: "/tmp/.mount_whis123/resources/bin/whis",
        appImagePath: "/home/user/Applications/Whis.AppImage",
      }),
    ).toBe("/home/user/Applications/Whis.AppImage");
  });

  it("uses the bundled shim for packaged linux installs outside an AppImage", () => {
    expect(
      resolveCliInstallSourcePath({
        platform: "linux",
        isPackaged: true,
        executablePath: "/opt/Whis/Whis",
        shimPath: "/opt/Whis/resources/bin/whis",
      }),
    ).toBe("/opt/Whis/resources/bin/whis");
  });

  it("falls back to the shim on windows and in development", () => {
    expect(
      resolveCliInstallSourcePath({
        platform: "win32",
        isPackaged: true,
        executablePath: "C:\\Users\\user\\AppData\\Local\\Programs\\Whis\\Whis.exe",
        shimPath: "C:\\Users\\user\\AppData\\Local\\Programs\\Whis\\resources\\bin\\whis.cmd",
      }),
    ).toBe("C:\\Users\\user\\AppData\\Local\\Programs\\Whis\\resources\\bin\\whis.cmd");

    expect(
      resolveCliInstallSourcePath({
        platform: "linux",
        isPackaged: false,
        executablePath: "/opt/Whis/whis",
        shimPath: "/opt/Whis/resources/bin/whis",
      }),
    ).toBe("/opt/Whis/resources/bin/whis");
  });
});

describe("CLI executable selection", () => {
  const resolveWorkspaceCli = () => createRequire(import.meta.url).resolve("@whis/cli/bin/whis");

  it("uses the workspace CLI for an unpackaged Electron launcher", () => {
    expect(
      resolveCliShimPath({
        platform: "linux",
        isPackaged: false,
        executablePath: "/nix/store/electron/bin/electron",
        resolveWorkspaceCli,
      }),
    ).toBe(resolveWorkspaceCli());
  });

  it("uses the application shim for a packaged launcher", () => {
    expect(
      resolveCliShimPath({
        platform: "linux",
        isPackaged: true,
        executablePath: "/opt/Whis/whis",
        resolveWorkspaceCli,
      }),
    ).toBe(path.join("/opt/Whis", "resources", "bin", "whis"));
    expect(
      resolveCliShimPath({
        platform: "darwin",
        isPackaged: true,
        executablePath: "/Applications/Whis.app/Contents/MacOS/Whis",
        resolveWorkspaceCli,
      }),
    ).toBe(path.join("/Applications/Whis.app", "Contents", "Resources", "bin", "whis"));
  });
});
