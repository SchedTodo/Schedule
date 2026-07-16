import { Notification } from 'electron'

import type { DueAlarm } from '../../src/application/alarm-scheduler'
import type { NotificationInput } from '../../src/contracts/notification.contract'

export class ElectronNotifier {
  notifyMessage(input: NotificationInput): void {
    new Notification(input).show()
  }

  notify(alarm: DueAlarm): void {
    new Notification({
      title: `${alarm.occurrence.kind}: ${alarm.occurrence.title}`,
      body: `${alarm.occurrence.comment}\n${alarm.occurrence.start ?? alarm.occurrence.end} - ${alarm.occurrence.end}`
    }).show()
  }
}
