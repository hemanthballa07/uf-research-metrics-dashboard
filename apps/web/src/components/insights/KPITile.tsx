import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface KPITileProps {
  title: string;
  value: number | string;
  sparklineData?: number[];
  delay?: number;
}

export function KPITile({ title, value, sparklineData, delay = 0 }: KPITileProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const valueRef = useRef(0);

  useEffect(() => {
    const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, '')) || 0;
    valueRef.current = numValue;

    const duration = 1500;
    const steps = 60;
    const increment = numValue / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = Math.min(increment * step, numValue);
      setDisplayValue(Math.floor(current));

      if (step >= steps) {
        setDisplayValue(numValue);
        clearInterval(timer);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  const formatValue = (val: number | string) => {
    if (typeof val === 'string') return val;
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
    return val.toLocaleString();
  };

  const chartData = sparklineData?.map((val, idx) => ({ value: val, index: idx })) || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      style={{
        backgroundColor: '#fff',
        padding: '1.5rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        border: '1px solid #e0e0e0',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <div style={{ fontSize: '0.875rem', color: '#666', fontWeight: '500' }}>{title}</div>
      <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1a1a1a' }}>
        {typeof value === 'string' ? value : formatValue(displayValue)}
      </div>
      {sparklineData && sparklineData.length > 0 && (
        <div style={{ height: '40px', width: '100%', marginTop: '0.5rem' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke="#4a9eff"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}

