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

/** Clear both localStorage keys used by the app. */
export async function clearAppStorage(page) {
  await page.addInitScript(() => {
    window.localStorage.removeItem('leaveCalculator_settings')
    window.localStorage.removeItem('leaveCalculator_records')
  })
}

/**
 * Seed settings + records directly into localStorage before first navigation.
 * Mirrors the shape of DEFAULT_SETTINGS / records in src/utils/storage.js.
 */
export async function seedAppStorage(page, { settings, records = [] } = {}) {
  await page.addInitScript(
    ([settingsJson, recordsJson]) => {
      if (settingsJson) window.localStorage.setItem('leaveCalculator_settings', settingsJson)
      if (recordsJson) window.localStorage.setItem('leaveCalculator_records', recordsJson)
    },
    [settings ? JSON.stringify(settings) : null, JSON.stringify(records)]
  )
}

/**
 * Drive react-calendar's popup date picker (used in Settings for 到職日) to
 * select an arbitrary date, by drilling up to decade view and back down.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{year: number, month: number, day: number}} target month is 1-12
 */
export async function pickDateViaCalendarPopup(page, { year, month, day }) {
  const popup = page.locator('.react-calendar')
  const label = popup.locator('.react-calendar__navigation__label')

  // From month view: 1 click -> year view, 2 clicks -> decade view.
  await label.click()
  await label.click()

  // Decade view: tiles are years, e.g. "2023".
  await popup.getByText(String(year), { exact: true }).click()

  // Year view: tiles are months, labelled per the zh-TW locale (e.g. "1月").
  await popup.getByText(`${month}月`, { exact: true }).click()

  // Month view: tiles are day numbers.
  await popup
    .locator('.react-calendar__month-view__days__day:not(.react-calendar__month-view__days__day--neighboringMonth)')
    .getByText(String(day), { exact: true })
    .click()
}
