import { Notification } from 'electron'

import type { NotificationInput } from '../../src/contracts/notification.contract'

export class ElectronNotifier {
  notifyMessage(input: NotificationInput): void {
    new Notification(input).show()
  }
}
