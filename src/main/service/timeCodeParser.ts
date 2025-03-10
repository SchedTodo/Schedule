import { DateTime } from 'luxon'
import { datetime, RRule, Weekday } from 'rrule'
import { getTimeZoneAbbrMap, isValidTimeZone } from '../../utils/timeZone'
import { string2IntArray } from '../../utils/string'
import { getSettingByPath } from './settingsService'
import {
  EventType,
  DateRangeObject,
  TimeRangeObject,
  TimeUnit,
  TimeRange,
  FreqObject,
  ByObject,
  TimeCodeLex,
  TimeCodeSem,
  TimeCodeParseResult,
  TimeCodeDao,
  DateUnit
} from './timeCodeParserTypes'
import { intersection, difference } from '../../utils/utils'

const timeZoneAbbrMap = getTimeZoneAbbrMap()

export function parseDateRange(dateRange: string): DateRangeObject {
  function parseDate(date: string): {
    year: number | null
    month: number | null
    day: number | null
  } {
    /**
     * 日期格式：
     * yyyy/m/d
     * m/d
     * d
     */
    const dateList: (string | null)[] = date.split('/')
    if (dateList.length > 3 || dateList.length < 1) {
      throw new Error(`invalid date: ${date}`)
    }
    while (dateList.length < 3) {
      dateList.unshift(null)
    }
    const [year, month, day]: (number | null)[] = dateList.map((item): number | null => {
      if (item) {
        return parseInt(item)
      }
      return null
    })
    return { year, month, day }
  }

  const res: DateRangeObject = {} as DateRangeObject
  if (dateRange?.includes('-')) {
    // 是日期范围
    const [dtstart, until] = dateRange.split('-').map((item) => parseDate(item))
    for (const key in until) {
      if (until[key] == null) {
        until[key] = dtstart[key]
      }
    }
    res.dtstart = dtstart as DateUnit
    res.until = until as DateUnit
  } else {
    const dtstart = parseDate(dateRange)
    res.dtstart = dtstart as DateUnit
  }
  if (res.dtstart.year == null) {
    const now = DateTime.now().setZone(getSettingByPath('rrule.timeZone'))
    // 如果 dtstart 没有年份，且 dtstart < now，则 dtstart 的年份为下一年
    if (
      res.dtstart.month != null &&
      res.dtstart.month <= now.month &&
      res.dtstart.day != null &&
      res.dtstart.day < now.day
    ) {
      res.dtstart.year = now.year + 1
    } else {
      res.dtstart.year = now.year
    }
    if (res.until && res.until.year == null) {
      res.until.year = res.dtstart.year
    }
  }
  res.value = `${res.dtstart.year}/${res.dtstart.month}/${res.dtstart.day}`
  if (res.until) {
    res.value += `-${res.until.year}/${res.until.month}/${res.until.day}`
  }
  return res
}

export function parseTimeRange(timeRange: string): TimeRangeObject {
  function splitTime(time: string): string[] {
    /**
     * 时间格式：
     * hh:mm
     * hh
     * hh:
     * :mm
     * :
     */
    const timeList = time.split(':')
    if (timeList.length > 2 || timeList.length < 1) {
      throw new Error(`invalid time: ${time}`)
    }
    while (timeList.length < 2) {
      timeList.push('0')
    }
    return timeList
  }

  const res: TimeRangeObject = {} as TimeRangeObject
  let startMark = 0b11 // 1 表示有效，0 表示无效
  let endMark = 0b11
  if (timeRange.includes('-')) {
    // 是时间范围
    const [start, end] = timeRange.split('-')
    let [startHour, startMin] = splitTime(start)
    let [endHour, endMin] = splitTime(end)
    if (startHour.includes('?') || startHour.length == 0) {
      startMark &= 0b01
      startHour = '0'
    }
    if (startMin.includes('?') || startMin.length == 0) {
      startMark &= 0b10
      startMin = '0'
    }
    if (endHour.includes('?') || endHour.length == 0) {
      endMark &= 0b01
      endHour = '0'
    }
    if (endMin.includes('?') || endMin.length == 0) {
      endMark &= 0b10
      endMin = '0'
    }
    if (startMark == 0b01 || endMark == 0b01) {
      throw new Error(`invalid time range: ${timeRange}`)
    }
    if ((startMark | endMark) >> 1 == 0b1) {
      const start: TimeUnit = { hour: parseInt(startHour), minute: parseInt(startMin) }
      const end: TimeUnit = { hour: parseInt(endHour), minute: parseInt(endMin) }
      Object.assign(res, { start, end, startMark, endMark })
    } else {
      throw new Error(`invalid time range: ${timeRange}`)
    }
  } else {
    const [endHour, endMin] = splitTime(timeRange)
    if (endHour.includes('?') || endMin.includes('?')) {
      throw new Error(`invalid time: ${timeRange}`)
    }
    const end = { hour: parseInt(endHour), minute: parseInt(endMin) }
    Object.assign(res, { start: null, end, startMark, endMark })
  }

  // @ts-ignore
  // toString(2) 转换为二进制字符串，padStart(2, '0') 补齐两位
  res.startMark = res.startMark.toString(2).padStart(2, '0')
  // @ts-ignore
  res.endMark = res.endMark.toString(2).padStart(2, '0')

  return res
}

