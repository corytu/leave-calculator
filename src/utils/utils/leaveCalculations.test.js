import { describe, it, expect } from 'vitest'
import {
  addMonthsToDate,
  getCompletedMonths,
  toISODateString,
  parseLocalDate,
  getLaborLawDays,
  getDaysForMilestone,
  getMilestones,
  getPeriodInfo,
  getPeriodContainingDate,
  getPreviousPeriod,
  getLeaveTakenInPeriod,
  calculateSummary,
  checkLaborLawCompliance,
} from './leaveCalculations.js'

// Small helper so test cases read like dates, not Date(y, m-1, d) noise.
const d = (str) => parseLocalDate(str)

describe('addMonthsToDate', () => {
  it('adds months normally with no overflow', () => {
    expect(toISODateString(addMonthsToDate(d('2024-03-15'), 2))).toBe('2024-05-15')
  })

  it('clamps month-end overflow in a non-leap year (Jan 31 + 1mo -> Feb 28)', () => {
    expect(toISODateString(addMonthsToDate(d('2025-01-31'), 1))).toBe('2025-02-28')
  })

  it('clamps month-end overflow in a leap year (Jan 31 + 1mo -> Feb 29)', () => {
    expect(toISODateString(addMonthsToDate(d('2024-01-31'), 1))).toBe('2024-02-29')
  })

  it('handles a Feb 29 onboard date rolling into a non-leap year (+12mo -> Feb 28)', () => {
    expect(toISODateString(addMonthsToDate(d('2024-02-29'), 12))).toBe('2025-02-28')
  })

  it('handles crossing a year boundary (Nov + 3mo -> next Feb)', () => {
    expect(toISODateString(addMonthsToDate(d('2023-11-10'), 3))).toBe('2024-02-10')
  })
})

describe('getCompletedMonths', () => {
  it('returns 0 when less than a month has elapsed (1 day short)', () => {
    expect(getCompletedMonths(d('2024-01-01'), d('2024-01-31'))).toBe(0)
  })

  it('returns the exact month count on the anniversary day itself', () => {
    expect(getCompletedMonths(d('2024-01-01'), d('2024-07-01'))).toBe(6)
  })

  it('counts full months plus a leftover day fraction correctly (floors down)', () => {
    expect(getCompletedMonths(d('2024-01-15'), d('2024-08-20'))).toBe(7)
  })

  it('returns 0 when from === to', () => {
    const date = d('2024-05-05')
    expect(getCompletedMonths(date, date)).toBe(0)
  })
})

describe('toISODateString / parseLocalDate', () => {
  it('round-trips a normal date', () => {
    expect(toISODateString(parseLocalDate('2024-06-15'))).toBe('2024-06-15')
  })

  it('round-trips a month-start date', () => {
    expect(toISODateString(parseLocalDate('2024-03-01'))).toBe('2024-03-01')
  })

  it('round-trips a month-end / leap-day date', () => {
    expect(toISODateString(parseLocalDate('2024-02-29'))).toBe('2024-02-29')
  })

  it('round-trips a year-boundary date', () => {
    expect(toISODateString(parseLocalDate('2023-12-31'))).toBe('2023-12-31')
  })
})

describe('getLaborLawDays', () => {
  it.each([
    [0, 0],
    [5, 0],
    [6, 3],
    [11, 3],
    [12, 7],
    [23, 7],
    [24, 10],
    [35, 10],
    [36, 14],
    [59, 14],
    [60, 15],
    [119, 15],
    [120, 16],
    [131, 16],
    [132, 17],
  ])('gives the correct days at %i months -> %i days', (months, expected) => {
    expect(getLaborLawDays(months)).toBe(expected)
  })

  it('caps at 30 days for very long tenure (300 months)', () => {
    expect(getLaborLawDays(300)).toBe(30)
  })

  it('caps at 30 days and stays there beyond the cap (360 months)', () => {
    expect(getLaborLawDays(360)).toBe(30)
  })
})

