import React from 'react'

/**
 * Base Shimmer Skeleton Element
 */
export function Skeleton({ width, height, borderRadius = '4px', className = '', style = {} }) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{
        width: width || '100%',
        height: height || '16px',
        borderRadius,
        ...style,
      }}
      aria-hidden="true"
    />
  )
}

/**
 * Skeleton for Top 4 Color KPI Banner Cards (TOTAL STAFF, CHECK IN TODAY, CHECK OUT TODAY, DAYOFF TODAY)
 */
export function SkeletonBannerCards() {
  const cards = [
    { colorClass: 'magenta-skeleton', label: 'TOTAL STAFF' },
    { colorClass: 'cyan-skeleton', label: 'CHECK IN TODAY' },
    { colorClass: 'green-skeleton', label: 'CHECK OUT TODAY' },
    { colorClass: 'amber-skeleton', label: 'DAYOFF TODAY' },
  ]

  return (
    <section className="kpi-cards-row" aria-label="Loading KPIs...">
      {cards.map((c, i) => (
        <div key={i} className={`kpi-banner-card ${c.colorClass} skeleton-card-pulse`}>
          <div className="skeleton-icon-placeholder skeleton-shimmer-light"></div>
          <div className="kpi-banner-content" style={{ flex: 1 }}>
            <span className="kpi-banner-label">{c.label}</span>
            <div className="skeleton-banner-val skeleton-shimmer-light"></div>
          </div>
        </div>
      ))}
    </section>
  )
}

/**
 * Skeleton Table Loader with customizable rows and columns
 */
export function SkeletonTable({ rows = 5, columns = 5 }) {
  return (
    <div className="skeleton-table-wrapper" aria-label="Loading table data...">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="skeleton-table-row">
          {/* Column 1: Avatar + Name */}
          <div className="skeleton-table-col" style={{ width: '28%', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Skeleton width="32px" height="32px" borderRadius="50%" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <Skeleton width="70%" height="13px" />
              <Skeleton width="45%" height="10px" />
            </div>
          </div>

          {/* Column 2 */}
          <div className="skeleton-table-col" style={{ width: '20%' }}>
            <Skeleton width="60%" height="12px" />
          </div>

          {/* Column 3 */}
          <div className="skeleton-table-col" style={{ width: '20%' }}>
            <Skeleton width="80%" height="12px" />
          </div>

          {/* Column 4: Badge */}
          <div className="skeleton-table-col" style={{ width: '18%' }}>
            <Skeleton width="85px" height="20px" borderRadius="10px" />
          </div>

          {/* Column 5: Action */}
          <div className="skeleton-table-col" style={{ width: '14%', display: 'flex', justifyContent: 'flex-end' }}>
            <Skeleton width="65px" height="26px" borderRadius="4px" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Skeleton for the Calendar Month View
 */
export function SkeletonCalendar() {
  return (
    <div className="skeleton-calendar-grid" aria-label="Loading calendar...">
      {Array.from({ length: 35 }).map((_, i) => (
        <div key={i} className="skeleton-calendar-cell">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <Skeleton width="18px" height="14px" borderRadius="3px" />
            {i % 7 === 2 && <Skeleton width="32px" height="12px" borderRadius="6px" />}
          </div>
          {i % 4 === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <Skeleton width="100%" height="16px" borderRadius="4px" />
            </div>
          )}
          {i % 6 === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <Skeleton width="100%" height="16px" borderRadius="4px" />
              <Skeleton width="80%" height="16px" borderRadius="4px" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * Skeleton for Card Grid View (Scheduled Leaves / Staff Cards)
 */
export function SkeletonCardGrid({ count = 6 }) {
  return (
    <div className="skeleton-cards-grid" aria-label="Loading cards...">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-leave-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <Skeleton width="34px" height="34px" borderRadius="50%" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <Skeleton width="60%" height="14px" />
              <Skeleton width="40%" height="11px" />
            </div>
            <Skeleton width="50px" height="18px" borderRadius="9px" />
          </div>

          <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Skeleton width="100px" height="12px" />
              <Skeleton width="75px" height="16px" borderRadius="10px" />
            </div>
          </div>

          <Skeleton width="90%" height="28px" borderRadius="4px" style={{ marginBottom: '12px' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
            <Skeleton width="40px" height="10px" />
            <Skeleton width="90px" height="24px" borderRadius="4px" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Skeleton for Dashboard Widgets (Seating Capacity, Last Review, Punctuality)
 */
export function SkeletonWidget() {
  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Skeleton width="40%" height="14px" />
        <Skeleton width="25%" height="14px" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Skeleton width="50%" height="14px" />
        <Skeleton width="30%" height="14px" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width="35%" height="14px" />
        <Skeleton width="45%" height="8px" borderRadius="4px" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width="45%" height="14px" />
        <Skeleton width="35%" height="14px" />
      </div>
    </div>
  )
}
