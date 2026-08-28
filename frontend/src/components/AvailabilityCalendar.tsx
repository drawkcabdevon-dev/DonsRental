import { useState, useEffect, useRef, useCallback } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarDay {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isPast: boolean;
  isAvailable: boolean;
  isToday: boolean;
}

interface AvailabilityCalendarProps {
  onDateSelect: (date: string) => void;
  onRangeSelect?: (start: string, end: string) => void;
  selectedPickup?: string;
  selectedReturn?: string;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function AvailabilityCalendar({
  onDateSelect,
  onRangeSelect,
  selectedPickup,
  selectedReturn,
}: AvailabilityCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);
  const monthLabelRef = useRef<HTMLHeadingElement>(null);
  const touchStartX = useRef(0);
  const dragMoved = useRef(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Fetch availability for current month
  useEffect(() => {
    const fetchAvailability = async () => {
      setLoading(true);
      try {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const response = await fetch('/api/check-availability-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startDate: firstDay.toISOString().split('T')[0],
            endDate: lastDay.toISOString().split('T')[0],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setBookedDates(new Set(data.bookedDates || []));
        }
      } catch {
        // Silently fail — calendar still works
      } finally {
        setLoading(false);
      }
    };

    fetchAvailability();
  }, [currentMonth]);

  // GSAP month transition
  useGSAP(() => {
    if (!gridRef.current || !slideDirection) return;

    const startX = slideDirection === 'left' ? 30 : -30;
    gsap.fromTo(gridRef.current,
      { opacity: 0, x: startX },
      { opacity: 1, x: 0, duration: 0.3, ease: 'power2.out' }
    );
    if (monthLabelRef.current) {
      gsap.fromTo(monthLabelRef.current,
        { opacity: 0, y: -8 },
        { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out', delay: 0.05 }
      );
    }
  }, { dependencies: [slideDirection, currentMonth] });

  const getDaysInMonth = useCallback((): CalendarDay[] => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const days: CalendarDay[] = [];

    // Previous month padding
    const prevMonth = new Date(year, month, 0);
    for (let i = startPadding - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonth.getDate() - i);
      days.push({
        date: d,
        day: prevMonth.getDate() - i,
        isCurrentMonth: false,
        isPast: d < now,
        isAvailable: false,
        isToday: false,
      });
    }

    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      const dateStr = toDateStr(date);
      days.push({
        date,
        day: d,
        isCurrentMonth: true,
        isPast: date < now,
        isAvailable: !bookedDates.has(dateStr) && date >= now,
        isToday: date.getTime() === now.getTime(),
      });
    }

    // Next month padding
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(year, month + 1, d);
      days.push({
        date,
        day: d,
        isCurrentMonth: false,
        isPast: false,
        isAvailable: false,
        isToday: false,
      });
    }

