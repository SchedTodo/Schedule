import { Notification } from 'electron'

import type { DueAlarm } from '../../src/application/alarm-scheduler'

export class ElectronNotifier {
  notify(alarm: DueAlarm): void {
    new Notification({
      title: `${alarm.occurrence.kind}: ${alarm.occurrence.title}`,
      body: `${alarm.occurrence.comment}\n${alarm.occurrence.start ?? alarm.occurrence.end} - ${alarm.occurrence.end}`
    }).show()
  }
}
