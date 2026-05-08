# hermetic build of the dobajs distributable. the library core has zero
# runtime third party imports (everything external is type only), so the
# esm bundle can be produced with nixpkgs esbuild without any node_modules.
{ ... }:
{
  perSystem = { pkgs, ... }: {
    packages.doba-dist = pkgs.stdenv.mkDerivation {
      pname = "doba-dist";
      version = "0.1.0";
      src = ../packages/doba;

      nativeBuildInputs = [ pkgs.esbuild ];

      dontConfigure = true;

      buildPhase = ''
        runHook preBuild
        mkdir -p "$out"
        esbuild src/index.ts \
          --bundle --format=esm --platform=neutral \
          --outfile="$out/index.mjs"
        esbuild src/result-entry.ts \
          --bundle --format=esm --platform=neutral \
          --outfile="$out/result.mjs"
        runHook postBuild
      '';

      dontInstall = true;
    };
  };
}
