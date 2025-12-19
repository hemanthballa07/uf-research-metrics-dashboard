import { useState } from 'react';
import { motion } from 'framer-motion';

interface DailyActivity {
  date: string;
  submissions: number;
  awards: number;
  awardedAmount: number;
}

interface ActivityHeatmapProps {
  data: DailyActivity[];
  metric: 'submissions' | 'awards' | 'awardedAmount';
}

export function ActivityHeatmap({ data, metric }: ActivityHeatmapProps) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // Group data by week (last 52 weeks)
  const now = new Date();
  const weeksAgo = 52;
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - weeksAgo * 7);

  // Create a map of date -> value
  const dataMap = new Map<string, number>();
  data.forEach((item) => {
    const value = item[metric];
    dataMap.set(item.date, value);
  });

  // Generate grid: 52 weeks x 7 days
  const weeks: Array<Array<{ date: string; value: number }>> = [];
  for (let week = 0; week < weeksAgo; week++) {
    const weekData: Array<{ date: string; value: number }> = [];
    for (let day = 0; day < 7; day++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + week * 7 + day);
      const dateStr = date.toISOString().split('T')[0];
      const value = dataMap.get(dateStr) || 0;
      weekData.push({ date: dateStr, value });
    }
    weeks.push(weekData);
  }

  // Calculate max value for color intensity
  const maxValue = Math.max(...Array.from(dataMap.values()), 1);

  const getColor = (value: number) => {
    if (value === 0) return '#ebedf0';
    const intensity = Math.min(value / maxValue, 1);
    if (intensity < 0.25) return '#c6e48b';
    if (intensity < 0.5) return '#7bc96f';
    if (intensity < 0.75) return '#239a3b';
    return '#196127';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      style={{ position: 'relative' }}
    >
      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', maxWidth: '800px' }}>
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {week.map((day, dayIdx) => (
              <motion.div
                key={`${weekIdx}-${dayIdx}`}
                onMouseEnter={() => setHoveredDate(day.date)}
                onMouseLeave={() => setHoveredDate(null)}
                whileHover={{ scale: 1.2, zIndex: 10 }}
                style={{
                  width: '12px',
                  height: '12px',
                  backgroundColor: getColor(day.value),
                  borderRadius: '2px',
                  cursor: 'pointer',
                  position: 'relative',
                }}
                title={`${formatDate(day.date)}: ${day.value}`}
              />
            ))}
          </div>
        ))}
      </div>
      {hoveredDate && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            position: 'absolute',
            top: '-40px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#1a1a1a',
            color: '#fff',
            padding: '0.5rem 0.75rem',
            borderRadius: '4px',
            fontSize: '0.75rem',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 100,
          }}
        >
          {formatDate(hoveredDate)}: {dataMap.get(hoveredDate) || 0}
        </motion.div>
      )}
      <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#666' }}>
        <span>Less</span>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127'].map((color) => (
            <div key={color} style={{ width: '12px', height: '12px', backgroundColor: color, borderRadius: '2px' }} />
          ))}
        </div>
        <span>More</span>
      </div>
    </motion.div>
  );
}

