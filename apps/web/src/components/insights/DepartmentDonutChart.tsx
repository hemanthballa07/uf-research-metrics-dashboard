import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { motion } from 'framer-motion';

interface DepartmentData {
  departmentId: number;
  name: string;
  awardedAmount: number;
  awards: number;
  submissions: number;
}

interface DepartmentDonutChartProps {
  data: DepartmentData[];
  onDepartmentClick?: (departmentId: number) => void;
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

export function DepartmentDonutChart({ data, onDepartmentClick }: DepartmentDonutChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const chartData = data
    .filter((dept) => dept.awardedAmount > 0)
    .map((dept) => ({
      name: dept.name,
      value: dept.awardedAmount,
      departmentId: dept.departmentId,
      awards: dept.awards,
    }))
    .slice(0, 8); // Top 8

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
            outerRadius={90}
            innerRadius={50}
            fill="#8884d8"
            dataKey="value"
            animationDuration={800}
            onClick={(data: { departmentId: number }) => {
              onDepartmentClick?.(data.departmentId);
            }}
            style={{ cursor: onDepartmentClick ? 'pointer' : 'default' }}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [
              formatCurrency(value),
              `Awarded Amount (${((value / total) * 100).toFixed(1)}%)`,
            ]}
            contentStyle={{ fontSize: '0.75rem', padding: '0.5rem' }}
          />
          <Legend
            verticalAlign="bottom"
            height={32}
            wrapperStyle={{ fontSize: '0.75rem' }}
            formatter={(value) => value}
          />
        </PieChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

