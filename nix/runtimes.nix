# single source of truth for the package sets and the runtime matrix.
#
{ inputs, ... }:
{
  perSystem = { system, lib, ... }:
    let
      pkgs = import inputs.nixpkgs {
        inherit system;
        overlays = [
          inputs.bun2nix.overlays.default
          # applied last so the pinned bun (used by the bun2nix hook too)
          # wins over the one nixpkgs ships
          inputs.self.overlays.default
        ];
      };

      pkgsUnstable = import inputs.nixpkgs-unstable { inherit system; };

      runtimeMatrix = {
        "bun-1.2" = {
          command = "${pkgs.bun_1_2}/bin/bun";
          # vitest 2.x collects zero tests under bun 1.2, so it only takes
          # part in the dist smoke tests
          supportsVitest = false;
        };
        "bun-1.3" = {
          command = "${pkgs.bun_1_3}/bin/bun";
          supportsVitest = true;
        };
        "node-22" = {
          command = "${pkgs.nodejs_22}/bin/node";
          supportsVitest = true;
        };
        "node-24" = {
          command = "${pkgs.nodejs_24}/bin/node";
          supportsVitest = true;
        };
        "deno" = {
          # deno moves fast, so it is taken from unstable. vitest is node
          # oriented, so deno only runs the dist smoke tests
          command = "${pkgsUnstable.deno}/bin/deno run --allow-read --allow-env";
          supportsVitest = false;
        };
      };

      mkSuitePackages = { prefix, suites }:
        (lib.mapAttrs'
          (name: drv: lib.nameValuePair "${prefix}-${name}" drv)
          suites)
        // {
          # the aggregate exists so a single build forces every suite to run
          "${prefix}-all" = pkgs.symlinkJoin {
            name = "doba-${prefix}-all";
            paths = lib.attrValues suites;
          };
        };
    in
    {
      _module.args = {
        inherit pkgs pkgsUnstable runtimeMatrix mkSuitePackages;
      };
    };
}
