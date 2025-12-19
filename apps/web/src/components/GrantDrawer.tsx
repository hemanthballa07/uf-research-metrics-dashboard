interface GrantDrawerProps {
  grant: {
    id: number;
    title: string;
    amount: number;
    status: string;
    submittedAt: string | null;
    awardedAt: string | null;
    sponsor?: { id: number; name: string; sponsorType: string };
    pi?: { id: number; name: string; email: string; departmentId: number };
    department?: { id: number; name: string };
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

export function GrantDrawer({ grant, isOpen, onClose }: GrantDrawerProps) {
  if (!isOpen || !grant) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: '#999',
      submitted: '#4a9eff',
      under_review: '#ffa500',
      awarded: '#28a745',
      declined: '#dc3545',
    };
    return colors[status] || '#666';
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
        }}
      />
      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '500px',
          maxWidth: '90vw',
          backgroundColor: '#fff',
          boxShadow: '-2px 0 8px rgba(0,0,0,0.2)',
          zIndex: 1001,
          overflowY: 'auto',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease-in-out',
        }}
      >
        <div style={{ padding: '2rem' }}>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '2rem',
              borderBottom: '1px solid #e0e0e0',
              paddingBottom: '1rem',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#1a1a1a' }}>
              Grant Details
            </h2>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: '#666',
                padding: '0',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Title */}
            <div>
              <label
                style={{
                  fontSize: '0.85rem',
                  color: '#666',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '0.5rem',
                  display: 'block',
                }}
              >
                Title
              </label>
              <p style={{ margin: 0, fontSize: '1.1rem', color: '#1a1a1a' }}>
                {grant.title}
              </p>
            </div>

            {/* Status */}
            <div>
              <label
                style={{
                  fontSize: '0.85rem',
                  color: '#666',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '0.5rem',
                  display: 'block',
                }}
              >
                Status
              </label>
              <span
                style={{
                  display: 'inline-block',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '4px',
                  backgroundColor: getStatusColor(grant.status) + '20',
                  color: getStatusColor(grant.status),
                  fontWeight: '600',
                  textTransform: 'capitalize',
                }}
              >
                {grant.status.replace('_', ' ')}
              </span>
            </div>

            {/* Amount */}
            <div>
              <label
                style={{
                  fontSize: '0.85rem',
                  color: '#666',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '0.5rem',
                  display: 'block',
                }}
              >
                Amount
              </label>
              <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: '600', color: '#1a1a1a' }}>
                {formatCurrency(grant.amount)}
              </p>
            </div>

            {/* Sponsor */}
            {grant.sponsor && (
              <div>
                <label
                  style={{
                    fontSize: '0.85rem',
                    color: '#666',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '0.5rem',
                    display: 'block',
                  }}
                >
                  Sponsor
                </label>
                <p style={{ margin: 0, color: '#1a1a1a' }}>{grant.sponsor.name}</p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: '#666' }}>
                  {grant.sponsor.sponsorType}
                </p>
              </div>
            )}

            {/* Principal Investigator */}
            {grant.pi && (
              <div>
                <label
                  style={{
                    fontSize: '0.85rem',
                    color: '#666',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '0.5rem',
                    display: 'block',
                  }}
                >
                  Principal Investigator
                </label>
                <p style={{ margin: 0, color: '#1a1a1a' }}>{grant.pi.name}</p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: '#666' }}>
                  {grant.pi.email}
                </p>
              </div>
            )}

            {/* Department */}
            {grant.department && (
              <div>
                <label
                  style={{
                    fontSize: '0.85rem',
                    color: '#666',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '0.5rem',
                    display: 'block',
                  }}
                >
                  Department
                </label>
                <p style={{ margin: 0, color: '#1a1a1a' }}>{grant.department.name}</p>
              </div>
            )}

            {/* Dates */}
            <div>
              <label
                style={{
                  fontSize: '0.85rem',
                  color: '#666',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '0.5rem',
                  display: 'block',
                }}
              >
                Dates
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div>
                  <span style={{ color: '#666', fontSize: '0.9rem' }}>Submitted: </span>
                  <span style={{ color: '#1a1a1a' }}>{formatDate(grant.submittedAt)}</span>
                </div>
                {grant.awardedAt && (
                  <div>
                    <span style={{ color: '#666', fontSize: '0.9rem' }}>Awarded: </span>
                    <span style={{ color: '#1a1a1a' }}>{formatDate(grant.awardedAt)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

