import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface TimeSeriesData {
  month: string;
  submissions: number;
  awards: number;
  awardedAmount: number;
}

interface TimeSeriesChartProps {
  data: TimeSeriesData[];
}

export function TimeSeriesChart({ data }: TimeSeriesChartProps) {
  const formatMonth = (month: string) => {
    // Format "2025-01" to "Jan 2025"
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
          formatter={(value: number, name: string) => {
            if (name === 'awardedAmount') {
              return formatCurrency(value);
            }
            return value;
          }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="submissions"
          stroke="#4a9eff"
          strokeWidth={2}
          dot={{ fill: '#4a9eff', r: 3 }}
          name="Submissions"
          animationDuration={800}
        />
        <Line
          type="monotone"
          dataKey="awards"
          stroke="#28a745"
          strokeWidth={2}
          dot={{ fill: '#28a745', r: 3 }}
          name="Awards"
          animationDuration={800}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

