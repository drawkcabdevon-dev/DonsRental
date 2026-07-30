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
  selectedPickup?: string;
  selectedReturn?: string;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function AvailabilityCalendar({ onDateSelect, selectedPickup, selectedReturn }: AvailabilityCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const monthLabelRef = useRef<HTMLHeadingElement>(null);
  const touchStartX = useRef(0);

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
      const dateStr = date.toISOString().split('T')[0];
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

  const handleDateClick = (day: CalendarDay) => {
    if (!day.isCurrentMonth || day.isPast || !day.isAvailable) return;
    const dateStr = day.date.toISOString().split('T')[0];
    onDateSelect(dateStr);
  };

  const goToPrevMonth = () => {
    setSlideDirection('right');
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setSlideDirection('left');
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const isInRange = (day: CalendarDay): boolean => {
    if (!selectedPickup || !selectedReturn || !day.isCurrentMonth) return false;
    const d = day.date.getTime();
    return d > new Date(selectedPickup).getTime() && d < new Date(selectedReturn).getTime();
  };

  const isSelected = (day: CalendarDay): boolean => {
    if (!day.isCurrentMonth) return false;
    const dateStr = day.date.toISOString().split('T')[0];
    return dateStr === selectedPickup || dateStr === selectedReturn;
  };

  const isPickup = (day: CalendarDay): boolean => {
    if (!day.isCurrentMonth || !selectedPickup) return false;
    return day.date.toISOString().split('T')[0] === selectedPickup;
  };

  const isReturn = (day: CalendarDay): boolean => {
    if (!day.isCurrentMonth || !selectedReturn) return false;
    return day.date.toISOString().split('T')[0] === selectedReturn;
  };

  // Touch swipe for month navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goToNextMonth();
      else goToPrevMonth();
    }
  };

  const days = getDaysInMonth();
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="calendar" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Header with month nav + legend */}
      <div className="calendar-header">
        <button className="calendar-nav-btn" onClick={goToPrevMonth} aria-label="Previous month">
          <ChevronLeft size={20} />
        </button>
        <h3 className="calendar-month-label" ref={monthLabelRef}>{monthName}</h3>
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
            inRange && 'in-range',
            pickup && 'range-start',
            ret && 'range-end',
          ].filter(Boolean).join(' ');

          return (
            <button
              key={i}
              className={className}
              onClick={() => handleDateClick(day)}
              disabled={!day.isCurrentMonth || day.isPast || !day.isAvailable}
              aria-label={`${day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${day.isAvailable ? 'Available' : day.isPast ? 'Past' : 'Booked'}`}
            >
              <span className="calendar-day-number">{day.day}</span>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="calendar-legend">
        <span className="calendar-legend-item">
          <span className="calendar-legend-dot available" />
          Available
        </span>
        <span className="calendar-legend-item">
          <span className="calendar-legend-dot booked" />
          Booked
        </span>
        <span className="calendar-legend-item">
          <span className="calendar-legend-dot past" />
          Past
        </span>
      </div>

      {loading && (
        <div className="calendar-loading">Checking availability...</div>
      )}
    </div>
  );
}
