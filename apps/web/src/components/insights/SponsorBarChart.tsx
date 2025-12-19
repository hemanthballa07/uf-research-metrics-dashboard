import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion } from 'framer-motion';

interface SponsorData {
  name: string;
  sponsorType: string | null;
  awardedAmount: number;
  count: number;
}

interface SponsorBarChartProps {
  data: SponsorData[];
}

const COLORS = [
  '#4a9eff',
  '#28a745',
  '#ffa500',
  '#dc3545',
  '#6f42c1',
  '#20c997',
  '#fd7e14',
  '#e83e8c',
];

export function SponsorBarChart({ data }: SponsorBarChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Take top 8
  const top8 = data.slice(0, 8);
  const chartData = top8.map((item, index) => ({
    name: item.name.length > 25 ? `${item.name.substring(0, 25)}...` : item.name,
    fullName: item.name,
    amount: item.awardedAmount,
    count: item.count,
    fill: COLORS[index % COLORS.length],
  }));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis type="number" stroke="#666" style={{ fontSize: '0.7rem' }} tick={{ fill: '#666' }} />
          <YAxis
            type="category"
            dataKey="name"
            stroke="#666"
            style={{ fontSize: '0.7rem' }}
            tick={{ fill: '#666' }}
            width={95}
          />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            labelFormatter={(label) => chartData.find((d) => d.name === label)?.fullName || label}
            contentStyle={{ fontSize: '0.75rem', padding: '0.5rem' }}
          />
          <Bar dataKey="amount" radius={[0, 4, 4, 0]} animationDuration={800}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
