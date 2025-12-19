import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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

export function SponsorBarChart({ data }: SponsorBarChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Take top 8, group rest as "Other"
  const top8 = data.slice(0, 8);
  const other = data.slice(8);
  const otherAmount = other.reduce((sum, item) => sum + item.awardedAmount, 0);
  const otherCount = other.reduce((sum, item) => sum + item.count, 0);

  const chartData = [
    ...top8.map((item) => ({
      name: item.name.length > 20 ? `${item.name.substring(0, 20)}...` : item.name,
      amount: item.awardedAmount,
      count: item.count,
    })),
    ...(otherAmount > 0
      ? [
          {
            name: `Other (${other.length})`,
            amount: otherAmount,
            count: otherCount,
          },
        ]
      : []),
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="name"
            stroke="#666"
            style={{ fontSize: '0.75rem' }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            stroke="#666"
            style={{ fontSize: '0.75rem' }}
            tickFormatter={(value) => formatCurrency(value)}
          />
          <Tooltip
            formatter={(value: number, name: string) => {
              if (name === 'amount') {
                return formatCurrency(value);
              }
              return value;
            }}
          />
          <Legend />
          <Bar
            dataKey="amount"
            fill="#007bff"
            name="Awarded Amount"
            animationDuration={800}
          />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

