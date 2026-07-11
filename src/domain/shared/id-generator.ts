export interface IdGenerator {
  next(): string
}

export class CryptoIdGenerator implements IdGenerator {
  next(): string {
    return globalThis.crypto.randomUUID()
  }
}
