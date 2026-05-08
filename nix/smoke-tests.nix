# per runtime smoke tests against the built dist. exposed as packages
# (not flake checks) so they only build when requested, not on every
# `nix flake check`.
{ ... }:
{
  perSystem = { pkgs, config, runtimeMatrix, mkSuitePackages, ... }:
    let
      dist = config.packages.doba-dist;
      crossRuntimeTest = ./tests/cross-runtime.mjs;

      mkSmoke = name: runtime:
        pkgs.runCommand "doba-smoke-${name}" { } ''
          cp ${dist}/index.mjs ./index.mjs
          cp ${dist}/result.mjs ./result.mjs
          cp ${crossRuntimeTest} ./cross-runtime.mjs
          ${runtime.command} ./cross-runtime.mjs
          mkdir -p "$out"
          touch "$out/passed"
        '';
    in
    {
      packages = mkSuitePackages {
        prefix = "smoke";
        suites = builtins.mapAttrs mkSmoke runtimeMatrix;
      };
    };
}
