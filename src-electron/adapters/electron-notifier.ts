import { Notification } from 'electron'

import type { NotificationInput } from '../../src/contracts/notification.contract'

/** 将平台无关的通知 DTO 适配为 Electron 原生系统通知。 */
export class ElectronNotifier {
  /** 创建并立即展示一条系统通知。 */
  notifyMessage(input: NotificationInput): void {
    new Notification(input).show()
  }
}
