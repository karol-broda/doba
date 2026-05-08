# custom overlay providing pinned bun runtime versions.
# fetches the official prebuilt binaries so the version matrix is fully
# controlled and hermetic, instead of tracking whatever nixpkgs ships.
final: prev:
let
  inherit (final) lib stdenv fetchurl;

  systemToAsset = {
    "aarch64-darwin" = "darwin-aarch64";
    "x86_64-darwin" = "darwin-x64";
    "x86_64-linux" = "linux-x64";
    "aarch64-linux" = "linux-aarch64";
  };

  asset =
    systemToAsset.${stdenv.hostPlatform.system}
      or (throw "bun overlay: unsupported system ${stdenv.hostPlatform.system}");

  # sha256 (sri) of bun-<asset>.zip per version, prefetched from the
  # official github releases.
  hashes = {
    "1.2.21" = {
      "darwin-aarch64" = "sha256-/YhmMLoVxIQjatXz8islXSh8Pu+NO8JvyAmFEDXATOw=";
      "darwin-x64" = "sha256-2EYC9Vv3LEXVcz5ZxRHIhZhQn7RCE+8HE6lqAg0rX4U=";
      "linux-x64" = "sha256-WU9FTVHOVxmdQyDIXL1JW+nAVO8XquvKXmyQir/aYXk=";
      "linux-aarch64" = "sha256-DkyeVIdqFg6RgSrjxi02z71o8g4VjLcy9joNa3WUKHs=";
    };
    "1.3.5" = {
      "darwin-aarch64" = "sha256-2xdYikrqiASFaCXUvq0/BeHzcnbKYG8342m09y810/s=";
      "darwin-x64" = "sha256-9f/AMDD+UnqGKV+1hSuwjF6ZtwdWABHR1QmrAokCvyk=";
      "linux-x64" = "sha256-cFHYapJK7+o+C5YhO1/Y95wHk/nK5lNCM+Yn5cPbRmk=";
      "linux-aarch64" = "sha256-7QEAD4W9l3hSKK0oRdySoYYLgFSFaCbXMXaQrI+O50s=";
    };
  };

  mkBun = version:
    stdenv.mkDerivation {
      pname = "bun";
      inherit version;

      src = fetchurl {
        url = "https://github.com/oven-sh/bun/releases/download/bun-v${version}/bun-${asset}.zip";
        hash = hashes.${version}.${asset};
      };

      nativeBuildInputs =
        [ final.unzip ] ++ lib.optionals stdenv.isLinux [ final.autoPatchelfHook ];
      buildInputs = lib.optionals stdenv.isLinux [ stdenv.cc.cc.lib ];

      dontConfigure = true;
      dontBuild = true;

      installPhase = ''
        runHook preInstall
        install -Dm755 bun "$out/bin/bun"
        ln -s "$out/bin/bun" "$out/bin/bunx"
        runHook postInstall
      '';

      meta = {
        description = "Incredibly fast JavaScript runtime, bundler, transpiler and package manager (pinned ${version})";
        homepage = "https://bun.sh";
        license = lib.licenses.mit;
        mainProgram = "bun";
        platforms = lib.attrNames systemToAsset;
      };
    };
  bun_1_2 = mkBun "1.2.21";
  bun_1_3 = mkBun "1.3.5";
in
{
  inherit bun_1_2 bun_1_3;

  # default bun used by the devshell points at the latest pinned version.
  bun = bun_1_3;
}
