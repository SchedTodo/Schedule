export interface ExternalShell {
  openExternal(url: string): Promise<void>
}

export class ElectronExternalLink {
  constructor(private readonly shell: ExternalShell) {}

  async open(value: string): Promise<void> {
    const url = new URL(value)
    if (url.protocol !== 'https:') {
      throw new Error('不允许的外部链接协议')
    }
    await this.shell.openExternal(url.toString())
  }
}

