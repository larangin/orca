// A window opened by File > New Window starts empty and leaves the session to the primary window.
export const isSecondaryWindow =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('orcaWindowRole') === 'secondary'
