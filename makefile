WASM_FLAGS = --target=wasm32 -nostdlib -Wl,--no-entry -Wl,--export-all -Wl,--allow-undefined

.PHONY: all clean

all: chip8.wasm

chip8.wasm: chip8.c
	clang $(WASM_FLAGS) -o $@ $<

clean:
	rm -f *.wasm