describe('getMilestones (labor law extension covers upToMonths)', () => {
  it('extends the fixed milestone list far enough to cover upToMonths', () => {
    const milestones = getMilestones('labor', [], 200)
    expect(Math.max(...milestones)).toBeGreaterThanOrEqual(200)
    // Should still include all the fixed early milestones
    expect(milestones).toEqual(expect.arrayContaining([6, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120]))
  })

  it('returns [6] fallback for empty custom rules', () => {
    expect(getMilestones('custom', [], 100)).toEqual([6])
  })

  it('extends custom rules annually past the last defined rule', () => {
    const custom = [{ months: 6, days: 3 }, { months: 18, days: 10 }]
    const milestones = getMilestones('custom', custom, 50)
    expect(milestones[0]).toBe(6)
    expect(milestones[1]).toBe(18)
    expect(milestones).toContain(30) // 18 + 12
    expect(milestones).toContain(42) // 18 + 24
    expect(Math.max(...milestones)).toBeGreaterThanOrEqual(50)
  })
})

describe('getDaysForMilestone', () => {
  it('delegates to labor law days for ruleType "labor"', () => {
    expect(getDaysForMilestone(24, 'labor', [])).toBe(getLaborLawDays(24))
  })

  const custom = [
    { months: 6, days: 3 },
    { months: 12, days: 7 },
    { months: 24, days: 10 },
  ]

  it('matches an exact threshold for custom rules', () => {
    expect(getDaysForMilestone(12, 'custom', custom)).toBe(7)
  })

  it('falls back to the lower threshold when between two custom thresholds', () => {
    expect(getDaysForMilestone(18, 'custom', custom)).toBe(7)
  })

  it('returns 0 for custom rules below the lowest threshold', () => {
    expect(getDaysForMilestone(3, 'custom', custom)).toBe(0)
  })
})

describe('getPeriodInfo', () => {
  it('computes correct periodStart/periodEnd/entitledDays for a normal case', () => {
    const info = getPeriodInfo(d('2023-01-08'), 12, 'labor', [])
    expect(toISODateString(info.periodStart)).toBe('2024-01-08')
    // Next milestone is 24 months -> period end is the day before.
    expect(toISODateString(info.periodEnd)).toBe('2025-01-07')
    expect(info.entitledDays).toBe(7)
  })

  it('adds 12 months when past the last known milestone', () => {
    // 132 is the last known milestone before the +12 extension kicks in during this call
    const info = getPeriodInfo(d('2020-01-01'), 132, 'labor', [])
    expect(info.nextMilestoneMonths).toBe(144)
  })
})

describe('getPeriodContainingDate', () => {
  const onboard = d('2023-01-08')

  it('returns null before the first milestone is reached', () => {
    expect(getPeriodContainingDate(onboard, d('2023-06-01'), 'labor', [])).toBeNull()
  })

  it('returns the correct period exactly on a milestone day', () => {
    const period = getPeriodContainingDate(onboard, d('2023-07-08'), 'labor', [])
    expect(period.milestoneMonths).toBe(6)
  })

  it('returns the correct period mid-way through it', () => {
    const period = getPeriodContainingDate(onboard, d('2023-10-01'), 'labor', [])
    expect(period.milestoneMonths).toBe(6)
  })
})

describe('getPreviousPeriod', () => {
  const onboard = d('2022-01-08')

  it('returns null when currently in the first period', () => {
    expect(getPreviousPeriod(onboard, 'labor', [], d('2022-07-10'))).toBeNull()
  })

  it('correctly steps back to the previous period', () => {
    // At 2023-07-10, completed months since 2022-01-08 = 18 -> milestone 12 (year 2, 7 days)
    const prev = getPreviousPeriod(onboard, 'labor', [], d('2023-07-10'))
    expect(prev.milestoneMonths).toBe(6)
  })
})

describe('getLeaveTakenInPeriod', () => {
  const periodStart = d('2024-01-08')
  const periodEnd = d('2025-01-07')

  it('includes records exactly on the boundary dates', () => {
    const records = [
      { startDate: '2024-01-08', days: 1 },
      { startDate: '2025-01-07', days: 1 },
    ]
    expect(getLeaveTakenInPeriod(records, periodStart, periodEnd)).toBe(2)
  })

  it('excludes records outside the period', () => {
    const records = [
      { startDate: '2024-01-07', days: 1 },
      { startDate: '2025-01-08', days: 1 },
    ]
    expect(getLeaveTakenInPeriod(records, periodStart, periodEnd)).toBe(0)
  })

  it('sums multiple records within the period', () => {
    const records = [
      { startDate: '2024-02-01', days: 1 },
      { startDate: '2024-03-01', days: 2.5 },
      { startDate: '2024-04-01', days: 0.25 },
    ]
    expect(getLeaveTakenInPeriod(records, periodStart, periodEnd)).toBe(3.75)
  })
})