export function parseFreq(freqCode: string): FreqObject {
  const res: FreqObject = {} as FreqObject
  let freq: string
  if (freqCode.includes(',')) {
    // 是 freq + 参数
    const [_freq, ...args] = freqCode.split(',')
    freq = _freq
    for (const arg of args) {
      if (arg[0] == 'i') {
        // 是 interval
        const interval = parseInt(arg.substring(1))
        if (interval < 0 || Number.isNaN(interval)) {
          throw new Error(`invalide interval: ${arg}`)
        }
        Object.assign(res, { interval })
      } else if (arg[0] == 'c') {
        // 是 count
        const count = parseInt(arg.substring(1))
        if (count < 0 || Number.isNaN(count)) {
          throw new Error(`invalide count: ${arg}`)
        }
        Object.assign(res, { count })
      } else {
        throw new Error(`invalid option: ${args}`)
      }
    }
  } else {
    // 是 freq
    freq = freqCode
  }

  let rruleFreq: number
  switch (freq) {
    case 'daily':
      rruleFreq = RRule.DAILY
      break
    case 'weekly':
      rruleFreq = RRule.WEEKLY
      break
    case 'monthly':
      rruleFreq = RRule.MONTHLY
      break
    case 'yearly':
      rruleFreq = RRule.YEARLY
      break
    default:
      throw new Error(`invalid freq: ${freq}`)
  }

  Object.assign(res, { freq: rruleFreq })
  return res
}

export function getWeekdayOffset(): number {
  const weekdays = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
  return weekdays.indexOf(getSettingByPath('rrule.wkst'))
}

export function parseBy(byCode: string): ByObject {
  const bys = ['month', 'weekno', 'yearday', 'monthday', 'day', 'setpos']
  const res: ByObject = {}
  for (const by of bys) {
    const index = byCode.indexOf(by)
    if (index > -1) {
      const value = byCode.substring(index + by.length + 1, byCode.indexOf(']', index))
      if (by != 'day') {
        Object.assign(res, { [`by${by}`]: string2IntArray(value) })
      } else {
        // rrule 库只接受 byweekday
        const weekdays = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA, RRule.SU]
        const choices = string2IntArray(value)
        const offset = getWeekdayOffset()
        const byweekday = choices.map((choice) => weekdays[choice - 1 + offset])
        if (byweekday[0] && byweekday.length > 0) {
          Object.assign(res, { byweekday })
        } else {
          throw new Error(`invalide byday ${value}`)
        }
      }
    }
  }
  return res
}

export function dateSugar(date: string): string {
  date = date.replace(/tdy|tmr/g, (match) => {
    if (match == 'tdy') {
      const now = DateTime.now().setZone(getSettingByPath('rrule.timeZone'))
      return `${now.year}/${now.month}/${now.day}`
    } else {
      const tomorrow = DateTime.now().plus({ days: 1 }).setZone(getSettingByPath('rrule.timeZone'))
      return `${tomorrow.year}/${tomorrow.month}/${tomorrow.day}`
    }
  })
  return date
}

