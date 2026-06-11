import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface StatusData {
  status: string;
  count: number;
}

interface StatusDonutChartProps {
  data: StatusData[];
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#999',
  SUBMITTED: '#4a9eff',
  UNDER_REVIEW: '#ffa500',
  AWARDED: '#28a745',
  DECLINED: '#dc3545',
  WITHDRAWN: '#6c757d',
};

const formatStatusLabel = (status: string): string => {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export function StatusDonutChart({ data }: StatusDonutChartProps) {
  const chartData = data.map((item) => ({
    name: formatStatusLabel(item.status),
    value: item.count,
    color: STATUS_COLORS[item.status] || '#666',
  }));

  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          animationBegin={0}
          animationDuration={800}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [
            `${value} (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`,
            'Count',
          ]}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value) => value}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

