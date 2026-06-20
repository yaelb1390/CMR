'use client';

import React, { useState, useEffect } from 'react';
import { useToast } from '@/context/ToastContext';
import * as XLSX from 'xlsx';

export default function ReportesPage() {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('mora'); // 'mora', 'pagos', 'vencimientos'

  const fetchReportes = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/reportes');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        showToast('Error al obtener los datos de reportes.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error al conectar con el servidor.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportes();
  }, []);

  const formatCurrency = (value) => {
    if (value === undefined || value === null) return 'RD$ 0.00';
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP',
      minimumFractionDigits: 2
    }).format(value).replace('DOP', 'RD$');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() + userTimezoneOffset);
    const day = String(localDate.getDate()).padStart(2, '0');
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const year = localDate.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Excel exports using SheetJS
  const exportMoraToExcel = () => {
    if (!data || data.lists.mora.length === 0) {
      showToast('No hay datos de mora para exportar.', 'warning');
      return;
    }
    const headers = ['Cédula', 'Nombre Cliente', '# Préstamo', 'Balance Pendiente', 'Cuota Mensual', 'Días Atraso', 'Estado'];
    const rows = data.lists.mora.map(r => [
      r.cedula,
      r.nombre_cliente,
      r.numero_prestamo,
      formatCurrency(r.balance_pendiente),
      formatCurrency(r.cuota_mensual),
      r.dias_atraso,
      r.estado.toUpperCase()
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cartera en Riesgo");
    XLSX.writeFile(wb, `reporte-mora-${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Reporte de mora exportado a Excel.', 'success');
  };

  const exportPagosToExcel = () => {
    if (!data || data.lists.pagos.length === 0) {
      showToast('No hay datos de pagos para exportar.', 'warning');
      return;
    }
    const headers = ['ID Pago', '# Préstamo', 'Cédula', 'Cliente', 'Monto Pagado', 'Método', 'Fecha Pago', 'Registrado Por'];
    const rows = data.lists.pagos.map(r => [
      r.id,
      r.numero_prestamo,
      r.cedula,
      r.nombre_cliente || 'N/A',
      formatCurrency(r.monto_pagado),
      r.metodo_pago.toUpperCase(),
      formatDate(r.fecha_pago),
      r.registrado_por
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cobros Realizados");
    XLSX.writeFile(wb, `reporte-cobros-${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Reporte de cobros exportado a Excel.', 'success');
  };

  const exportVencimientosToExcel = () => {
    if (!data || data.lists.vencimientos.length === 0) {
      showToast('No hay datos de vencimientos para exportar.', 'warning');
      return;
    }
    const headers = ['Cédula', 'Nombre Cliente', '# Préstamo', 'Cuota Pendiente', 'Fecha Próximo Pago', 'Estado'];
    const rows = data.lists.vencimientos.map(r => [
      r.cedula,
      r.nombre_cliente,
      r.numero_prestamo,
      formatCurrency(r.cuota_mensual),
      formatDate(r.fecha_proximo_pago),
      r.estado.toUpperCase()
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vencimientos");
    XLSX.writeFile(wb, `reporte-vencimientos-${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Reporte de vencimientos exportado a Excel.', 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <h3>Cargando Reportes Consolidados...</h3>
      </div>
    );
  }

  const { carteraRiesgo, cobros } = data.metrics;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Print styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          .sidebar, .header, .no-print, .tabs-container, .export-btn {
            display: none !important;
          }
          .main-wrapper {
            margin-left: 0 !important;
            padding: 0 !important;
          }
          .card {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
          .content-area {
            padding: 0 !important;
          }
        }
      `}} />

      {/* Title & Printable action */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Reportes Gerenciales</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Consolidado de mora, cobros del periodo y próximos vencimientos de cartera.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handlePrint}>
          🖨️ Imprimir Reporte (PDF)
        </button>
      </div>

      {/* Printable Title Block */}
      <div className="only-print" style={{ display: 'none', textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', textTransform: 'uppercase', color: 'var(--primary)' }}>Préstamos BM - Reporte Gerencial</h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Generado el: {new Date().toLocaleDateString('es-DO')}</p>
      </div>

      {/* Metrics overview */}
      <section className="metrics-grid">
        <div className="card metric-card metric-card-atrasados" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="metric-icon" style={{ color: 'var(--danger)', backgroundColor: 'var(--danger-light)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            <svg viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>
          <span className="metric-title">Cartera Total en Riesgo</span>
          <span className="metric-value" style={{ color: 'var(--danger)' }}>
            {formatCurrency(carteraRiesgo.totalMoraMonto)}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {carteraRiesgo.totalMoraCant} préstamos en mora
          </span>
        </div>
        
        <div className="card metric-card metric-card-activos" style={{ borderLeft: '4px solid var(--secondary)' }}>
          <div className="metric-icon" style={{ color: 'var(--secondary)' }}>
            <svg viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="m9 16 2 2 4-4"/></svg>
          </div>
          <span className="metric-title">Cobros del Día</span>
          <span className="metric-value" style={{ color: 'var(--secondary)' }}>
            {formatCurrency(cobros.hoy)}
          </span>
        </div>

        <div className="card metric-card metric-card-total-clientes" style={{ borderLeft: '4px solid var(--info)' }}>
          <div className="metric-icon" style={{ color: 'var(--info)' }}>
            <svg viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="M17 14h-6"/><path d="M13 18H7"/><path d="M7 14h.01"/><path d="M17 18h.01"/></svg>
          </div>
          <span className="metric-title">Cobros de la Semana</span>
          <span className="metric-value">
            {formatCurrency(cobros.semana)}
          </span>
        </div>

        <div className="card metric-card metric-card-cartera" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="metric-icon" style={{ color: 'var(--primary)' }}>
            <svg viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>
          </div>
          <span className="metric-title">Cobros del Mes (30 días)</span>
          <span className="metric-value">
            {formatCurrency(cobros.mes)}
          </span>
        </div>
      </section>

      {/* Mora distribution breakdown cards */}
      <section className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="card metric-card metric-card-cartera" style={{ padding: '16px' }}>
          <div className="metric-icon" style={{ right: '16px', top: '16px', width: '40px', height: '40px', color: 'var(--primary)', backgroundColor: 'var(--primary-bg)', borderColor: 'transparent' }}>
            <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px' }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Atraso Leve (1-30 días)</div>
          <div style={{ fontSize: '20px', fontWeight: '800', marginTop: '6px', color: 'var(--primary)' }}>
            {formatCurrency(carteraRiesgo.mora30monto)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{carteraRiesgo.mora30cant} clientes</div>
        </div>
        <div className="card metric-card metric-card-atrasados" style={{ padding: '16px' }}>
          <div className="metric-icon" style={{ right: '16px', top: '16px', width: '40px', height: '40px', color: 'var(--warning)', backgroundColor: 'var(--warning-light)', borderColor: 'rgba(245, 158, 11, 0.2)' }}>
            <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px' }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/><path d="M20 4 16 8"/></svg>
          </div>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Atraso Medio (31-90 días)</div>
          <div style={{ fontSize: '20px', fontWeight: '800', marginTop: '6px', color: 'var(--warning)' }}>
            {formatCurrency(carteraRiesgo.mora90monto)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{carteraRiesgo.mora90cant} clientes</div>
        </div>
        <div className="card metric-card metric-card-vencimientos-hoy" style={{ padding: '16px' }}>
          <div className="metric-icon" style={{ right: '16px', top: '16px', width: '40px', height: '40px', color: 'var(--danger)', backgroundColor: 'var(--danger-light)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            <svg viewBox="0 0 24 24" style={{ width: '20px', height: '20px' }}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mora Crítica (+90 días)</div>
          <div style={{ fontSize: '20px', fontWeight: '800', marginTop: '6px', color: 'var(--danger)' }}>
            {formatCurrency(carteraRiesgo.moraMas90monto)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{carteraRiesgo.moraMas90cant} clientes</div>
        </div>
      </section>

      {/* Navigation tabs */}
      <div className="tabs-container no-print" style={{ 
        display: 'flex', 
        borderBottom: '2px solid var(--border-color)', 
        gap: '24px',
        marginTop: '12px'
      }}>
        <button 
          onClick={() => setActiveTab('mora')}
          style={{
            padding: '12px 4px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'mora' ? '3px solid var(--primary)' : '3px solid transparent',
            fontWeight: activeTab === 'mora' ? '700' : '500',
            color: activeTab === 'mora' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '14.5px'
          }}
        >
          🚨 Detalle de Mora ({data.lists.mora.length})
        </button>

        <button 
          onClick={() => setActiveTab('pagos')}
          style={{
            padding: '12px 4px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'pagos' ? '3px solid var(--primary)' : '3px solid transparent',
            fontWeight: activeTab === 'pagos' ? '700' : '500',
            color: activeTab === 'pagos' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '14.5px'
          }}
        >
          💰 Cobros Recientes ({data.lists.pagos.length})
        </button>

        <button 
          onClick={() => setActiveTab('vencimientos')}
          style={{
            padding: '12px 4px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'vencimientos' ? '3px solid var(--primary)' : '3px solid transparent',
            fontWeight: activeTab === 'vencimientos' ? '700' : '500',
            color: activeTab === 'vencimientos' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '14.5px'
          }}
        >
          🗓️ Vencimientos próximos ({data.lists.vencimientos.length})
        </button>
      </div>

      {/* TAB CONTENTS */}
      <section className="card" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header Action inside Table card */}
        <div className="no-print" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)' 
        }}>
          <h2 style={{ fontSize: '15px' }}>
            {activeTab === 'mora' && 'Listado de Clientes con Cartera en Mora'}
            {activeTab === 'pagos' && 'Bitácora de Cobros de los Últimos 30 Días'}
            {activeTab === 'vencimientos' && 'Próximos Vencimientos de Cuota (Próximos 14 días)'}
          </h2>
          <button 
            className="btn btn-secondary export-btn" 
            style={{ padding: '6px 12px', fontSize: '12.5px' }}
            onClick={
              activeTab === 'mora' ? exportMoraToExcel : 
              activeTab === 'pagos' ? exportPagosToExcel : 
              exportVencimientosToExcel
            }
          >
            📊 Exportar a Excel (XLSX)
          </button>
        </div>

        {/* Tab 1: Cartera en Mora */}
        {activeTab === 'mora' && (
          <div className="table-container" style={{ border: 'none' }}>
            {data.lists.mora.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Cédula</th>
                    <th># Préstamo</th>
                    <th>Monto Cuota</th>
                    <th>Balance Pendiente</th>
                    <th style={{ textAlign: 'center' }}>Días Atraso</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lists.mora.map((item) => (
                    <tr key={item.numero_prestamo}>
                      <td style={{ fontWeight: 600 }}>{item.nombre_cliente}</td>
                      <td>{item.cedula}</td>
                      <td><code>{item.numero_prestamo}</code></td>
                      <td>{formatCurrency(item.cuota_mensual)}</td>
                      <td style={{ fontWeight: 700, color: 'var(--danger)' }}>{formatCurrency(item.balance_pendiente)}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: item.dias_atraso > 30 ? 'var(--danger)' : 'var(--warning)' }}>
                        {item.dias_atraso}
                      </td>
                      <td>
                        <span className={`badge badge-${item.estado}`}>{item.estado}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <span className="empty-state-icon">🎉</span>
                <div className="empty-state-title">Excelente Salud Financiera</div>
                <div className="empty-state-desc">No hay clientes con saldos vencidos actualmente.</div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Cobros Recientes */}
        {activeTab === 'pagos' && (
          <div className="table-container" style={{ border: 'none' }}>
            {data.lists.pagos.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>ID Pago</th>
                    <th>Cliente</th>
                    <th># Préstamo</th>
                    <th>Monto Recibido</th>
                    <th>Método</th>
                    <th>Fecha</th>
                    <th>Registrado Por</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lists.pagos.map((item) => (
                    <tr key={item.id}>
                      <td><code>#{String(item.id).padStart(6, '0')}</code></td>
                      <td style={{ fontWeight: 600 }}>{item.nombre_cliente || 'N/A'}</td>
                      <td><code>{item.numero_prestamo}</code></td>
                      <td style={{ fontWeight: 700, color: 'var(--secondary)' }}>{formatCurrency(item.monto_pagado)}</td>
                      <td style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: 'bold' }}>{item.metodo_pago}</td>
                      <td>{formatDate(item.fecha_pago)}</td>
                      <td>{item.registrado_por}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <span className="empty-state-icon">💰</span>
                <div className="empty-state-title">Sin Cobros Registrados</div>
                <div className="empty-state-desc">No se han registrado cuotas cobradas en los últimos 30 días.</div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Vencimientos */}
        {activeTab === 'vencimientos' && (
          <div className="table-container" style={{ border: 'none' }}>
            {data.lists.vencimientos.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Cédula</th>
                    <th># Préstamo</th>
                    <th>Valor Cuota</th>
                    <th>Fecha Vencimiento</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lists.vencimientos.map((item) => (
                    <tr key={item.numero_prestamo}>
                      <td style={{ fontWeight: 600 }}>{item.nombre_cliente}</td>
                      <td>{item.cedula}</td>
                      <td><code>{item.numero_prestamo}</code></td>
                      <td style={{ fontWeight: 700 }}>{formatCurrency(item.cuota_mensual)}</td>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{formatDate(item.fecha_proximo_pago)}</td>
                      <td>
                        <span className={`badge badge-${item.estado}`}>{item.estado}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <span className="empty-state-icon">🗓️</span>
                <div className="empty-state-title">Sin Vencimientos Próximos</div>
                <div className="empty-state-desc">No existen préstamos con vencimiento programado en los próximos 14 días.</div>
              </div>
            )}
          </div>
        )}

      </section>
    </div>
  );
}
