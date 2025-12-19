import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

interface StackedAreaChartProps {
  data: Array<{
    month: string;
    submitted: number;
    under_review: number;
    awarded: number;
    declined: number;
  }>;
}

export function StackedAreaChart({ data }: StackedAreaChartProps) {
  const formatMonth = (month: string) => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const chartData = data.map((item) => ({
    month: item.month,
    'Submitted': item.submitted,
    'Under Review': item.under_review,
    'Awarded': item.awarded,
    'Declined': item.declined,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
    >
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={chartData} margin={{ top: 8, right: 20, left: 8, bottom: 8 }}>
          <defs>
            <linearGradient id="colorSubmitted" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4a9eff" stopOpacity={1} />
              <stop offset="50%" stopColor="#4a9eff" stopOpacity={0.7} />
              <stop offset="100%" stopColor="#4a9eff" stopOpacity={0.15} />
            </linearGradient>
            <linearGradient id="colorUnderReview" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffa500" stopOpacity={1} />
              <stop offset="50%" stopColor="#ffa500" stopOpacity={0.7} />
              <stop offset="100%" stopColor="#ffa500" stopOpacity={0.15} />
            </linearGradient>
            <linearGradient id="colorAwarded" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#28a745" stopOpacity={1} />
              <stop offset="50%" stopColor="#28a745" stopOpacity={0.7} />
              <stop offset="100%" stopColor="#28a745" stopOpacity={0.15} />
            </linearGradient>
            <linearGradient id="colorDeclined" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#dc3545" stopOpacity={1} />
              <stop offset="50%" stopColor="#dc3545" stopOpacity={0.7} />
              <stop offset="100%" stopColor="#dc3545" stopOpacity={0.15} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonth}
            stroke="#666"
            style={{ fontSize: '0.7rem' }}
            tick={{ fill: '#666' }}
          />
          <YAxis stroke="#666" style={{ fontSize: '0.7rem' }} tick={{ fill: '#666' }} />
          <Tooltip
            labelFormatter={(label) => formatMonth(label)}
            formatter={(value: number) => value}
            contentStyle={{ fontSize: '0.75rem', padding: '0.5rem' }}
          />
          <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '0.5rem' }} />
          <Area
            type="monotone"
            dataKey="Submitted"
            stackId="1"
            stroke="#4a9eff"
            strokeWidth={2}
            fill="url(#colorSubmitted)"
            animationDuration={1000}
            animationBegin={0}
          />
          <Area
            type="monotone"
            dataKey="Under Review"
            stackId="1"
            stroke="#ffa500"
            strokeWidth={2}
            fill="url(#colorUnderReview)"
            animationDuration={1000}
            animationBegin={100}
          />
          <Area
            type="monotone"
            dataKey="Awarded"
            stackId="1"
            stroke="#28a745"
            strokeWidth={2}
            fill="url(#colorAwarded)"
            animationDuration={1000}
            animationBegin={200}
          />
          <Area
            type="monotone"
            dataKey="Declined"
            stackId="1"
            stroke="#dc3545"
            strokeWidth={2}
            fill="url(#colorDeclined)"
            animationDuration={1000}
            animationBegin={300}
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

