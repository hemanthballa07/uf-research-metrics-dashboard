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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="colorSubmitted" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4a9eff" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#4a9eff" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="colorUnderReview" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ffa500" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#ffa500" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="colorAwarded" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#28a745" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#28a745" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="colorDeclined" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#dc3545" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#dc3545" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonth}
            stroke="#666"
            style={{ fontSize: '0.75rem' }}
          />
          <YAxis stroke="#666" style={{ fontSize: '0.75rem' }} />
          <Tooltip
            labelFormatter={(label) => formatMonth(label)}
            formatter={(value: number) => value}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="Submitted"
            stackId="1"
            stroke="#4a9eff"
            fill="url(#colorSubmitted)"
            animationDuration={800}
          />
          <Area
            type="monotone"
            dataKey="Under Review"
            stackId="1"
            stroke="#ffa500"
            fill="url(#colorUnderReview)"
            animationDuration={800}
          />
          <Area
            type="monotone"
            dataKey="Awarded"
            stackId="1"
            stroke="#28a745"
            fill="url(#colorAwarded)"
            animationDuration={800}
          />
          <Area
            type="monotone"
            dataKey="Declined"
            stackId="1"
            stroke="#dc3545"
            fill="url(#colorDeclined)"
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

