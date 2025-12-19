import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

interface DepartmentData {
  departmentId: number;
  name: string;
  awardedAmount: number;
  awards: number;
  submissions: number;
}

interface DepartmentComparisonProps {
  data: DepartmentData[];
  onDepartmentClick?: (departmentId: number) => void;
  selectedDepartment?: number | null;
  facultyData?: Array<{ name: string; amount: number }>;
  sponsorData?: Array<{ name: string; amount: number }>;
}

export function DepartmentComparison({
  data,
  onDepartmentClick,
  selectedDepartment,
  facultyData,
  sponsorData,
}: DepartmentComparisonProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const chartData = data.map((dept) => ({
    name: dept.name.length > 15 ? `${dept.name.substring(0, 15)}...` : dept.name,
    fullName: dept.name,
    amount: dept.awardedAmount,
    departmentId: dept.departmentId,
  }));

  return (
    <div style={{ display: 'flex', gap: '1.5rem' }}>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        style={{ flex: 1 }}
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
              formatter={(value: number) => formatCurrency(value)}
              labelFormatter={(label, payload) => {
                const item = payload?.[0]?.payload;
                return item?.fullName || label;
              }}
            />
            <Bar
              dataKey="amount"
              fill="#007bff"
              onClick={(data: { departmentId: number }) => {
                onDepartmentClick?.(data.departmentId);
              }}
              style={{ cursor: onDepartmentClick ? 'pointer' : 'default' }}
              animationDuration={800}
            />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      <AnimatePresence>
        {selectedDepartment && (facultyData || sponsorData) && (
          <motion.div
            initial={{ opacity: 0, x: 20, width: 0 }}
            animate={{ opacity: 1, x: 0, width: '300px' }}
            exit={{ opacity: 0, x: 20, width: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              backgroundColor: '#fff',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              border: '1px solid #e0e0e0',
              minWidth: '300px',
            }}
          >
            <h4 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem', fontWeight: '600' }}>
              {data.find((d) => d.departmentId === selectedDepartment)?.name}
            </h4>
            {facultyData && facultyData.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h5 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#666' }}>
                  Top Faculty
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {facultyData.slice(0, 5).map((faculty, idx) => (
                    <div key={idx} style={{ fontSize: '0.875rem' }}>
                      <div style={{ fontWeight: '500' }}>{faculty.name}</div>
                      <div style={{ color: '#666', fontSize: '0.75rem' }}>{formatCurrency(faculty.amount)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {sponsorData && sponsorData.length > 0 && (
              <div>
                <h5 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#666' }}>
                  Top Sponsors
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {sponsorData.slice(0, 5).map((sponsor, idx) => (
                    <div key={idx} style={{ fontSize: '0.875rem' }}>
                      <div style={{ fontWeight: '500' }}>{sponsor.name}</div>
                      <div style={{ color: '#666', fontSize: '0.75rem' }}>{formatCurrency(sponsor.amount)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