export function timeSugar(time: string): string {
  time = time.replace(/start|end|s|e|\./g, (match) => {
    if (match == 'start' || match == 's') {
      return '0:0'
    } else if (match == 'end' || match == 'e') {
      return '23:59'
    } else {
      return ':'
    }
  })
  return time
}

export function parseTimeCodeLex(timeCode: string): TimeCodeLex {
  timeCode = timeCode.trim()
  const codes = timeCode.split(' ').filter((item) => item.length > 0) // 解决多个空格的问题
  if (codes && codes.length >= 2 && codes.length <= 5) {
    let [date, time, ...options] = codes

    date = dateSugar(date)
    time = timeSugar(time)

    const freq = ['daily', 'weekly', 'monthly', 'yearly']
    const optionsMark = { timeZone: 0, freq: 0, by: 0 } // 记录每个可选项的出现次数
    let timeZone = getSettingByPath('rrule.timeZone') // 默认值是设置中的时区
    let freqCode: string | null = null
    let byCode: string | null = null
    while (options.length > 0) {
      const code: string = options.shift()! // 不可能为 null
      if (code?.indexOf('by[') == 0) {
        // 是 by 函数
        optionsMark.by++
        byCode = code
      } else if (freq.includes(code) || freq.includes(code.split(',')[0])) {
        // 是 freq + 参数 或 freq
        optionsMark.freq++
        // @ts-ignore
        freqCode = code
      } else {
        // 是时区
        if (isValidTimeZone(code)) {
          optionsMark.timeZone++
          timeZone = code
        } else {
          // 是时区缩写
          if (timeZoneAbbrMap.has(code)) {
            optionsMark.timeZone++
            // 从缩写转换为完整的时区，直接选第一个
            timeZone = timeZoneAbbrMap.get(code).values().next().value
          }
          // 是非法内容
          else {
            throw new Error(`invalid time code options: ${code}`)
          }
        }
      }
      // 如果有超过两次的
      if (Object.values(optionsMark).some((value) => value > 1)) {
        throw new Error('invalid time code options')
      }
    }

    // 开始解析每个部分
    const dateRangeObj = parseDateRange(date)
    const timeRangeObj = parseTimeRange(time)
    let eventType = EventType.Event
    if (timeRangeObj.start == null) {
      eventType = EventType.Todo
    }

    const newTimeCode = `${dateRangeObj.value} ${time} ${timeZone}${
      freqCode ? ' ' + freqCode : ''
    }${byCode ? ' ' + byCode : ''}`

    return {
      eventType,
      dateRangeObj,
      timeRangeObj,
      timeZone,
      freqCode,
      byCode,
      newTimeCode
    }
  } else {
    throw new Error('time code error')
  }
}

function getWKST(): Weekday {
  const weekStart = getSettingByPath('rrule.wkst')
  switch (weekStart) {
    case 'MO':
      return RRule.MO
    case 'TU':
      return RRule.TU
    case 'WE':
      return RRule.WE
    case 'TH':
      return RRule.TH
    case 'FR':
      return RRule.FR
    case 'SA':
      return RRule.SA
    case 'SU':
      return RRule.SU
    default:
      throw new Error(`Unknown wkst: ${weekStart}`)
  }
}

