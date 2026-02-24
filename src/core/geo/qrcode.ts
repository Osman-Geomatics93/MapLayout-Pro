/**
 * Pure JS QR Code encoder — byte mode, ECC level M, versions 1–10.
 * Returns a boolean[][] matrix (true = black module).
 */

// Version info: data capacity in bytes at ECC-M for versions 1-10
const VERSION_CAPACITY: number[] = [
  /*v1*/ 14, /*v2*/ 26, /*v3*/ 42, /*v4*/ 62, /*v5*/ 84,
  /*v6*/ 106, /*v7*/ 122, /*v8*/ 152, /*v9*/ 180, /*v10*/ 213,
];

// ECC codewords per block for ECC-M, versions 1-10
const ECC_CODEWORDS: number[] = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26];

// Number of error correction blocks for ECC-M, versions 1-10
const NUM_BLOCKS: number[][] = [
  [1], [1], [1], [2], [2], [4], [4], [4], [4], [6],
];

// Total codewords per version
const TOTAL_CODEWORDS: number[] = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346];

// Alignment pattern positions per version (v2-10)
const ALIGN_POSITIONS: number[][] = [
  [], [6, 18], [6, 22], [6, 26], [6, 30],
  [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 52],
];

// Format info bits for ECC-M, mask patterns 0-7
const FORMAT_BITS: number[] = [
  0x5412, 0x5125, 0x5E7C, 0x5B4B, 0x45F9, 0x40CE, 0x4F97, 0x4AA0,
];

/** Select minimum QR version that fits the data */
function selectVersion(dataLen: number): number {
  for (let v = 0; v < VERSION_CAPACITY.length; v++) {
    if (dataLen <= VERSION_CAPACITY[v]) return v + 1;
  }
  return 10; // clamp
}

/** Galois Field GF(256) arithmetic */
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

/** Reed-Solomon ECC generation */
function rsEncode(data: Uint8Array, numEcc: number): Uint8Array {
  // Build generator polynomial
  let gen = new Uint8Array([1]);
  for (let i = 0; i < numEcc; i++) {
    const newGen = new Uint8Array(gen.length + 1);
    for (let j = 0; j < gen.length; j++) {
      newGen[j] ^= gen[j];
      newGen[j + 1] ^= gfMul(gen[j], GF_EXP[i]);
    }
    gen = newGen;
  }

  const result = new Uint8Array(numEcc);
  const msg = new Uint8Array(data.length + numEcc);
  msg.set(data);

  for (let i = 0; i < data.length; i++) {
    const coef = msg[i] ^ 0;
    const feedback = msg[i];
    if (feedback !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], feedback);
      }
    }
  }
  result.set(msg.subarray(data.length));
  return result;
}

/** Encode text as byte-mode data codewords */
function encodeData(text: string, version: number): Uint8Array {
  const bytes = new TextEncoder().encode(text);
  const totalCodewords = TOTAL_CODEWORDS[version - 1];
  const eccPerBlock = ECC_CODEWORDS[version - 1];
  const blocks = NUM_BLOCKS[version - 1];
  const totalBlocks = blocks.reduce((s, n) => s + n, 0);
  const totalEcc = eccPerBlock * totalBlocks;
  const dataCodewords = totalCodewords - totalEcc;

  // Mode indicator (0100 = byte) + char count (8 or 16 bits)
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };

  pushBits(0b0100, 4); // Byte mode
  const ccLen = version <= 9 ? 8 : 16;
  pushBits(bytes.length, ccLen);
  for (const b of bytes) pushBits(b, 8);

  // Terminator
  const maxBits = dataCodewords * 8;
  const termLen = Math.min(4, maxBits - bits.length);
  for (let i = 0; i < termLen; i++) bits.push(0);

  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);

  // Pad codewords
  const padBytes = [0xEC, 0x11];
  let padIdx = 0;
  while (bits.length < maxBits) {
    pushBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  // Convert bits to bytes
  const data = new Uint8Array(dataCodewords);
  for (let i = 0; i < dataCodewords; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | (bits[i * 8 + b] || 0);
    data[i] = byte;
  }

  // Split into blocks and compute ECC
  const dataBlocks: Uint8Array[] = [];
  const eccBlocks: Uint8Array[] = [];
  let offset = 0;
  for (const numInGroup of blocks) {
    const blockSize = Math.floor(dataCodewords / totalBlocks);
    for (let b = 0; b < numInGroup; b++) {
      const extra = b >= numInGroup - (dataCodewords % totalBlocks) ? 1 : 0;
      const blockData = data.slice(offset, offset + blockSize + extra);
      offset += blockSize + extra;
      dataBlocks.push(blockData);
      eccBlocks.push(rsEncode(blockData, eccPerBlock));
    }
  }

  // Interleave data blocks
  const result: number[] = [];
  const maxDataLen = Math.max(...dataBlocks.map(b => b.length));
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) result.push(block[i]);
    }
  }
  // Interleave ECC blocks
  for (let i = 0; i < eccPerBlock; i++) {
    for (const block of eccBlocks) {
      if (i < block.length) result.push(block[i]);
    }
  }

  return new Uint8Array(result);
}

