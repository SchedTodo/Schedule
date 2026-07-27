export interface ScheduleDocumentAst {
  readonly statements: readonly ScheduleStatementAst[]
}

export interface ScheduleStatementAst {
  readonly dates: readonly [string, string?]
  readonly times: readonly [string, string?]
  readonly duration?: {
    readonly value: number
    readonly unit: 'hours' | 'minutes'
  }
  readonly timeZone?: string
  readonly frequency?: {
    readonly unit: FrequencyUnit
    readonly interval?: number
    readonly count?: number
    readonly hasDuplicateOptions: boolean
  }
  readonly by: Readonly<Record<string, readonly number[]>>
}

export type FrequencyUnit = 'daily' | 'weekly' | 'monthly' | 'yearly'
