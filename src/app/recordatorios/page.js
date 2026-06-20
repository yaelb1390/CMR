'use client';

import React, { useState, useEffect } from 'react';
import { useToast } from '@/context/ToastContext';

export default function RecordatoriosPage() {
  const { showToast } = useToast();
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('mora'); // 'mora', 'preventivo'
  const [sendingStates, setSendingStates] = useState({}); // { [cedula]: 'idle' | 'sending' | 'success' | 'error' }
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLoans = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/prestamos');
      if (res.ok) {
        const json = await res.json();
        setLoans(json.data || []);
      } else {
        showToast('Error al obtener lista de recordatorios.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error al conectar con la base de datos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, []);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP',
      minimumFractionDigits: 2
    }).format(value).replace('DOP', 'RD$');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Nunca';
    const date = new Date(dateStr);
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() + userTimezoneOffset);
    return localDate.toLocaleString('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSendNotification = async (loan, tipo) => {
    const cedula = loan.cedula;
    
    // Set status to sending
    setSendingStates(prev => ({ ...prev, [cedula]: 'sending' }));

    try {
      const res = await fetch('/api/notificaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula, tipo })
      });

      const json = await res.json();

      if (res.ok) {
        showToast(`Recordatorio de ${tipo === 'mora' ? 'mora' : 'vencimiento'} enviado con éxito a n8n.`, 'success');
        setSendingStates(prev => ({ ...prev, [cedula]: 'success' }));
        
        // Refresh loans to get the updated fecha_ultima_alerta
        fetchLoans();
      } else {
        showToast(json.error || 'Ocurrió un error al enviar el recordatorio.', 'error');
        setSendingStates(prev => ({ ...prev, [cedula]: 'error' }));
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al conectar con el servidor.', 'error');
      setSendingStates(prev => ({ ...prev, [cedula]: 'error' }));
    }
  };

  // Filter lists based on tab
  const overdueLoans = loans.filter(loan => (loan.estado === 'atrasado' || loan.dias_atraso > 0) && loan.balance_pendiente > 0);
  
  // Preventative: active loans whose due date is in the next 5 days
  const upcomingLoans = loans.filter(loan => {
    if (loan.estado !== 'activo' || loan.balance_pendiente <= 0) return false;
    const today = new Date();
    today.setHours(0,0,0,0);
    const nextPay = new Date(loan.fecha_proximo_pago);
    nextPay.setHours(0,0,0,0);
    
    const diffTime = nextPay.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays >= 0 && diffDays <= 5;
  });

  const activeList = activeTab === 'mora' ? overdueLoans : upcomingLoans;

  const filteredList = activeList.filter(loan => 
    loan.nombre_cliente.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loan.cedula.includes(searchQuery) ||
    loan.numero_prestamo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Title & Description */}
      <div>
        <h1>Recordatorios y Alertas</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Gestiona el envío de recordatorios de cobro automáticos a través de tu servidor n8n.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border-color)', gap: '24px' }}>
        <button
          onClick={() => { setActiveTab('mora'); setSearchQuery(''); }}
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
          🚨 Alertas de Mora ({overdueLoans.length})
        </button>

        <button
          onClick={() => { setActiveTab('preventivo'); setSearchQuery(''); }}
          style={{
            padding: '12px 4px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'preventivo' ? '3px solid var(--primary)' : '3px solid transparent',
            fontWeight: activeTab === 'preventivo' ? '700' : '500',
            color: activeTab === 'preventivo' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '14.5px'
          }}
        >
          🔔 Preventivos (Próximos a vencer) ({upcomingLoans.length})
        </button>
      </div>

      {/* Main Panel */}
      <section className="card" style={{ padding: '0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ padding: '20px 20px 0 20px' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Buscar por cliente, cédula o préstamo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="table-container" style={{ border: 'none' }}>
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center' }}>Cargando datos...</div>
          ) : filteredList.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th># Préstamo</th>
                  <th>Cuota Mensual</th>
                  {activeTab === 'mora' ? (
                    <th style={{ textAlign: 'center' }}>Días Atraso</th>
                  ) : (
                    <th>Fecha Vencimiento</th>
                  )}
                  <th>Última Alerta</th>
                  <th style={{ textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((loan) => {
                  const state = sendingStates[loan.cedula] || 'idle';
                  return (
                    <tr key={loan.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{loan.nombre_cliente}</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-light)', marginTop: '2px' }}>
                          Cédula: {loan.cedula} | Tel: {loan.telefono || 'Sin registrar'}
                        </div>
                      </td>
                      <td>
                        <code>{loan.numero_prestamo}</code>
                      </td>
                      <td style={{ fontWeight: 500 }}>{formatCurrency(loan.cuota_mensual)}</td>
                      {activeTab === 'mora' ? (
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--danger)' }}>
                          {loan.dias_atraso} días
                        </td>
                      ) : (
                        <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                          {new Date(loan.fecha_proximo_pago).toLocaleDateString('es-DO')}
                        </td>
                      )}
                      <td style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        {formatDate(loan.fecha_ultima_alerta)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className={`btn ${state === 'success' ? 'btn-secondary' : 'btn-primary'}`}
                          style={{ 
                            padding: '6px 12px', 
                            fontSize: '12px',
                            backgroundColor: state === 'success' ? '#ECFDF5' : state === 'error' ? '#FEF2F2' : '',
                            color: state === 'success' ? '#059669' : state === 'error' ? '#DC2626' : '',
                            borderColor: state === 'success' ? '#A7F3D0' : state === 'error' ? '#FCA5A5' : ''
                          }}
                          disabled={state === 'sending'}
                          onClick={() => handleSendNotification(loan, activeTab)}
                        >
                          {state === 'idle' && '✉️ Enviar a n8n'}
                          {state === 'sending' && '⏳ Enviando...'}
                          {state === 'success' && '✓ Enviado'}
                          {state === 'error' && '⚠ Reintentar'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <span className="empty-state-icon">🎉</span>
              <div className="empty-state-title">Todo controlado</div>
              <div className="empty-state-desc">
                No hay clientes que requieran recordatorios bajo el criterio seleccionado.
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
