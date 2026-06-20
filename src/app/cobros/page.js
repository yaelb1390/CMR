'use client';

import React, { useState, useEffect } from 'react';
import { useToast } from '@/context/ToastContext';

export default function CobrosPage() {
  const { showToast } = useToast();
  const [loans, setLoans] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [loadingLoans, setLoadingLoans] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEstado, setFilterEstado] = useState('atrasado_activo'); // Default to showing items needing collections

  // Modal State
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Form values
  const [montoPagado, setMontoPagado] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [comentario, setComentario] = useState('');
  const [formError, setFormError] = useState('');

  const fetchLoans = async () => {
    try {
      setLoadingLoans(true);
      // Fetch loans from api/prestamos
      const res = await fetch('/api/prestamos');
      if (res.ok) {
        const json = await res.json();
        setLoans(json.data || []);
      } else {
        showToast('Error al obtener lista de cobros.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error al conectar con la base de datos.', 'error');
    } finally {
      setLoadingLoans(false);
    }
  };

  const fetchRecentPayments = async () => {
    try {
      setLoadingPayments(true);
      const res = await fetch('/api/pagos');
      if (res.ok) {
        const json = await res.json();
        setRecentPayments(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPayments(false);
    }
  };

  useEffect(() => {
    fetchLoans();
    fetchRecentPayments();
  }, []);

  const formatCurrency = (value) => {
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

  const handleOpenCollect = (loan) => {
    setSelectedLoan(loan);
    // Pre-fill amount with monthly fee or remaining balance (whichever is lower)
    const defaultAmount = Math.min(parseFloat(loan.cuota_mensual), parseFloat(loan.balance_pendiente));
    setMontoPagado(defaultAmount.toString());
    setMetodoPago('efectivo');
    setComentario('');
    setFormError('');
    setShowCollectModal(true);
  };

  const handleCollectSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const amount = parseFloat(montoPagado);
    if (isNaN(amount) || amount <= 0) {
      setFormError('Debe ingresar un monto válido y mayor a cero.');
      return;
    }

    if (amount > parseFloat(selectedLoan.balance_pendiente)) {
      setFormError(`El pago no puede exceder el balance pendiente de ${formatCurrency(selectedLoan.balance_pendiente)}`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero_prestamo: selectedLoan.numero_prestamo,
          cedula: selectedLoan.cedula,
          monto_pagado: amount,
          metodo_pago: metodoPago,
          comentario
        })
      });

      const json = await res.json();
      if (res.ok) {
        showToast('Cobro registrado con éxito.', 'success');
        setShowCollectModal(false);
        fetchLoans();
        fetchRecentPayments();
        
        // Ask if they want to print the receipt
        if (confirm('¿Desea imprimir el recibo de este pago?')) {
          window.open(`/recibo/${json.data.pagoId}`, '_blank', 'width=800,height=600');
        }
      } else {
        setFormError(json.error || 'Ocurrió un error al registrar el cobro.');
      }
    } catch (err) {
      console.error(err);
      setFormError('Error de red al guardar el pago.');
    } finally {
      setSaving(false);
    }
  };

  const handlePrintReceipt = (pagoId) => {
    window.open(`/recibo/${pagoId}`, '_blank', 'width=800,height=600');
  };

  // Filter and search logic
  const filteredLoans = loans.filter((loan) => {
    // Search filter
    const matchesSearch = 
      loan.nombre_cliente.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loan.cedula.includes(searchQuery) ||
      loan.numero_prestamo.toLowerCase().includes(searchQuery.toLowerCase());

    // Status filter
    let matchesEstado = true;
    if (filterEstado === 'atrasado_activo') {
      matchesEstado = loan.estado === 'atrasado' || loan.estado === 'activo';
    } else if (filterEstado !== '') {
      matchesEstado = loan.estado === filterEstado;
    }

    return matchesSearch && matchesEstado;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Title & Info */}
      <div>
        <h1>Módulo de Cobros y Pagos</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Registrar cobro de cuotas, ver historial general e imprimir recibos oficiales.
        </p>
      </div>

      {/* Main Grid: Collections and Recent History */}
      <div className="dashboard-sections-grid">
        {/* Left Side: Active Loans Collection Section */}
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <h2>Cartera de Cobros Pendientes</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                className="form-control"
                style={{ width: '180px', padding: '6px 12px', fontSize: '13px' }}
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
              >
                <option value="atrasado_activo">Pendientes (Activos/Mora)</option>
                <option value="atrasado">Solo Atrasados (Mora)</option>
                <option value="activo">Solo Activos (Al día)</option>
                <option value="pagado">Saldados (Pagados)</option>
                <option value="">Todos los préstamos</option>
              </select>
            </div>
          </div>

          {/* Search input */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por cliente, cédula o préstamo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="table-container" style={{ border: 'none' }}>
            {loadingLoans ? (
              <div style={{ padding: '48px', textAlign: 'center' }}>Cargando préstamos...</div>
            ) : filteredLoans.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th># Préstamo</th>
                    <th>Cuota Mensual</th>
                    <th>Balance Pendiente</th>
                    <th>Estado</th>
                    <th style={{ textAlign: 'right' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLoans.map((loan) => (
                    <tr key={loan.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{loan.nombre_cliente}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '2px' }}>Cédula: {loan.cedula}</div>
                      </td>
                      <td>
                        <code style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '700' }}>
                          {loan.numero_prestamo}
                        </code>
                      </td>
                      <td style={{ fontWeight: 500 }}>{formatCurrency(loan.cuota_mensual)}</td>
                      <td style={{ fontWeight: 700, color: loan.balance_pendiente === 0 ? 'var(--secondary)' : 'inherit' }}>
                        {formatCurrency(loan.balance_pendiente)}
                      </td>
                      <td>
                        <span className={`badge badge-${loan.estado}`}>{loan.estado}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-success"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          disabled={loan.balance_pendiente === 0}
                          onClick={() => handleOpenCollect(loan)}
                        >
                          💵 Cobrar Cuota
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <span className="empty-state-icon">🎉</span>
                <div className="empty-state-title">No hay cobros pendientes</div>
                <div className="empty-state-desc">No se encontraron préstamos que coincidan con la búsqueda.</div>
              </div>
            )}
          </div>
        </section>

        {/* Right Side: General Recent Payments Log */}
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2>Cobros Recientes</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Últimas transacciones registradas en el sistema</p>

          <div className="table-container" style={{ border: 'none', maxHeight: '550px', overflowY: 'auto' }}>
            {loadingPayments ? (
              <div style={{ padding: '24px', textAlign: 'center' }}>Cargando pagos...</div>
            ) : recentPayments.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {recentPayments.map((payment) => (
                  <div
                    key={payment.id}
                    style={{
                      padding: '12px',
                      background: 'var(--primary-bg)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13.5px' }}>{payment.nombre_cliente || 'Cliente'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Préstamo: <b>{payment.numero_prestamo}</b>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '1px' }}>
                        Fecha: {formatDate(payment.fecha_pago)} | {payment.metodo_pago.toUpperCase()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                      <span style={{ fontWeight: '800', color: 'var(--secondary)', fontSize: '14px' }}>
                        + {formatCurrency(payment.monto_pagado)}
                      </span>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '11px', gap: '4px' }}
                        onClick={() => handlePrintReceipt(payment.id)}
                      >
                        🖨️ Recibo
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-state-icon">💳</span>
                <div className="empty-state-title">Sin Pagos</div>
                <div className="empty-state-desc">No se han registrado pagos en la base de datos recientemente.</div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* COLLECT PAYMENT MODAL */}
      {showCollectModal && selectedLoan && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <form onSubmit={handleCollectSubmit}>
              <div className="modal-header">
                <h2>Registrar Cobro de Cuota</h2>
                <button
                  type="button"
                  className="btn"
                  style={{ background: 'none', padding: 0 }}
                  onClick={() => setShowCollectModal(false)}
                >
                  ❌
                </button>
              </div>

              <div className="modal-body">
                {formError && <div className="login-error">{formError}</div>}

                <div className="form-group">
                  <label>Cliente</label>
                  <input
                    type="text"
                    className="form-control"
                    disabled
                    value={`${selectedLoan.nombre_cliente} (${selectedLoan.cedula})`}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Préstamo #</label>
                    <input
                      type="text"
                      className="form-control"
                      disabled
                      value={selectedLoan.numero_prestamo}
                    />
                  </div>
                  <div className="form-group">
                    <label>Estado actual</label>
                    <div style={{ marginTop: '8px' }}>
                      <span className={`badge badge-${selectedLoan.estado}`}>{selectedLoan.estado}</span>
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Cuota Mensual</label>
                    <input
                      type="text"
                      className="form-control"
                      disabled
                      value={formatCurrency(selectedLoan.cuota_mensual)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Balance Pendiente</label>
                    <input
                      type="text"
                      className="form-control"
                      disabled
                      value={formatCurrency(selectedLoan.balance_pendiente)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Monto a Cobrar (RD$)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    placeholder="Ingrese monto a cobrar"
                    value={montoPagado}
                    onChange={(e) => setMontoPagado(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Método de Pago</label>
                  <select
                    className="form-control"
                    value={metodoPago}
                    onChange={(e) => setMetodoPago(e.target.value)}
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia Bancaria</option>
                    <option value="deposito">Depósito Bancario</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Comentario / Detalle</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    placeholder="Opcional: Detalle de transferencia, banco, etc."
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                  ></textarea>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={saving}
                  onClick={() => setShowCollectModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-success" disabled={saving}>
                  {saving ? 'Procesando...' : 'Registrar Cobro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
