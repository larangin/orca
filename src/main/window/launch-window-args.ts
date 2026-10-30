const OPEN_PATH_ARG_PREFIX = '--open-path='
const WINDOW_TITLE_ARG_PREFIX = '--window-title='

/** Project launchers pass --open-path=<repo root> and --window-title=<name> (larangin/orca fork). */
export function launchWindowArgs(argv: readonly string[]): { openPath?: string; title?: string } {
  const value = (prefix: string): string | undefined =>
    argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || undefined
  return { openPath: value(OPEN_PATH_ARG_PREFIX), title: value(WINDOW_TITLE_ARG_PREFIX) }
}
