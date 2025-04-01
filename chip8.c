void debug(unsigned short);
void debug_byte(unsigned char);
void clear_screen(void);
unsigned char random(void);
int flip_pixel(unsigned char, unsigned char);
int is_key_down(unsigned char);
unsigned char get_key(void);
void enable_sound(void);
void disable_sound(void);

unsigned char ram[4 * 1024];
static unsigned short pc = 0x200;
static unsigned short i = 0;
static unsigned short stack[16];
static unsigned short sp = 0;
static unsigned char delay_timer = 0;
static unsigned char sound_timer = 0;
static unsigned char v[16];

void update_timers() {
  if (delay_timer > 0) {
    delay_timer--;
  }

  if (sound_timer > 0) {
    sound_timer--;
  } else {
    disable_sound();
  }
}

#define DEBUG()                                                                \
  do {                                                                         \
    debug(inst);                                                               \
    debug_byte(x);                                                             \
    debug_byte(y);                                                             \
    debug_byte(n);                                                             \
    debug_byte(nn);                                                            \
    debug(nnn);                                                                \
  } while (0)

int cpu_cycle() {
  unsigned short inst = (ram[pc] << 8) | ram[pc + 1];
  pc += 2;
  unsigned char kind = (inst & 0xF000) >> 12;
  unsigned char x = (inst & 0x0F00) >> 8;
  unsigned char y = (inst & 0x00F0) >> 4;
  unsigned char n = inst & 0x000F;
  unsigned char nn = inst & 0x00FF;
  unsigned short nnn = inst & 0x0FFF;

  switch (kind) {
  case 0x0:
    if (inst == 0x00E0)
      clear_screen();
    else if (inst == 0x00EE)
      pc = stack[--sp];
    break;
  case 0x1:
    pc = nnn;
    break;
  case 0x2:
    stack[sp++] = pc;
    pc = nnn;
    break;
  case 0x3:
    if (v[x] == nn)
      pc += 2;
    break;
  case 0x4:
    if (v[x] != nn)
      pc += 2;
    break;
  case 0x5:
    if (v[x] == v[y])
      pc += 2;
    break;
  case 0x9:
    if (v[x] != v[y])
      pc += 2;
    break;
  case 0x6:
    v[x] = nn;
    break;
  case 0x7:
    v[x] += nn;
    break;
  case 0x8:
    switch (n) {
    case 0x0:
      v[x] = v[y];
      break;
    case 0x1:
      v[x] |= v[y];
      v[0xF] = 0;
      break;
    case 0x2:
      v[x] &= v[y];
      v[0xF] = 0;
      break;
    case 0x3:
      v[x] ^= v[y];
      v[0xF] = 0;
      break;
    case 0x4:
      n = v[x];
      v[x] += v[y];
      if (v[x] < n)
        v[0xF] = 1;
      else
        v[0xF] = 0;
      break;
    case 0x5:
      n = v[x];
      v[x] -= v[y];
      if (v[x] > n)
        v[0xF] = 0;
      else
        v[0xF] = 1;
      break;
    case 0x7:
      v[x] = v[y] - v[x];
      if (v[x] > v[y])
        v[0xF] = 0;
      else
        v[0xF] = 1;
      break;
    case 0x6:
      n = v[y] & 0x01;
      v[x] = v[y] >> 1;
      if (n)
        v[0xF] = 1;
      else
        v[0xF] = 0;
      break;
    case 0xE:
      n = v[y] & 0x80;
      v[x] = v[y] << 1;
      if (n)
        v[0xF] = 1;
      else
        v[0xF] = 0;
      break;
    }
    break;
  case 0xA:
    i = nnn;
    break;
  case 0xB:
    pc = nnn + v[0];
    break;
  case 0xC:
    v[x] = random() & nn;
    break;
  case 0xD:
    x = v[x] % 64;
    y = v[y] % 32;
    v[0xF] = 0;
    for (unsigned short row = 0; row < n && y + row < 32; row++) {
      unsigned char sprite = ram[i + row];
      for (unsigned char bit = 0; bit < 8 && x + bit < 64; bit++) {
        unsigned char mask = 1 << (7 - bit);
        unsigned char should_flip = mask & sprite;
        if (should_flip && flip_pixel(x + bit, y + row))
          v[0xF] = 1;
      }
    }
    return 1;
    break;
  case 0xE:
    if (nn == 0x9E && is_key_down(v[x]))
      pc += 2;
    else if (nn == 0xA1 && !is_key_down(v[x]))
      pc += 2;
    break;
  case 0xF:
    switch (nn) {
    case 0x07:
      v[x] = delay_timer;
      break;
    case 0x15:
      delay_timer = v[x];
      break;
    case 0x18:
      nn = sound_timer;
      sound_timer = v[x];
      if (sound_timer > 0 && nn == 0)
        enable_sound();
      break;
    case 0x1E:
      i += v[x];
      break;
    case 0x0A:
      nn = get_key();
      if (nn != 0x10)
        v[x] = get_key();
      else
        pc -= 2;
      break;
    case 0x29:
      i = 0x050 + (v[x] & 0x0F) * 5;
      break;
    case 0x33:
      y = v[x];
      for (char offset = 2; offset >= 0; offset--) {
        ram[i + offset] = y % 10;
        y /= 10;
      }
      break;
    case 0x55:
      for (unsigned char r = 0; r <= x; r++)
        ram[i++] = v[r];
      break;
    case 0x65:
      for (unsigned char r = 0; r <= x; r++)
        v[r] = ram[i++];
      break;
    }
    break;
  default:
    DEBUG();
    break;
  }

  return 0;
}
