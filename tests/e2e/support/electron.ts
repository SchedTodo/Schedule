import { _electron as electron, type ElectronApplication } from '@playwright/test'
import type { ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface LaunchScheduleOptions {
  directory?: string
  extraArgs?: readonly string[]
  databasePath?: string
  keepDirectory?: boolean
  tray?: boolean
}

export interface LaunchedSchedule {
  application: ElectronApplication
  directory: string
  databasePath: string
  keepDirectory: boolean
  process: ChildProcess
  profilePath: string
}

export async function launchSchedule(
  options: LaunchScheduleOptions = {}
): Promise<LaunchedSchedule> {
  const directory =
    options.directory ?? mkdtempSync(join(tmpdir(), 'schedule-electron-e2e-'))
  const databasePath = options.databasePath ?? join(directory, 'schedule.db')
  const profilePath = join(directory, 'profile')
  const environment = {
    ...process.env,
    SCHEDULE_DATABASE_PATH: databasePath
  }
  if (options.tray) delete environment.SCHEDULE_DISABLE_TRAY
  else environment.SCHEDULE_DISABLE_TRAY = '1'

  const application = await electron.launch({
    args: [`--user-data-dir=${profilePath}`, '.', ...(options.extraArgs ?? [])],
    env: environment
  })
  return {
    application,
    directory,
    databasePath,
    keepDirectory: options.keepDirectory ?? false,
    process: application.process(),
    profilePath
  }
}

export async function closeSchedule(launched: LaunchedSchedule): Promise<void> {
  try {
    if (launched.process.exitCode === null) {
      await launched.application.close()
    }
  } finally {
    if (!launched.keepDirectory) {
      removeScheduleDirectory(launched.directory)
    }
  }
}

export function removeScheduleDirectory(directory: string): void {
  rmSync(directory, { recursive: true, force: true })
}
