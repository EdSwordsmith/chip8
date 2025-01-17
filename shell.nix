{pkgs ? import <nixpkgs> {}}:
pkgs.mkShell {
  buildInputs = with pkgs; [
    llvmPackages_19.clang-unwrapped
    lld_19
    wabt
    gnumake
  ];
}
