import { Treemap, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { motion } from 'framer-motion';

interface SponsorData {
  name: string;
  sponsorType: string | null;
  awardedAmount: number;
  count: number;
}

interface SponsorTreemapProps {
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
  '#17a2b8',
  '#ffc107',
];

const CustomizedContent = (props: any) => {
  const { x, y, width, height, index, payload } = props;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (!payload || width < 5 || height < 5) {
    return null;
  }

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: COLORS[index % COLORS.length],
          stroke: '#fff',
          strokeWidth: 2,
          cursor: 'pointer',
          opacity: 0.9,
        }}
      />
      {width > 80 && height > 40 && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2 - 10}
            textAnchor="middle"
            fill="#fff"
            fontSize={Math.min(14, width / 10)}
            fontWeight="600"
            style={{ pointerEvents: 'none' }}
          >
            {payload.name}
          </text>
          <text
            x={x + width / 2}
            y={y + height / 2 + 10}
            textAnchor="middle"
            fill="#fff"
            fontSize={Math.min(12, width / 12)}
            style={{ pointerEvents: 'none', opacity: 0.95 }}
          >
            {formatCurrency(payload.value)}
          </text>
        </>
      )}
    </g>
  );
};

export function SponsorTreemap({ data }: SponsorTreemapProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Take top 10, group rest as "Other"
  const top10 = data.slice(0, 10);
  const other = data.slice(10);
  const otherAmount = other.reduce((sum, item) => sum + item.awardedAmount, 0);
  const otherCount = other.reduce((sum, item) => sum + item.count, 0);

  const chartData = [
    ...top10.map((item) => ({
      name: item.name.length > 20 ? `${item.name.substring(0, 20)}...` : item.name,
      fullName: item.name,
      value: item.awardedAmount,
      count: item.count,
      sponsorType: item.sponsorType,
    })),
    ...(otherAmount > 0
      ? [
          {
            name: `Other (${other.length})`,
            fullName: `Other (${other.length} sponsors)`,
            value: otherAmount,
            count: otherCount,
            sponsorType: null,
          },
        ]
      : []),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
    >
      <ResponsiveContainer width="100%" height={400}>
        <Treemap
          data={chartData}
          dataKey="value"
          stroke="#fff"
          fill="#8884d8"
          animationDuration={1000}
        >
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[index % COLORS.length]}
            />
          ))}
        </Treemap>
      </ResponsiveContainer>
    </motion.div>
  );
}

