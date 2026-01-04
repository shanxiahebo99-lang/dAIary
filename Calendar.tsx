import React, { useState, useMemo } from 'react';
import { DiaryEntry } from './types';

interface CalendarProps {
  entries: DiaryEntry[];
  onDateClick: (date: string) => void;
  selectedDate: string | null;
}

const Calendar: React.FC<CalendarProps> = ({ entries, onDateClick, selectedDate }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Get entries by date for quick lookup
  const entriesByDate = useMemo(() => {
    const map = new Map<string, DiaryEntry>();
    entries.forEach(entry => {
      map.set(entry.date, entry);
    });
    return map;
  }, [entries]);

  // Get calendar days for current month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: Array<{ date: Date; isCurrentMonth: boolean; dateStr: string }> = [];

    // Previous month's trailing days
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - 1, prevMonthLastDay - i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      days.push({
        date,
        isCurrentMonth: false,
        dateStr: `${year}-${month}-${day}`,
      });
    }

    // Current month's days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      days.push({
        date,
        isCurrentMonth: true,
        dateStr: `${year}-${month}-${dayStr}`,
      });
    }

    // Next month's leading days to fill the grid
    const remainingDays = 42 - days.length; // 6 weeks * 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(currentYear, currentMonth + 1, day);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      days.push({
        date,
        isCurrentMonth: false,
        dateStr: `${year}-${month}-${dayStr}`,
      });
    }

    return days;
  }, [currentYear, currentMonth]);

  const formatMonthYear = (year: number, month: number) => {
    return new Date(year, month).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
    });
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const isToday = (dateStr: string) => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return dateStr === `${year}-${month}-${day}`;
  };

  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

  return (
    <div className="glass-card p-4 md:p-6">
      <div className="mb-3 md:mb-4 flex items-center justify-between gap-2">
        <button
          onClick={goToPreviousMonth}
          className="p-2 md:p-2 rounded-lg hover:bg-white hover:bg-opacity-50 transition min-w-[40px] min-h-[40px] flex items-center justify-center"
          aria-label="前の月"
        >
          ←
        </button>
        <h2 className="text-lg md:text-xl font-semibold text-gray-800 flex-1 text-center">
          {formatMonthYear(currentYear, currentMonth)}
        </h2>
        <button
          onClick={goToNextMonth}
          className="p-2 md:p-2 rounded-lg hover:bg-white hover:bg-opacity-50 transition min-w-[40px] min-h-[40px] flex items-center justify-center"
          aria-label="次の月"
        >
          →
        </button>
      </div>
      <div className="mb-2 text-center">
        <button
          onClick={goToToday}
          className="text-sm text-pink-600 hover:text-pink-700 font-medium py-2 px-4"
        >
          今日に戻る
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-xs md:text-sm font-medium text-gray-600 py-1 md:py-2"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 md:gap-2">
        {calendarDays.map((dayInfo, index) => {
          const hasEntry = entriesByDate.has(dayInfo.dateStr);
          const isSelected = selectedDate === dayInfo.dateStr;
          const isTodayDate = isToday(dayInfo.dateStr);

          return (
            <button
              key={index}
              onClick={() => onDateClick(dayInfo.dateStr)}
              className={`
                aspect-square rounded-xl p-2 text-sm transition-all
                ${!dayInfo.isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                ${isTodayDate ? 'ring-2 ring-pink-400 ring-offset-2' : ''}
                ${isSelected ? 'bg-gradient-to-br from-pink-200 to-blue-200 text-white font-semibold' : ''}
                ${hasEntry && !isSelected ? 'bg-pink-100 hover:bg-pink-200' : ''}
                ${!hasEntry && !isSelected && dayInfo.isCurrentMonth ? 'hover:bg-gray-100' : ''}
                flex items-center justify-center relative
              `}
            >
              <span>{dayInfo.date.getDate()}</span>
              {hasEntry && (
                <span className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-pink-400 rounded-full"></span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Calendar;

