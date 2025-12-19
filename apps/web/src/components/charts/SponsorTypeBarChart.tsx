import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SponsorTypeData {
  sponsorType: string;
  awardedAmount: number;
  count: number;
}

interface SponsorTypeBarChartProps {
  data: SponsorTypeData[];
}

export function SponsorTypeBarChart({ data }: SponsorTypeBarChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const chartData = data.map((item) => ({
    name: item.sponsorType,
    amount: item.awardedAmount,
    count: item.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
  );
}

