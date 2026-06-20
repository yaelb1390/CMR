'use client';

import React, { useState, useEffect } from 'react';
import { useToast } from '@/context/ToastContext';

export default function DashboardPage() {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/dashboard');
      if (!res.ok) {
        throw new Error('Error al obtener datos del servidor');
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      setError('No se pudo conectar a la base de datos. Verifique la configuración.');
      showToast('No se pudo conectar a la base de datos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP',
      minimumFractionDigits: 2
    }).format(value).replace('DOP', 'RD$');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <h1 className="shimmer" style={{ width: '200px', height: '36px', marginBottom: '8px' }}></h1>
          <p className="shimmer" style={{ width: '300px', height: '16px' }}></p>
        </div>
        <div className="metrics-grid">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="card shimmer shimmer-card"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card empty-state" style={{ borderTop: '4px solid var(--danger)' }}>
        <div className="empty-state-icon">⚠️</div>
        <div className="empty-state-title">Error de Conexión</div>
        <div className="empty-state-desc">{error}</div>
        <button className="btn btn-primary" onClick={fetchDashboardData}>Reintentar Conexión</button>
      </div>
    );
  }

  const { metrics, alertas } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>Resumen General Financiero</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Métricas clave del negocio y estado de cartera en tiempo real
        </p>
      </div>

      {/* Primary Metrics Grid */}
      <h3 style={{ fontSize: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Cartera y Capital</h3>
      <section className="metrics-grid">
        <div className="card metric-card">
          <div className="metric-icon" style={{ color: 'var(--primary)' }}>
            <svg viewBox="0 0 24 24"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
          </div>
          <span className="metric-title">Capital Prestado</span>
          <span className="metric-value">{formatCurrency(metrics.capitalPrestado)}</span>
        </div>
        <div className="card metric-card metric-card-activos">
          <div className="metric-icon" style={{ color: 'var(--secondary)' }}>
            <svg viewBox="0 0 24 24"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <span className="metric-title">Capital Recuperado</span>
          <span className="metric-value">{formatCurrency(metrics.capitalRecuperado)}</span>
        </div>
        <div className="card metric-card metric-card-cartera">
          <div className="metric-icon" style={{ color: 'var(--info)' }}>
            <svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
          </div>
          <span className="metric-title">Capital Pendiente</span>
          <span className="metric-value">{formatCurrency(metrics.capitalPendiente)}</span>
        </div>
        <div className="card metric-card metric-card-vencimientos-hoy">
          <div className="metric-icon" style={{ color: 'var(--danger)', backgroundColor: 'var(--danger-light)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            <svg viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>
          <span className="metric-title">Monto Total en Mora</span>
          <span className="metric-value" style={{ color: 'var(--danger)' }}>{formatCurrency(metrics.montoTotalMora)}</span>
        </div>
      </section>

      {/* Secondary Metrics Grid */}
      <h3 style={{ fontSize: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginTop: '16px' }}>Clientes y Préstamos</h3>
      <section className="metrics-grid">
        <div className="card metric-card metric-card-cartera">
          <div className="metric-icon" style={{ color: 'var(--primary)' }}>
            <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <span className="metric-title">Clientes Activos</span>
          <span className="metric-value">{metrics.clientesActivos}</span>
        </div>
        <div className="card metric-card metric-card-total-clientes">
          <div className="metric-icon" style={{ color: 'var(--info)' }}>
            <svg viewBox="0 0 24 24"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>
          </div>
          <span className="metric-title">Clientes Históricos</span>
          <span className="metric-value">{metrics.clientesHistoricos}</span>
        </div>
        <div className="card metric-card metric-card-activos">
          <div className="metric-icon" style={{ color: 'var(--secondary)' }}>
            <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </div>
          <span className="metric-title">Clientes Excelentes</span>
          <span className="metric-value" style={{ color: 'var(--secondary)' }}>{metrics.clientesExcelentes}</span>
        </div>
        <div className="card metric-card metric-card-atrasados">
          <div className="metric-icon" style={{ color: 'var(--warning)', backgroundColor: 'var(--warning-light)', borderColor: 'rgba(245, 158, 11, 0.2)' }}>
            <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="12"/><line x1="19" x2="19.01" y1="16" y2="16"/></svg>
          </div>
          <span className="metric-title">Clientes Morosos</span>
          <span className="metric-value" style={{ color: 'var(--warning)' }}>{metrics.clientesMorosos}</span>
        </div>

        <div className="card metric-card metric-card-activos">
          <div className="metric-icon" style={{ color: 'var(--secondary)' }}>
            <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <span className="metric-title">Préstamos Activos</span>
          <span className="metric-value">{metrics.prestamosActivos}</span>
        </div>
        <div className="card metric-card metric-card-total-clientes">
          <div className="metric-icon" style={{ color: 'var(--info)' }}>
            <svg viewBox="0 0 24 24"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>
          </div>
          <span className="metric-title">Préstamos Liquidados</span>
          <span className="metric-value">{metrics.prestamosLiquidados}</span>
        </div>
        <div className="card metric-card metric-card-vencimientos-hoy">
          <div className="metric-icon" style={{ color: 'var(--danger)', backgroundColor: 'var(--danger-light)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <span className="metric-title">Préstamos en Mora</span>
          <span className="metric-value" style={{ color: 'var(--danger)' }}>{metrics.prestamosEnMora}</span>
        </div>
      </section>

      {/* Alertas */}
      <div className="dashboard-sections-grid">
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Alertas Críticas de Mora (Top 20)</h2>
            <span className="badge badge-atrasado">{alertas.length} préstamos requieren atención</span>
          </div>

          <div className="table-container" style={{ flex: 1, borderBottomLeftRadius: 'var(--radius-md)', borderBottomRightRadius: 'var(--radius-md)' }}>
            {alertas.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Cédula</th>
                    <th># Préstamo</th>
                    <th>Balance Pendiente</th>
                    <th style={{ textAlign: 'center' }}>Días Atraso</th>
                  </tr>
                </thead>
                <tbody>
                  {alertas.map((alerta) => (
                    <tr key={alerta.numero_prestamo}>
                      <td style={{ fontWeight: 600 }}>{alerta.nombre_cliente}</td>
                      <td>{alerta.cedula}</td>
                      <td>
                        <code style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '700' }}>
                          {alerta.numero_prestamo}
                        </code>
                      </td>
                      <td style={{ fontWeight: '700' }}>
                        {formatCurrency(alerta.balance_pendiente)}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: alerta.dias_atraso > 30 ? 'var(--danger)' : 'var(--warning)' }}>
                        {alerta.dias_atraso} días
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <span className="empty-state-icon" style={{ color: 'var(--secondary)' }}>🎉</span>
                <div className="empty-state-title">Cartera Sana</div>
                <div className="empty-state-desc">No hay préstamos con días de atraso registrados.</div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
