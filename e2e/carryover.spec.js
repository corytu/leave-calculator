import { test, expect } from '@playwright/test'
import { freezeTime, clearAppStorage, seedAppStorage } from './helpers.js'

// onboard 2022-06-15 + frozen "today" 2025-06-15 -> exactly 36 completed
// months -> current milestone 36 (14 days), previous milestone 24 (10 days).
// current period:  2025-06-15 ~ 2026-06-14
// previous period: 2024-06-15 ~ 2025-06-14
const SETTINGS_WITH_CARRYOVER = {
  onboardDate: '2022-06-15',
  ruleType: 'labor',
  customRules: [],
  allowCarryover: true,
}

test.describe('假期遞延', () => {
  test.beforeEach(async ({ page }) => {
    await freezeTime(page)
    await clearAppStorage(page)
    await seedAppStorage(page, { settings: SETTINGS_WITH_CARRYOVER, records: [] })
    await page.goto('/')
  })

  test('首頁出現上一週年度摘要卡片，遞延天數正確', async ({ page }) => {
    await expect(page.getByText('上一週年度（遞延來源）')).toBeVisible()
    await expect(page.getByTestId('previous-entitled')).toContainText('10')
    await expect(page.getByTestId('previous-taken')).toContainText('0')
    await expect(page.getByTestId('previous-carryover')).toContainText('10')

    // Current period: entitled 14 + carryover 10 = 24 remaining.
    await expect(page.getByTestId('summary-entitled')).toContainText('14')
    await expect(page.getByTestId('summary-remaining')).toContainText('24')
  })

  test('出現本年度／上一年度分頁切換，且切換後月曆與表單範圍改變', async ({ page }) => {
    await expect(page.getByRole('button', { name: '本年度' })).toBeVisible()
    await expect(page.getByRole('button', { name: '上一年度' })).toBeVisible()

    // Defaults to showing the current period's range in the form.
    await expect(page.locator('input[type="date"]')).toHaveAttribute('min', '2025-06-15')
    await expect(page.locator('input[type="date"]')).toHaveAttribute('max', '2026-06-14')

    await page.getByRole('button', { name: '上一年度' }).click()

    await expect(page.locator('input[type="date"]')).toHaveAttribute('min', '2024-06-15')
    await expect(page.locator('input[type="date"]')).toHaveAttribute('max', '2025-06-14')
  })

  test('遞延天數會在上一週期已休完時 clamp 為 0', async ({ page }) => {
    await seedAppStorage(page, {
      settings: SETTINGS_WITH_CARRYOVER,
      records: [{ id: 'r1', startDate: '2024-07-01', days: 10 }],
    })
    await page.reload()

    await expect(page.getByTestId('previous-carryover')).toContainText('0')
    await expect(page.getByTestId('summary-remaining')).toContainText('14')
  })
})
