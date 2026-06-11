import { motion } from 'framer-motion';

interface FunnelData {
  submitted: number;
  underReview: number;
  awarded: number;
  declined: number;
}

interface FlowFunnelProps {
  data: FunnelData;
}

export function FlowFunnel({ data }: FlowFunnelProps) {
  const total = data.submitted + data.underReview + data.awarded + data.declined;
  const maxValue = Math.max(data.submitted, data.underReview, data.awarded, data.declined, 1);

  const stages = [
    { label: 'Submitted', value: data.submitted, color: '#4a9eff', width: (data.submitted / maxValue) * 100 },
    { label: 'Under Review', value: data.underReview, color: '#ffa500', width: (data.underReview / maxValue) * 100 },
    { label: 'Awarded', value: data.awarded, color: '#28a745', width: (data.awarded / maxValue) * 100 },
    { label: 'Declined', value: data.declined, color: '#dc3545', width: (data.declined / maxValue) * 100 },
  ];

  const calculateConversionRate = (from: number, to: number) => {
    if (from === 0) return 0;
    return ((to / from) * 100).toFixed(1);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
    >
      {stages.map((stage, idx) => {
        const prevStage = idx > 0 ? stages[idx - 1] : null;
        const conversionRate = prevStage ? calculateConversionRate(prevStage.value, stage.value) : null;

        return (
          <motion.div
            key={stage.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: idx * 0.1 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#333' }}>{stage.label}</span>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: '#666' }}>
                  {stage.value.toLocaleString()} ({total > 0 ? ((stage.value / total) * 100).toFixed(1) : 0}%)
                </span>
                {conversionRate !== null && (
                  <span style={{ fontSize: '0.75rem', color: '#999' }}>→ {conversionRate}%</span>
                )}
              </div>
            </div>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${stage.width}%` }}
              transition={{ duration: 0.8, delay: idx * 0.1 }}
              style={{
                height: '40px',
                backgroundColor: stage.color,
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: '600',
                fontSize: '0.875rem',
              }}
            >
              {stage.value > 0 && stage.value.toLocaleString()}
            </motion.div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

