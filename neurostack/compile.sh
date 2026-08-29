# Choose a compiler

wat2wasm assets/brain.wat -o assets/brain.wasm
## wasm-tools parse assets/brain.wat -o assets/brain.wasm

# Optimize the wasm file
wasm-opt -O3 --all-features --fast-math assets/brain.wasm -o assets/brain.wasm