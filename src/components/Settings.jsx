import Calendar from 'react-calendar'
import { useState, useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { checkLaborLawCompliance, getLaborLawDays } from '../utils/leaveCalculations.js'
import { DEFAULT_SETTINGS } from '../utils/storage.js'
import { parseLocalDate, toISODateString } from '../utils/leaveCalculations.js'

// Default custom rules pre-populated with labor law as a starting point
const DEFAULT_CUSTOM_RULES = [
  { id: uuidv4(), months: 6,   days: 3  },
  { id: uuidv4(), months: 12,  days: 7  },
  { id: uuidv4(), months: 24,  days: 10 },
  { id: uuidv4(), months: 36,  days: 14 },
  { id: uuidv4(), months: 60,  days: 15 },
  { id: uuidv4(), months: 120, days: 16 },
]

export default function Settings({ settings, onSave, onCancel }) {
  const [onboardDate,    setOnboardDate]    = useState(settings.onboardDate    || '')
  const [ruleType,       setRuleType]       = useState(settings.ruleType       || 'labor')
  const [customRules,    setCustomRules]    = useState(
    settings.customRules?.length > 0
      ? settings.customRules.map(r => ({ ...r, id: r.id || uuidv4() }))
      : DEFAULT_CUSTOM_RULES
  )
  const [allowCarryover, setAllowCarryover] = useState(settings.allowCarryover ?? false)

  // Compliance warnings derived from current custom rules
  const [warnings, setWarnings] = useState([])

  useEffect(() => {
    if (ruleType === 'custom') {
      setWarnings(checkLaborLawCompliance(customRules))
    } else {
      setWarnings([])
    }
  }, [ruleType, customRules])

  // ── Custom rules helpers ─────────────────────────────────────────────────

  function addCustomRule() {
    const sorted = [...customRules].sort((a, b) => a.months - b.months)
    const lastMonths = sorted.length > 0 ? sorted[sorted.length - 1].months : 0
    setCustomRules(prev => [
      ...prev,
      { id: uuidv4(), months: lastMonths + 12, days: 15 },
    ])
  }

  function updateCustomRule(id, field, value) {
    setCustomRules(prev =>
      prev.map(r => r.id === id ? { ...r, [field]: value } : r)
    )
  }

  function removeCustomRule(id) {
    setCustomRules(prev => prev.filter(r => r.id !== id))
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  function handleSave() {
    // Validate onboard date
    if (!onboardDate) {
      alert('請填寫到職日')
      return
    }

    // Validate custom rules: months must be positive integers, days must be >0
    if (ruleType === 'custom') {
      const sorted = [...customRules].sort((a, b) => a.months - b.months)
      for (const r of sorted) {
        if (!Number.isInteger(r.months) || r.months < 1) {
          alert('年資門檻請填寫正整數（月數）')
          return
        }
        if (r.days <= 0) {
          alert('特休天數請填寫大於 0 的數字')
          return
        }
      }
    }

    onSave({
      onboardDate,
      ruleType,
      customRules: ruleType === 'custom'
        ? [...customRules].sort((a, b) => a.months - b.months)
        : DEFAULT_SETTINGS.customRules,
      allowCarryover,
    })
  }

  const sortedRules = [...customRules].sort((a, b) => a.months - b.months)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-stone-800">設定</h1>
        <p className="text-sm text-stone-500 mt-0.5">設定到職日與特休規則</p>
      </div>

      {/* ── 到職日 ──────────────────────────────────────────────────────── */}
      <Section title="到職日">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            到職日期
          </label>
          <DatePicker value={onboardDate} onChange={setOnboardDate} />
          <p className="text-xs text-stone-400 mt-1">
            特休年資的計算起點
          </p>
        </div>
      </Section>

      {/* ── 特休規則 ─────────────────────────────────────────────────────── */}
      <Section title="特休規則">
        <div className="space-y-4">
          {/* Rule type selector */}
          <div className="flex flex-col sm:flex-row gap-3">
            <RuleTypeCard
              selected={ruleType === 'labor'}
              onClick={() => setRuleType('labor')}
              title="按勞基法第38條"
              description="依法定最低標準自動套用，含6個月、1年、2年等各階段。"
            />
            <RuleTypeCard
              selected={ruleType === 'custom'}
              onClick={() => setRuleType('custom')}
              title="公司另有規定"
              description="自訂各年資門檻的特休天數。"
            />
          </div>

          {/* Labor law preview */}
          {ruleType === 'labor' && (
            <div className="rounded-lg border border-stone-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50">
                    <th className="text-left px-4 py-2 text-stone-600 font-medium">年資門檻</th>
                    <th className="text-right px-4 py-2 text-stone-600 font-medium">天數</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {[
                    { label: '滿 6 月未滿 12 月',   months: 6   },
                    { label: '滿 12 月未滿 24 月',  months: 12  },
                    { label: '滿 24 月未滿 36 月',  months: 24  },
                    { label: '滿 36 月未滿 60 月',  months: 36  },
                    { label: '滿 60 月未滿 120 月', months: 60  },
                    { label: '滿 120 月以上',        months: 120 },
                  ].map(row => (
                    <tr key={row.months}>
                      <td className="px-4 py-2 text-stone-700">{row.label}</td>
                      <td className="px-4 py-2 text-right text-stone-700">
                        {row.months >= 120
                          ? '每年加 1 天，上限 30 天'
                          : `${getLaborLawDays(row.months)} 天`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Custom rules editor */}
          {ruleType === 'custom' && (
            <div className="space-y-3">
              {/* Compliance warnings */}
              {warnings.length > 0 && (
                <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                  <p className="font-semibold mb-1">⚠ 以下規則低於勞基法最低標準</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {warnings.map(w => (
                      <li key={w.months}>
                        滿 {w.months} 個月：您設定 {w.customDays} 天，勞基法最低 {w.legalMinimum} 天
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-amber-600">仍可儲存，但請確認是否符合規定。</p>
                </div>
              )}

              {/* Rules table */}
              <div className="rounded-lg border border-stone-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-stone-50">
                      <th className="text-left px-3 py-2 text-stone-600 font-medium">滿幾個月後</th>
                      <th className="text-left px-3 py-2 text-stone-600 font-medium">每年可休天數</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {sortedRules.map(rule => (
                      <tr key={rule.id}>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={rule.months}
                              onChange={e =>
                                updateCustomRule(rule.id, 'months', parseInt(e.target.value, 10) || 0)
                              }
                              className="w-20 rounded border border-stone-300 px-2 py-1 text-sm
                                         focus:outline-none focus:ring-1 focus:ring-teal-500"
                            />
                            <span className="text-stone-500 text-xs">個月</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              step={0.25}
                              value={rule.days}
                              onChange={e =>
                                updateCustomRule(rule.id, 'days', parseFloat(e.target.value) || 0)
                              }
                              className="w-20 rounded border border-stone-300 px-2 py-1 text-sm
                                         focus:outline-none focus:ring-1 focus:ring-teal-500"
                            />
                            <span className="text-stone-500 text-xs">天</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => removeCustomRule(rule.id)}
                            className="text-stone-400 hover:text-red-500 transition-colors"
                            aria-label="刪除此規則"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={addCustomRule}
                className="flex items-center gap-1.5 text-sm text-teal-700 hover:text-teal-900
                           font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                新增規則
              </button>
            </div>
          )}
        </div>
      </Section>

      {/* ── 遞延 ────────────────────────────────────────────────────────── */}
      <Section title="假期遞延">
        <div className="flex items-start gap-3">
          <label className="relative mt-0.5 inline-flex flex-shrink-0 cursor-pointer items-center">
            <input
              type="checkbox"
              role="switch"
              checked={allowCarryover}
              onChange={() => setAllowCarryover(v => !v)}
              className="peer sr-only"
            />
            {/* 軌道 */}
            <span
              className="h-6 w-10 rounded-full bg-stone-300 transition-colors
                        peer-checked:bg-teal-600
                        peer-focus-visible:ring-2 peer-focus-visible:ring-teal-500
                        peer-focus-visible:ring-offset-1"
            />
            {/* 圓點 */}
            <span
              className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow
                        transition-transform peer-checked:translate-x-4"
            />
          </label>
          <div>
            <p className="text-sm font-medium text-stone-700">允許遞延</p>
            <p className="text-xs text-stone-500 mt-0.5">
              若雇主允許，可將上一個週年度未休完的假期帶入本年度使用。
            </p>
          </div>
        </div>
      </Section>

      {/* ── Action buttons ───────────────────────────────────────────────── */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSave}
          className="px-5 py-2 bg-teal-700 text-white text-sm font-medium rounded-md
                     hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500
                     focus:ring-offset-1 transition-colors"
        >
          儲存設定
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-2 text-stone-600 text-sm font-medium rounded-md
                     hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400
                     focus:ring-offset-1 transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-stone-100 bg-stone-50">
        <h2 className="text-sm font-semibold text-stone-700">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

function RuleTypeCard({ selected, onClick, title, description }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-left rounded-lg border-2 px-4 py-3 transition-all
                  ${selected
                    ? 'border-teal-600 bg-teal-50'
                    : 'border-stone-200 bg-white hover:border-stone-300'
                  }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center
                          ${selected ? 'border-teal-600' : 'border-stone-300'}`}>
          {selected && <span className="w-2 h-2 rounded-full bg-teal-600" />}
        </span>
        <span className={`text-sm font-medium ${selected ? 'text-teal-800' : 'text-stone-700'}`}>
          {title}
        </span>
      </div>
      <p className="text-xs text-stone-500 pl-6">{description}</p>
    </button>
  )
}

function DatePicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const buttonRef = useRef(null)
  const dateObj = value ? parseLocalDate(value) : null

  function handleOpen() {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left })
    }
    setOpen(v => !v)
  }

  function handleSelect(date) {
    onChange(toISODateString(date))
    setOpen(false)
  }

  return (
    <div className="inline-block">
      {open && (
        <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
      )}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className="relative z-20 flex items-center gap-2 rounded-md border border-stone-300
                   px-3 py-2 text-sm bg-white hover:border-stone-400
                   focus:outline-none focus:ring-2 focus:ring-teal-500 min-w-[160px]"
      >
        <svg className="w-4 h-4 text-stone-400 flex-shrink-0" fill="none"
             stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <span className={value ? 'text-stone-800' : 'text-stone-400'}>
          {value || '請選擇日期'}
        </span>
      </button>
      {open && (
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
          className="z-20 bg-white border border-stone-200 rounded-xl shadow-lg p-3"
        >
          <Calendar
            onChange={handleSelect}
            value={dateObj}
            calendarType="gregory"
            locale="zh-TW"
            defaultActiveStartDate={dateObj ?? new Date()}
          />
        </div>
      )}
    </div>
  )
}
