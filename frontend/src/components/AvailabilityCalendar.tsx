import { useState, useEffect } from 'react';

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

export function AvailabilityCalendar({ onDateSelect, selectedPickup, selectedReturn }: AvailabilityCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

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
        // Silently fail — calendar still works, just won't show availability
      } finally {
        setLoading(false);
      }
    };

    fetchAvailability();
  }, [currentMonth]);

  const getDaysInMonth = (): CalendarDay[] => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();

    const days: CalendarDay[] = [];

    // Previous month padding
    const prevMonth = new Date(year, month, 0);
    for (let i = startPadding - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonth.getDate() - i);
      days.push({
        date: d,
        day: prevMonth.getDate() - i,
        isCurrentMonth: false,
        isPast: d < today,
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
        isPast: date < today,
        isAvailable: !bookedDates.has(dateStr) && date >= today,
        isToday: date.getTime() === today.getTime(),
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
  };

  const handleDateClick = (day: CalendarDay) => {
    if (!day.isCurrentMonth || day.isPast || !day.isAvailable) return;
    const dateStr = day.date.toISOString().split('T')[0];
    onDateSelect(dateStr);
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
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

  const days = getDaysInMonth();
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e0e0e0', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: '#1a1a1a', color: 'white', padding: 'var(--space-4) var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.25rem', padding: '4px 8px' }} aria-label="Previous month">
          ‹
        </button>
        <h3 style={{ margin: 0, fontWeight: 700, letterSpacing: '0.05em' }}>{monthName}</h3>
        <button onClick={nextMonth} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.25rem', padding: '4px 8px' }} aria-label="Next month">
          ›
        </button>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e0e0e0' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} style={{ padding: '8px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {days.map((day, i) => {
          const isSelectedDate = isSelected(day);
          const inRange = isInRange(day);

          return (
            <button
              key={i}
              onClick={() => handleDateClick(day)}
              disabled={!day.isCurrentMonth || day.isPast || !day.isAvailable}
              style={{
                padding: '10px 4px',
                textAlign: 'center',
                border: 'none',
                borderBottom: '1px solid #f0f0f0',
                background: isSelectedDate ? '#1a1a1a' : inRange ? '#f0f7ff' : 'white',
                color: !day.isCurrentMonth ? '#ccc' : day.isPast ? '#ccc' : !day.isAvailable && day.isCurrentMonth ? '#dc2626' : isSelectedDate ? 'white' : '#1a1a1a',
                cursor: day.isCurrentMonth && !day.isPast && day.isAvailable ? 'pointer' : 'default',
                fontWeight: day.isToday ? 700 : isSelectedDate ? 700 : 400,
                position: 'relative',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                if (day.isCurrentMonth && !day.isPast && day.isAvailable && !isSelectedDate) {
                  e.currentTarget.style.background = '#f5f5f5';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelectedDate && !inRange) {
                  e.currentTarget.style.background = 'white';
                }
              }}
              aria-label={`${day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${day.isAvailable ? 'Available' : day.isPast ? 'Past' : 'Booked'}`}
            >
              {day.day}
              {day.isAvailable && day.isCurrentMonth && !day.isPast && (
                <span style={{ display: 'block', width: '4px', height: '4px', borderRadius: '50%', background: '#059669', margin: '2px auto 0' }} />
              )}
              {!day.isAvailable && day.isCurrentMonth && !day.isPast && (
                <span style={{ display: 'block', width: '4px', height: '4px', borderRadius: '50%', background: '#dc2626', margin: '2px auto 0' }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid #e0e0e0', display: 'flex', gap: 'var(--space-6)', fontSize: '0.75rem', color: '#666' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669', display: 'inline-block' }} />
          Available
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
          Booked
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ccc', display: 'inline-block' }} />
          Past
        </span>
      </div>

      {loading && (
        <div style={{ padding: 'var(--space-2)', textAlign: 'center', fontSize: '0.75rem', color: '#999' }}>
          Checking availability...
        </div>
      )}
    </div>
  );
}
