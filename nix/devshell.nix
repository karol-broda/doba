# development shell exposing bun as the primary runtime, plus node and
# deno so the multi-runtime tests can be exercised by hand.
{ ... }:
{
  perSystem = { pkgs, pkgsUnstable, ... }: {
    devShells.default = pkgs.mkShell {
      packages = [
        pkgs.bun
        pkgs.nodejs_22
        pkgsUnstable.deno
        pkgs.git
      ];

      shellHook = ''
        echo "doba devshell"
        echo "  bun  $(bun --version)"
        echo "  node $(node --version)"
        echo "  deno $(deno --version | head -n1)"
        echo "run 'bun install' to set up node_modules, then 'bun run test'"
      '';
    };
  };
}
