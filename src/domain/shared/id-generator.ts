export interface IdGenerator {
  next(): string
}

/** 使用 Web Crypto 生成随机 UUID，保持实现可在浏览器和 Electron 中复用。 */
export class CryptoIdGenerator implements IdGenerator {
  next(): string {
    return globalThis.crypto.randomUUID()
  }
}