export function parseTimeCodeSem(
  dateRangeObj: DateRangeObject,
  timeRangeObj: TimeRangeObject,
  timeZone: string,
  freqCode: string | null,
  byCode: string | null
): TimeCodeSem {
  const times: TimeRange[] = []
  const rruleConfig = {}
  const dtstart = datetime(
    dateRangeObj.dtstart.year,
    dateRangeObj.dtstart.month,
    dateRangeObj.dtstart.day
  )
  Object.assign(rruleConfig, { dtstart })
  let until: Date | null = null
  if (dateRangeObj.until) {
    until = datetime(dateRangeObj.until.year, dateRangeObj.until.month, dateRangeObj.until.day)
    Object.assign(rruleConfig, { until })
  }
  // 默认 Daily
  Object.assign(rruleConfig, { freq: RRule.DAILY })
  // until == null 时默认 count: 1
  if (!dateRangeObj.until) {
    Object.assign(rruleConfig, { count: 1 })
  }

  if (freqCode && dateRangeObj.until) {
    const freqObj = parseFreq(freqCode)
    Object.assign(rruleConfig, freqObj)
  }
  if (byCode && dateRangeObj.until) {
    const byObj = parseBy(byCode)
    Object.assign(rruleConfig, byObj)
  }
  // wkst
  Object.assign(rruleConfig, { wkst: getWKST() })

  // rrule
  const rrule = new RRule(rruleConfig)
  for (const t of rrule.all()) {
    // t 是 UTC 时区的，更改时区，但不改变时间的值
    const tAtTimeZone = DateTime.fromISO(t.toISOString())
      .setZone('UTC')
      .setZone(timeZone, { keepLocalTime: true })
    let start: DateTime | null = null
    let end = tAtTimeZone.set(timeRangeObj.end)
    if (timeRangeObj.start) {
      // 如果 start.hour > end.hour，说明跨天了
      if (timeRangeObj.start.hour > timeRangeObj.end.hour) {
        end = tAtTimeZone.plus({ days: 1 }).set(timeRangeObj.end)
      }
      start = tAtTimeZone.set(timeRangeObj.start)
    }

    // 转换成 UTC 时区
    start = start ? start.setZone('UTC') : start
    end = end.setZone('UTC')

    if (end.toISO() !== null) {
      times.push({
        ...timeRangeObj,
        start: start ? start.toISO() : start,
        end: end.toISO()!
      })
    } else {
      throw new Error('The value of end is invalid')
    }
  }
  // console.log(times)
  return {
    times,
    rruleObject: rrule
  }
}

export function timeCodeParser(timeCodes: string): TimeCodeParseResult {
  timeCodes = timeCodes.trim()
  // 去除 \n \t \r 等符号
  timeCodes = timeCodes.replace(/[\n\t\r]/g, '')
  const lines = timeCodes.split(';')

  let eventType: EventType | null = null
  const times: TimeRange[] = []
  const rruleObjects: RRule[] = []
  const newTimeCodes: string[] = []
  for (const line of lines) {
    if (line.length == 0) {
      continue
    }
    const {
      eventType: t,
      dateRangeObj,
      timeRangeObj,
      timeZone,
      freqCode,
      byCode,
      newTimeCode
    } = parseTimeCodeLex(line)

    if (eventType && eventType != t) {
      throw new Error('The event type of each line must be the same')
    }
    eventType = t
    newTimeCodes.push(newTimeCode)
    const { times: timesList, rruleObject } = parseTimeCodeSem(
      dateRangeObj,
      timeRangeObj,
      timeZone,
      freqCode,
      byCode
    )
    times.push(...timesList)
    rruleObjects.push(rruleObject)
  }
  return {
    eventType: eventType!, // 一定不为 null
    times,
    rruleObjects,
    newTimeCodes
  }
}

export function parseTimeCodes(rTimeCodes: string, exTimeCodes: string): TimeCodeDao {
  const {
    eventType: rEventType,
    times: rTimes,
    rruleObjects: rRruleObjects,
    newTimeCodes: rNewTimeCodes
  } = timeCodeParser(rTimeCodes)
  const {
    eventType: exEventType,
    times: exTimes,
    newTimeCodes: exNewTimeCodes
  } = timeCodeParser(exTimeCodes)

  if (exEventType && rEventType != exEventType) {
    throw new Error('The event type of each line must be the same')
  }

  const rruleStr = rRruleObjects.map((obj) => obj.toString()).join(' ')
  // console.log(rNewTimeCodes, exNewTimeCodes)

  // deleted: true，要去除的时间
  const inter = intersection(
    rTimes,
    exTimes,
    (a, b) => JSON.stringify(a) === JSON.stringify(b)
  ) as TimeRange[]
  // deleted: false，不要去除的时间
  const diff = difference(
    rTimes,
    exTimes,
    (a, b) => JSON.stringify(a) === JSON.stringify(b)
  ) as TimeRange[]

  return {
    eventType: rEventType,
    rTimes: diff,
    exTimes: inter,
    rruleStr,
    rTimeCodes: rNewTimeCodes.join(';'),
    exTimeCodes: exNewTimeCodes.join(';')
  }
}
