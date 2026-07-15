import { randomInt } from "crypto";

// 혼동되기 쉬운 문자(0/O, 1/I/L) 제외
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * 초대코드 생성. 개인용은 GRAPE-XXXXXX, 학원 공용은 CLASS-XXXXXX.
 * 6자(31^6 ≈ 8.8억)로 무차별 대입 비용을 높였다.
 */
export function randomCode(prefix: "GRAPE" | "CLASS", length = 6): string {
  let suffix = "";
  for (let i = 0; i < length; i++) {
    suffix += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return `${prefix}-${suffix}`;
}