describe('calculateSummary', () => {
  const today = d('2025-06-15')

  it('reports hasLeave: false with a message when onboardDate is missing', () => {
    const result = calculateSummary({ onboardDate: '', ruleType: 'labor', customRules: [], allowCarryover: false }, [], today)
    expect(result.hasLeave).toBe(false)
    expect(result.message).toBeTruthy()
  })

  it('reports hasLeave: false with a first-milestone message before minimum tenure', () => {
    const settings = { onboardDate: '2025-06-01', ruleType: 'labor', customRules: [], allowCarryover: false }
    const result = calculateSummary(settings, [], today)
    expect(result.hasLeave).toBe(false)
    expect(result.message).toContain('2025-12-01')
  })

  it('computes current period correctly with no carryover', () => {
    // 2023-06-15 -> 2025-06-15 is exactly 24 completed months -> milestone 24 -> 10 days
    const settings = { onboardDate: '2023-06-15', ruleType: 'labor', customRules: [], allowCarryover: false }
    // Current period starts exactly on 2025-06-15 (the milestone date), so a record
    // dated 2025-01-01 would actually fall in the *previous* period, not this one.
    const records = [{ startDate: '2025-06-20', days: 2 }]
    const result = calculateSummary(settings, records, today)
    expect(result.hasLeave).toBe(true)
    expect(result.current.entitledDays).toBe(10)
    expect(result.current.taken).toBe(2)
    expect(result.previous).toBeNull()
  })

  it('adds carryover from the previous period when it has remaining days', () => {
    const settings = { onboardDate: '2022-06-15', ruleType: 'labor', customRules: [], allowCarryover: true }
    // At 2025-06-15: completed months = 36 -> current milestone 36 (14 days)
    // Previous milestone 24 (10 days), no records taken in it -> carryover 10
    const result = calculateSummary(settings, [], today)
    expect(result.hasLeave).toBe(true)
    expect(result.previous).not.toBeNull()
    expect(result.previous.carryoverDays).toBe(10)
    expect(result.current.remaining).toBe(result.current.baseRemaining + 10)
  })

  it('clamps carryover to 0 when the previous period was fully used', () => {
    const settings = { onboardDate: '2022-06-15', ruleType: 'labor', customRules: [], allowCarryover: true }
    // Previous period (milestone 24, 10 days) spans 2024-06-15 ~ 2025-06-14
    const records = [{ startDate: '2024-07-01', days: 10 }]
    const result = calculateSummary(settings, records, today)
    expect(result.previous.carryoverDays).toBe(0)
    expect(result.current.remaining).toBe(result.current.baseRemaining)
  })

  it('does not error when carryover is enabled but currently in the first period', () => {
    // onboard 2024-12-01 -> exactly 6 completed months at today (2025-06-15) -> first milestone, no previous period
    const settings = { onboardDate: '2024-12-01', ruleType: 'labor', customRules: [], allowCarryover: true }
    const result = calculateSummary(settings, [], today)
    expect(result.hasLeave).toBe(true)
    expect(result.previous).toBeNull()
  })
})

describe('checkLaborLawCompliance', () => {
  it('flags custom rules below the labor law minimum', () => {
    const custom = [{ months: 12, days: 5 }] // labor law min at 12mo is 7
    const warnings = checkLaborLawCompliance(custom)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatchObject({ months: 12, customDays: 5, legalMinimum: 7 })
  })

  it('does not flag rules that meet or exceed the labor law minimum', () => {
    const custom = [{ months: 12, days: 7 }, { months: 24, days: 12 }]
    expect(checkLaborLawCompliance(custom)).toHaveLength(0)
  })

  it('returns an empty array for an empty rule set', () => {
    expect(checkLaborLawCompliance([])).toEqual([])
  })
})