    return days;
  }, [currentMonth, bookedDates]);

  const days = getDaysInMonth();
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const canSelect = (day: CalendarDay) => day.isCurrentMonth && !day.isPast && day.isAvailable;

  const commitRange = (start: string, end: string) => {
    if (!onRangeSelect) {
      onDateSelect(start);
      return;
    }
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const ordered = s <= e ? [start, end] : [end, start];
    onRangeSelect(ordered[0], ordered[1]);
  };

  const handleDayPointerDown = (day: CalendarDay) => {
    if (!canSelect(day)) return;
    dragMoved.current = false;
    setIsDragging(true);
    setRangeStart(toDateStr(day.date));
    setRangeEnd(null);
  };

  const handleDayPointerEnter = (day: CalendarDay) => {
    if (isDragging && rangeStart && canSelect(day)) {
      dragMoved.current = true;
      setRangeEnd(toDateStr(day.date));
    }
    if (!isDragging) {
      setHoverDate(toDateStr(day.date));
    }
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    setHoverDate(null);
    if (rangeStart && rangeEnd && rangeStart !== rangeEnd) {
      commitRange(rangeStart, rangeEnd);
    } else if (rangeStart && !dragMoved.current && !onRangeSelect) {
      onDateSelect(rangeStart);
    }
  };

  const handleClick = (day: CalendarDay) => {
    if (!canSelect(day) || dragMoved.current) return;

    if (onRangeSelect) {
      const dateStr = toDateStr(day.date);
      if (!rangeStart || (rangeStart && rangeEnd)) {
        // Start a new range
        setRangeStart(dateStr);
        setRangeEnd(null);
      } else if (rangeStart === dateStr) {
        // Same date again — single-day range
        commitRange(dateStr, dateStr);
        setRangeStart(null);
        setRangeEnd(null);
      } else {
        // Complete the range
        commitRange(rangeStart, dateStr);
        setRangeStart(null);
        setRangeEnd(null);
      }
    } else {
      onDateSelect(toDateStr(day.date));
    }
  };

  const clearSelection = () => {
    setRangeStart(null);
    setRangeEnd(null);
    setHoverDate(null);
  };

  // Effective range: props (pre-filled) or internal selection
  const effStart = rangeStart || selectedPickup || '';
  const effEnd = rangeEnd || selectedReturn || '';
  const previewEnd = isDragging ? rangeEnd : hoverDate && effStart && !effEnd ? hoverDate : null;
  const previewEndEff = previewEnd || effEnd;

  const isInRange = (day: CalendarDay): boolean => {
    if (!effStart || !effEnd || !day.isCurrentMonth) return false;
    const d = day.date.getTime();
    const s = new Date(effStart).getTime();
    const e = new Date(effEnd).getTime();
    return d > Math.min(s, e) && d < Math.max(s, e);
  };

  const isPreviewRange = (day: CalendarDay): boolean => {
    if (!effStart || !previewEndEff || !day.isCurrentMonth) return false;
    const d = day.date.getTime();
    const s = new Date(effStart).getTime();
    const e = new Date(previewEndEff).getTime();
    return d > Math.min(s, e) && d < Math.max(s, e);
  };

  const isSelected = (day: CalendarDay): boolean => {
    if (!day.isCurrentMonth) return false;
    const dateStr = toDateStr(day.date);
    return dateStr === effStart || dateStr === effEnd;
  };

  const isPickup = (day: CalendarDay): boolean => {
    if (!day.isCurrentMonth || !effStart) return false;
    return toDateStr(day.date) === effStart;
  };

  const isReturn = (day: CalendarDay): boolean => {
    if (!day.isCurrentMonth || !effEnd) return false;
    return toDateStr(day.date) === effEnd;
  };

  const goToPrevMonth = () => {
    setSlideDirection('right');
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setSlideDirection('left');
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  // Touch handling: swipe for month nav + drag for range selection
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !rangeStart) return;
    e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (el) {
      const dayBtn = el.closest('.calendar-day') as HTMLElement | null;
      if (dayBtn && dayBtn.dataset.date) {
        const day = days.find(d => toDateStr(d.date) === dayBtn.dataset.date);
        if (day && canSelect(day)) {
          dragMoved.current = true;
          setRangeEnd(toDateStr(day.date));
        }
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (isDragging) {
      handlePointerUp();
    } else if (Math.abs(diff) > 50) {
      if (diff > 0) goToNextMonth();
      else goToPrevMonth();
    }
  };

  const hasSelection = Boolean(effStart || effEnd || rangeStart);

  return (
    <div
      className="calendar"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onPointerUp={handlePointerUp}
      onMouseLeave={() => {
        if (isDragging) handlePointerUp();
        else setHoverDate(null);
      }}
      style={{ userSelect: 'none', touchAction: 'pan-y' }}
    >
      {/* Header with month nav + selection hint */}
      <div className="calendar-header">
        <button className="calendar-nav-btn" onClick={goToPrevMonth} aria-label="Previous month">
          <ChevronLeft size={20} />
        </button>
        <h3 className="calendar-month-label" ref={monthLabelRef}>
          {monthName}
          {effStart && (
            <span className="calendar-selection-hint">
              {effStart && effEnd ? (
                <>Selected: {effStart} → {effEnd}</>
              ) : (
                <>Pick return date — or drag</>
              )}
            </span>
          )}
        </h3>
        <button className="calendar-nav-btn" onClick={goToNextMonth} aria-label="Next month">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Day headers + legend */}
      <div className="calendar-day-headers">
        {DAY_LABELS.map((d) => (
          <div key={d} className="calendar-day-label">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="calendar-grid" ref={gridRef}>
        {days.map((day, i) => {
          const selected = isSelected(day);
          const inRange = isInRange(day);
          const inPreview = isPreviewRange(day);
          const pickup = isPickup(day);
          const ret = isReturn(day);

          const className = [
            'calendar-day',
            !day.isCurrentMonth && 'other-month',
            day.isPast && 'past',
            day.isToday && 'today',
            day.isAvailable && day.isCurrentMonth && !day.isPast && 'available',
            !day.isAvailable && day.isCurrentMonth && !day.isPast && 'booked',
            selected && 'selected',
            (inRange || inPreview) && 'in-range',
            pickup && 'range-start',
            ret && 'range-end',
          ].filter(Boolean).join(' ');

          return (
            <button
              key={i}
              className={className}
              data-date={toDateStr(day.date)}
              onPointerDown={(e) => {
                e.preventDefault();
                handleDayPointerDown(day);
              }}
              onPointerEnter={() => handleDayPointerEnter(day)}
              onClick={() => handleClick(day)}
              disabled={!canSelect(day)}
              aria-label={`${day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${day.isAvailable ? 'Available' : day.isPast ? 'Past' : 'Booked'}`}
            >
              <span className="calendar-day-number">{day.day}</span>
            </button>
          );
        })}
      </div>

      {/* Legend + actions */}
      <div className="calendar-legend">
        <span className="calendar-legend-item">
          <span className="calendar-legend-dot available" />
          Available
        </span>
        <span className="calendar-legend-item">
          <span className="calendar-legend-dot booked" />
          Booked
        </span>
        {hasSelection && (
          <span className="calendar-legend-item">
            <span className="calendar-legend-dot selected" />
            Selected
          </span>
        )}
        {onRangeSelect && !hasSelection && (
          <span className="calendar-legend-item calendar-legend-hint">Click + drag to select range</span>
        )}
        {hasSelection && (
          <button className="calendar-clear-btn" onClick={clearSelection}>
            Clear
          </button>
        )}
      </div>

      {loading && (
        <div className="calendar-loading">Checking availability...</div>
      )}
    </div>
  );
}
