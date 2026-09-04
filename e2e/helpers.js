/**
 * e2e/helpers.js
 *
 * Shared helpers for the Playwright suite.
 *
 * Two ways of getting the app into a given state are used across the specs:
 *
 * 1. Driving the actual UI (react-calendar's date picker) — used once, in
 *    onboarding-and-settings.spec.js, to prove the real "click through the
 *    calendar and save" flow works end to end.
 * 2. Seeding localStorage directly before navigating — used everywhere else
 *    that needs a specific onboardDate/records combination (e.g. carryover
 *    scenarios). This keeps those tests fast and avoids re-testing the same
 *    calendar-navigation mechanics repeatedly; the storage keys/shape mirror
 *    src/utils/storage.js exactly, so a shape mismatch there would still be
 *    caught by the unit tests.
 */

export const FIXED_TODAY = '2025-06-15T03:00:00' // 2025-06-15 local time

/** Freeze the browser clock so all "today"-based calculations are deterministic. */
export async function freezeTime(page, iso = FIXED_TODAY) {
  await page.clock.install({ time: new Date(iso) })
}

/**
 * Build the zh-TW accessible name react-calendar gives a month-view day tile,
 * e.g. zhDayLabel({year: 2025, month: 6, day: 20}) -> "2025年6月20日".
 * Confirmed directly from a Playwright accessibility snapshot (not guessed):
 * `button "2025年6月1日" [disabled]: 1日`. Used with getByRole for exact,
 * unambiguous day-tile targeting instead of matching on visible text/class.
 */
export function zhDayLabel({ year, month, day }) {
  return `${year}年${month}月${day}日`
}

/**
 * Seed settings and/or records directly into localStorage before first
 * navigation. Mirrors the shape of DEFAULT_SETTINGS / records in
 * src/utils/storage.js.
 *
 * IMPORTANT: this uses page.addInitScript(), which re-runs on *every*
 * navigation in the page's lifetime -- including page.reload(). Only pass
 * the fields you want forcibly reset on every future navigation too. In
 * particular, don't pass `records` in a test that adds records via the real
 * UI and then reloads to check persistence -- doing so will silently wipe
 * whatever was added, since this same script fires again on that reload.
 * Omit a field entirely (rather than passing `[]` / `{}`) to leave it alone.
 */
export async function seedAppStorage(page, { settings, records } = {}) {
  await page.addInitScript(
    ([settingsJson, recordsJson]) => {
      if (settingsJson !== null) window.localStorage.setItem('leaveCalculator_settings', settingsJson)
      if (recordsJson !== null) window.localStorage.setItem('leaveCalculator_records', recordsJson)
    },
    [
      settings !== undefined ? JSON.stringify(settings) : null,
      records !== undefined ? JSON.stringify(records) : null,
    ]
  )
}