/** Create QR matrix and place data */
export function generateQRCode(text: string): boolean[][] {
  const version = selectVersion(new TextEncoder().encode(text).length);
  const size = 17 + version * 4;
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  // Place finder patterns
  const placeFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = row + r, cc = col + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const inOuter = r === 0 || r === 6 || c === 0 || c === 6;
        const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        matrix[rr][cc] = (inOuter || inInner) && r >= 0 && r <= 6 && c >= 0 && c <= 6;
        reserved[rr][cc] = true;
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
    reserved[6][i] = true;
    reserved[i][6] = true;
  }

  // Alignment patterns (v2+)
  if (version >= 2) {
    const positions = ALIGN_POSITIONS[version - 1];
    for (const r of positions) {
      for (const c of positions) {
        if (reserved[r]?.[c]) continue; // skip if overlapping finder
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const rr = r + dr, cc = c + dc;
            if (rr >= 0 && rr < size && cc >= 0 && cc < size) {
              matrix[rr][cc] = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
              reserved[rr][cc] = true;
            }
          }
        }
      }
    }
  }

  // Reserve format info areas
  for (let i = 0; i < 8; i++) {
    reserved[8][i] = true;
    reserved[8][size - 1 - i] = true;
    reserved[i][8] = true;
    reserved[size - 1 - i][8] = true;
  }
  reserved[8][8] = true;
  // Dark module
  matrix[size - 8][8] = true;
  reserved[size - 8][8] = true;

  // Place data
  const codewords = encodeData(text, version);
  const dataBits: number[] = [];
  for (const byte of codewords) {
    for (let b = 7; b >= 0; b--) dataBits.push((byte >> b) & 1);
  }

  let bitIdx = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // skip timing column
    const rows = upward ? Array.from({ length: size }, (_, i) => size - 1 - i) : Array.from({ length: size }, (_, i) => i);
    for (const row of rows) {
      for (const col of [right, right - 1]) {
        if (col < 0 || col >= size) continue;
        if (!reserved[row][col]) {
          matrix[row][col] = bitIdx < dataBits.length ? dataBits[bitIdx] === 1 : false;
          bitIdx++;
        }
      }
    }
    upward = !upward;
  }

  // Apply best mask (simplified: try mask 0)
  const maskFn = (r: number, c: number) => (r + c) % 2 === 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c]) {
        matrix[r][c] = (matrix[r][c] as boolean) !== maskFn(r, c);
      }
    }
  }

  // Place format info (mask 0, ECC-M)
  const formatBits = FORMAT_BITS[0];
  const formatPositions = [
    // Around top-left finder
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  for (let i = 0; i < 15; i++) {
    const bit = ((formatBits >> (14 - i)) & 1) === 1;
    const [r, c] = formatPositions[i];
    matrix[r][c] = bit;
  }
  // Second copy
  const formatPositions2 = [
    [size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8],
    [size - 5, 8], [size - 6, 8], [size - 7, 8],
    [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5],
    [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1],
  ];
  for (let i = 0; i < 15; i++) {
    const bit = ((formatBits >> (14 - i)) & 1) === 1;
    const [r, c] = formatPositions2[i];
    matrix[r][c] = bit;
  }

  // Convert null to false
  return matrix.map(row => row.map(cell => cell === true));
}
