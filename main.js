"use strict";

class Keymap {
  constructor() {
    this.key_by_id = {};
    this.id_by_key = {};
  }

  add(id, keycode) {
    this.key_by_id[id] = keycode;
    this.id_by_key[keycode] = id;
  }

  id(keycode) {
    return this.id_by_key[keycode];
  }

  keycode(id) {
    return this.key_by_id[id];
  }
}

const canvas = document.querySelector("#canvas");
canvas.width = 64;
canvas.height = 32;
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const back_canvas = new OffscreenCanvas(canvas.width, canvas.height);
const back_ctx = back_canvas.getContext("2d");
back_ctx.imageSmoothingEnabled = false;

const [is_key_down, get_key] = (() => {
  const keymap = new Keymap();
  keymap.add(0, "KeyX");
  keymap.add(1, "Digit1");
  keymap.add(2, "Digit2");
  keymap.add(3, "Digit3");
  keymap.add(4, "KeyQ");
  keymap.add(5, "KeyW");
  keymap.add(6, "KeyE");
  keymap.add(7, "KeyA");
  keymap.add(8, "KeyS");
  keymap.add(9, "KeyD");
  keymap.add(10, "KeyZ");
  keymap.add(11, "KeyC");
  keymap.add(12, "Digit4");
  keymap.add(13, "KeyR");
  keymap.add(14, "KeyF");
  keymap.add(15, "KeyV");

  let state = {};
  let key = undefined;

  addEventListener("keyup", (e) => {
    if (keymap.id(e.code) !== undefined) {
      state[e.code] = false;
      key = undefined;
    }
  });

  addEventListener("keydown", (e) => {
    const id = keymap.id(e.code);
    if (id !== undefined) {
      state[e.code] = true;
      key = id;
    }
  });

  return [
    (id) =>
      (state.hasOwnProperty(keymap.keycode(id)) && state[keymap.keycode(id)]) ||
      false,
    () => {
      const id = key;
      key = undefined;
      return id === undefined ? 0x10 : id;
    },
  ];
})();

const [enable_sound, disable_sound] = (() => {
  const audio_ctx = new AudioContext();
  const master_gain = new GainNode(audio_ctx);
  master_gain.gain.value = 0.1;
  master_gain.connect(audio_ctx.destination);

  let oscillator = undefined;

  function enable_sound() {
    oscillator = audio_ctx.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(440, audio_ctx.currentTime);
    oscillator.connect(master_gain);
    oscillator.start();
  }

  function disable_sound() {
    if (oscillator) oscillator.stop();
  }

  return [enable_sound, disable_sound];
})();

function clear_screen() {
  back_ctx.fillStyle = "#001F3D";
  back_ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function random() {
  return Math.floor(255 * Math.random());
}

function flip_pixel(x, y) {
  const on = back_ctx.getImageData(x, y, 1, 1).data[0] == 255;
  back_ctx.fillStyle = on ? "#001F3D" : "#ffffff";
  back_ctx.fillRect(x, y, 1, 1);
  return on;
}

function debug_hex(value, digits) {
  const hex = value.toString(16).padStart(digits, "0");
  console.log(hex.toUpperCase());
}

const { instance } = await WebAssembly.instantiateStreaming(
  fetch("./chip8.wasm"),
  {
    env: {
      debug_byte: (number) => debug_hex(number, 2),
      debug: (number) => debug_hex(number, 4),
      clear_screen,
      random,
      flip_pixel,
      is_key_down,
      get_key,
      enable_sound,
      disable_sound,
    },
  },
);

const memory_buffer = instance.exports.memory.buffer;
const rom_ptr = instance.exports.ram.value + 0x200;
const font_sprites_ptr = instance.exports.ram.value + 0x050;

// prettier-ignore
const font = new Uint8Array([
    0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
    0x20, 0x60, 0x20, 0x20, 0x70, // 1
    0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
    0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
    0x90, 0x90, 0xF0, 0x10, 0x10, // 4
    0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
    0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
    0xF0, 0x10, 0x20, 0x40, 0x40, // 7
    0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
    0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
    0xF0, 0x90, 0xF0, 0x90, 0x90, // A
    0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
    0xF0, 0x80, 0x80, 0x80, 0xF0, // C
    0xE0, 0x90, 0x90, 0x90, 0xE0, // D
    0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
    0xF0, 0x80, 0xF0, 0x80, 0x80  // F
]);

async function load_rom(url) {
  const req = await fetch(url);
  const buffer = await req.arrayBuffer();
  const data = new Uint8Array(buffer);
  const rom = new Uint8Array(memory_buffer, rom_ptr, data.length);
  rom.set(data);
}

function load_font(font) {
  const font_sprites = new Uint8Array(
    memory_buffer,
    font_sprites_ptr,
    font.length,
  );
  font_sprites.set(font);
}

clear_screen();
load_font(font);
await load_rom("./default.ch8");

const start_emulator = (() => {
  let previous_timestamp;
  function step(timestamp) {
    if (previous_timestamp === undefined) previous_timestamp = timestamp;
    const elapsed = timestamp - previous_timestamp;
    if (elapsed >= 16) {
      previous_timestamp = timestamp;
      instance.exports.update_timers();
      for (let i = 0; i < elapsed; i++) if (instance.exports.cpu_cycle()) break;
      ctx.drawImage(back_canvas, 0, 0);
    }

    requestAnimationFrame(step);
  }

  return () => requestAnimationFrame(step);
})();

start_emulator();
