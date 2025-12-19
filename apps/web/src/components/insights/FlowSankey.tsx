import { motion } from 'framer-motion';

interface FunnelData {
  submitted: number;
  underReview: number;
  awarded: number;
  declined: number;
}

interface FlowSankeyProps {
  data: FunnelData;
}

export function FlowSankey({ data }: FlowSankeyProps) {
  const total = data.submitted + data.underReview + data.awarded + data.declined;

  const stages = [
    {
      label: 'Submitted',
      value: data.submitted,
      color: '#4a9eff',
      next: data.underReview + data.awarded + data.declined,
    },
    {
      label: 'Under Review',
      value: data.underReview,
      color: '#ffa500',
      next: data.awarded + data.declined,
    },
    {
      label: 'Awarded',
      value: data.awarded,
      color: '#28a745',
      next: 0,
    },
    {
      label: 'Declined',
      value: data.declined,
      color: '#dc3545',
      next: 0,
    },
  ];

  const maxValue = Math.max(...stages.map((s) => s.value + s.next), 1);

  const calculateConversionRate = (from: number, to: number) => {
    if (from === 0) return 0;
    return ((to / from) * 100).toFixed(1);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.25rem 0' }}
    >
      {stages.map((stage, idx) => {
        const prevStage = idx > 0 ? stages[idx - 1] : null;
        const conversionRate = prevStage ? calculateConversionRate(prevStage.value, stage.value) : null;
        const widthPercent = ((stage.value + stage.next) / maxValue) * 100;
        const mainWidthPercent = stage.next > 0 ? (stage.value / (stage.value + stage.next)) * 100 : 100;

        return (
          <motion.div
            key={stage.label}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: idx * 0.15 }}
            style={{ position: 'relative' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#333' }}>{stage.label}</span>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#666', fontWeight: '500' }}>
                  {stage.value.toLocaleString()} ({total > 0 ? ((stage.value / total) * 100).toFixed(1) : 0}%)
                </span>
                {conversionRate !== null && (
                  <span style={{ fontSize: '0.75rem', color: '#999', fontStyle: 'italic' }}>
                    {conversionRate}% conversion
                  </span>
                )}
              </div>
            </div>

            <div style={{ position: 'relative', height: '38px', borderRadius: '6px', overflow: 'hidden', background: '#f0f0f0' }}>
              {stage.next > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${widthPercent}%` }}
                  transition={{ duration: 0.8, delay: idx * 0.15 }}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    height: '100%',
                    width: `${widthPercent}%`,
                    background: `linear-gradient(90deg, ${stage.color} 0%, ${stage.color}dd 100%)`,
                    borderRadius: '8px',
                  }}
                />
              )}
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${mainWidthPercent}%` }}
                transition={{ duration: 0.8, delay: idx * 0.15 + 0.2 }}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  height: '100%',
                  width: `${(widthPercent * mainWidthPercent) / 100}%`,
                  background: `linear-gradient(135deg, ${stage.color} 0%, ${stage.color}cc 50%, ${stage.color}99 100%)`,
                  borderRadius: '8px',
                  boxShadow: `0 4px 12px ${stage.color}40`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  zIndex: 2,
                }}
              >
                {stage.value > 0 && stage.value.toLocaleString()}
              </motion.div>

              {/* Flow arrow to next stage */}
              {idx < stages.length - 1 && stage.next > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: idx * 0.15 + 0.4 }}
                  style={{
                    position: 'absolute',
                    right: '-30px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 0,
                    height: 0,
                    borderLeft: `15px solid ${stage.color}`,
                    borderTop: '10px solid transparent',
                    borderBottom: '10px solid transparent',
                  }}
                />
              )}
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

