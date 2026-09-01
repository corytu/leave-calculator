import { test, expect } from '@playwright/test'
import { freezeTime, clearAppStorage, seedAppStorage } from './helpers.js'

// onboard 2024-06-15 + frozen "today" 2025-06-15 -> exactly 12 completed
// months -> current period is 2025-06-15 ~ 2026-06-14, entitled 7 days.
const BASE_SETTINGS = {
  onboardDate: '2024-06-15',
  ruleType: 'labor',
  customRules: [],
  allowCarryover: false,
}

test.describe('月曆互動與請假記錄 CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await freezeTime(page)
    await clearAppStorage(page)
    await seedAppStorage(page, { settings: BASE_SETTINGS, records: [] })
    await page.goto('/')
  })

  test('月曆顯示週首標題列（7 欄）且區間外日期不可點擊', async ({ page }) => {
    const weekdays = page.locator('.react-calendar__month-view__weekdays__weekday')
    await expect(weekdays).toHaveCount(7)

    // June 1st 2025 is before the period start (2025-06-15) and should be
    // rendered disabled / out-of-period.
    const juneFirst = page
      .locator('.react-calendar__tile')
      .filter({ hasText: /^1$/ })
      .first()
    await expect(juneFirst).toHaveClass(/react-calendar__tile--out-of-period/)
  })

  test('點擊月曆日期會帶入表單的開始日期', async ({ page }) => {
    const day20 = page
      .locator('.react-calendar__month-view__days__day:not(.react-calendar__month-view__days__day--neighboringMonth)')
      .getByText('20', { exact: true })
    await day20.click()

    await expect(page.locator('input[type="date"]')).toHaveValue('2025-06-20')
  })

  test('新增請假記錄後：清單出現、月曆綠點出現、已休天數更新', async ({ page }) => {
    await page
      .locator('.react-calendar__month-view__days__day:not(.react-calendar__month-view__days__day--neighboringMonth)')
      .getByText('20', { exact: true })
      .click()
    await page.getByRole('button', { name: '2天', exact: true }).click()
    await page.getByRole('button', { name: '新增', exact: true }).click()

    await expect(page.getByText('2025-06-20')).toBeVisible()
    await expect(page.getByTestId('summary-taken')).toContainText('2')

    // The calendar tile for the 20th should now show the leave dot.
    const tile20 = page
      .locator('.react-calendar__month-view__days__day:not(.react-calendar__month-view__days__day--neighboringMonth)')
      .filter({ hasText: '20' })
    await expect(tile20.locator('.leave-dot')).toBeVisible()
  })

  test('編輯既有記錄：帶入原值、修改後清單與首頁同步更新', async ({ page }) => {
    await seedAppStorage(page, {
      settings: BASE_SETTINGS,
      records: [{ id: 'r1', startDate: '2025-06-20', days: 2 }],
    })
    await page.reload()

    await page.getByRole('button', { name: '編輯' }).click()
    await expect(page.locator('input[type="date"]')).toHaveValue('2025-06-20')
    await expect(page.locator('input[type="number"]').first()).toHaveValue('2')

    await page.locator('input[type="number"]').first().fill('3')
    await page.getByRole('button', { name: '儲存變更' }).click()

    await expect(page.getByText('3 天')).toBeVisible()
    await expect(page.getByTestId('summary-taken')).toContainText('3')
  })

  test('刪除記錄：清單移除、月曆綠點消失、天數回復', async ({ page }) => {
    await seedAppStorage(page, {
      settings: BASE_SETTINGS,
      records: [{ id: 'r1', startDate: '2025-06-20', days: 2 }],
    })
    await page.reload()

    await page.getByRole('button', { name: '刪除' }).click()

    await expect(page.getByText('本週年度尚無請假記錄')).toBeVisible()
    await expect(page.getByTestId('summary-taken')).toContainText('0')
  })

  test('日期超出當前週期範圍時顯示錯誤，不允許送出', async ({ page }) => {
    // 2025-06-01 is before periodStart (2025-06-15).
    await page.locator('input[type="date"]').fill('2025-06-01')
    await page.getByRole('button', { name: '新增', exact: true }).click()

    await expect(page.getByText('日期必須在本週年度範圍內')).toBeVisible()
    await expect(page.getByText('本週年度尚無請假記錄')).toBeVisible()
  })
})

test.describe('資料持久化', () => {
  test('新增記錄並重新整理頁面後，資料仍然存在', async ({ page }) => {
    await freezeTime(page)
    await clearAppStorage(page)
    await seedAppStorage(page, { settings: BASE_SETTINGS, records: [] })
    await page.goto('/')

    await page
      .locator('.react-calendar__month-view__days__day:not(.react-calendar__month-view__days__day--neighboringMonth)')
      .getByText('20', { exact: true })
      .click()
    await page.getByRole('button', { name: '1天', exact: true }).click()
    await page.getByRole('button', { name: '新增', exact: true }).click()
    await expect(page.getByText('2025-06-20')).toBeVisible()

    await page.reload()

    await expect(page.getByText('2025-06-20')).toBeVisible()
    await expect(page.getByTestId('summary-taken')).toContainText('1')
  })
})
