const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_INDEX = new Map<string, number>(
  [...BASE58_ALPHABET].map((char, index) => [char, index])
);

export function decodeBase58(input: string): Uint8Array {
  if (!input) {
    return new Uint8Array();
  }

  const bytes: number[] = [0];

  for (const char of input) {
    const value = BASE58_INDEX.get(char);
    if (value === undefined) {
      throw new Error("Invalid base58 character");
    }

    let carry = value;
    for (let i = 0; i < bytes.length; i++) {
      const total = bytes[i] * 58 + carry;
      bytes[i] = total & 0xff;
      carry = total >> 8;
    }

    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  let leadingZeroes = 0;
  while (leadingZeroes < input.length && input[leadingZeroes] === "1") {
    leadingZeroes++;
  }

  const output = new Uint8Array(leadingZeroes + bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    output[output.length - 1 - i] = bytes[i];
  }
  return output;
}

export function encodeBase58(input: Uint8Array): string {
  if (input.length === 0) {
    return "";
  }

  const digits: number[] = [0];

  for (const byte of input) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      const total = digits[i] * 256 + carry;
      digits[i] = total % 58;
      carry = Math.floor(total / 58);
    }

    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  let leadingZeroes = 0;
  while (leadingZeroes < input.length && input[leadingZeroes] === 0) {
    leadingZeroes++;
  }

  let output = "1".repeat(leadingZeroes);
  for (let i = digits.length - 1; i >= 0; i--) {
    output += BASE58_ALPHABET[digits[i]];
  }

  return output;
}
