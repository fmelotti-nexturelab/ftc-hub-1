import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

const MONTHS = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
]
const DAYS = ["Lu", "Ma", "Me", "Gi", "Ve", "Sa", "Do"]

export function toDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function StockCalendar({ value, onChange, highlightedDates }) {
  const todayRaw = new Date()
  const todayStr = toDateStr(todayRaw.getFullYear(), todayRaw.getMonth(), todayRaw.getDate())

  const [viewYear, setViewYear] = useState(() => value ? parseInt(value.slice(0, 4)) : todayRaw.getFullYear())
  const [viewMonth, setViewMonth] = useState(() => value ? parseInt(value.slice(5, 7)) - 1 : todayRaw.getMonth())

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDow = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  function prev() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function next() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-sm font-bold text-gray-800">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <div className="flex gap-1">
          <button onClick={prev} aria-label="Mese precedente" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition">
            <ChevronLeft size={15} aria-hidden="true" />
          </button>
          <button onClick={next} aria-label="Mese successivo" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition">
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[11px] font-semibold text-gray-400 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const str = toDateStr(viewYear, viewMonth, day)
          const isSelected = value === str
          const isToday = todayStr === str
          const isHighlighted = highlightedDates?.has(str)
          return (
            <button
              key={i}
              onClick={() => onChange(str)}
              className={`relative w-full aspect-square flex items-center justify-center text-sm rounded-lg transition font-medium
                ${isSelected
                  ? "bg-[#1e3a5f] text-white shadow-sm"
                  : isToday
                  ? "ring-2 ring-[#2563eb] text-[#2563eb] hover:bg-blue-50"
                  : isHighlighted
                  ? "text-gray-800 hover:bg-amber-50"
                  : "text-gray-700 hover:bg-gray-100"
                }`}
            >
              {day}
              {isHighlighted && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400" />
              )}
            </button>
          )
        })}
      </div>

      <div className="flex justify-end mt-3 pt-3 border-t border-gray-100">
        <button
          onClick={() => {
            onChange(todayStr)
            setViewYear(todayRaw.getFullYear())
            setViewMonth(todayRaw.getMonth())
          }}
          className="text-xs font-semibold text-[#2563eb] hover:text-[#1e3a5f] transition"
        >
          Oggi
        </button>
      </div>
    </div>
  )
}
