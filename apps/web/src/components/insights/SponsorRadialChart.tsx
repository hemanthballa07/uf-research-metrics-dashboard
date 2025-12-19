import { RadialBarChart, RadialBar, ResponsiveContainer, Legend, Tooltip, Cell } from 'recharts';
import { motion } from 'framer-motion';

interface SponsorData {
  name: string;
  sponsorType: string | null;
  awardedAmount: number;
  count: number;
}

interface SponsorRadialChartProps {
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

export function SponsorRadialChart({ data }: SponsorRadialChartProps) {
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
  const maxValue = Math.max(...top8.map((item) => item.awardedAmount), 1);

  const chartData = top8.map((item, index) => ({
    name: item.name.length > 20 ? `${item.name.substring(0, 20)}...` : item.name,
    fullName: item.name,
    value: (item.awardedAmount / maxValue) * 100,
    amount: item.awardedAmount,
    count: item.count,
    fill: COLORS[index % COLORS.length],
  }));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
    >
      <ResponsiveContainer width="100%" height={400}>
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="20%"
          outerRadius="90%"
          barSize={20}
          data={chartData}
          startAngle={90}
          endAngle={-270}
        >
          <RadialBar
            minAngle={5}
            label={{ position: 'insideStart', fill: '#fff', fontSize: 12 }}
            background
            dataKey="value"
            animationDuration={1000}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </RadialBar>
          <Tooltip
            formatter={(value: number, name: string, props: any) => {
              if (name === 'value') {
                return [formatCurrency(props.payload.amount), 'Awarded Amount'];
              }
              return value;
            }}
            labelFormatter={(label) => label}
          />
          <Legend
            iconSize={12}
            layout="vertical"
            verticalAlign="middle"
            align="right"
            formatter={(value, entry: any) => `${value}: ${formatCurrency(entry.payload.amount)}`}
          />
        </RadialBarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

