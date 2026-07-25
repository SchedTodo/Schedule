export interface ExternalShell {
  openExternal(url: string): Promise<void>
}

export class ElectronExternalLink {
  constructor(private readonly shell: ExternalShell) {}

  /** 仅允许通过系统浏览器打开 HTTPS 链接，拒绝其他协议。 */
  async open(value: string): Promise<void> {
    const url = new URL(value)
    if (url.protocol !== 'https:') {
      throw new Error('不允许的外部链接协议')
    }
    await this.shell.openExternal(url.toString())
  }
}
