'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useToast } from '@/context/ToastContext';
import * as XLSX from 'xlsx';

function PrestamosContent() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();

  const cedulaParam = searchParams.get('cedula');

  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [estadoFilter, setEstadoFilter] = useState('');
  const [diasMinFilter, setDiasMinFilter] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLoan, setEditingLoan] = useState(null);
  const [saving, setSaving] = useState(false);
  const [finConfig, setFinConfig] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [showFutureDateWarning, setShowFutureDateWarning] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);


  // Estado del formulario
  const [formValues, setFormValues] = useState({
    cedula: '',
    monto_aprobado: '',
    frecuencia: 'mensual',
    total_cuotas: '12',
    tasa_interes: '5',   // Se guarda como porcentaje (ej. 5 = 5%), se convierte a decimal al enviar
    fecha_inicio: new Date().toISOString().split('T')[0],
    metodo_desembolso: 'efectivo',
    banco_nombre: '',
    numero_cuenta: ''
  });

  // ── Cálculo automático en tiempo real ──────────────────────────────────────
  const calculo = useMemo(() => {
    const monto     = parseFloat(formValues.monto_aprobado) || 0;
    const tasaPct   = parseFloat(formValues.tasa_interes)   || 0;
    const cuotas    = parseInt(formValues.total_cuotas)      || 1;

    if (monto <= 0 || cuotas <= 0) {
      return { montoInteres: 0, totalAPagar: 0, cuotaEstimada: 0, tasaDecimal: 0 };
    }

    const tasaDecimal    = tasaPct / 100;
    const montoInteres   = Math.round(monto * tasaDecimal * 100) / 100;
    const totalAPagar    = Math.round((monto + montoInteres) * 100) / 100;
    const cuotaEstimada  = Math.round((totalAPagar / cuotas) * 100) / 100;

    return { montoInteres, totalAPagar, cuotaEstimada, tasaDecimal };
  }, [formValues.monto_aprobado, formValues.tasa_interes, formValues.total_cuotas]);
  // ───────────────────────────────────────────────────────────────────────────

  const fetchLoans = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (estadoFilter)  params.set('estado',     estadoFilter);
      if (diasMinFilter) params.set('dias_min',   diasMinFilter);
      if (fechaDesde)    params.set('fecha_desde', fechaDesde);
      if (fechaHasta)    params.set('fecha_hasta', fechaHasta);

      const res = await fetch(`/api/prestamos?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setLoans(json.data || []);
      } else {
        showToast('Error al obtener la lista de préstamos.', 'error');
      }
    } catch (err) {
      showToast('No se pudo conectar a la base de datos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchLoans(); 
    fetchConfig();
    fetchCurrentUser();
  }, [estadoFilter, diasMinFilter, fechaDesde, fechaHasta]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const json = await res.json();
        setCurrentUser(json.user);
      }
    } catch (err) {}
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/configuracion');
      if (res.ok) {
        const json = await res.json();
        const configMap = {};
        json.data.forEach(item => configMap[item.clave] = item.valor);
        setFinConfig(configMap);
        
        setFormValues(prev => ({
          ...prev,
          tasa_interes: configMap.tasa_interes_default || '5'
        }));
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (cedulaParam) {
      setFormValues(prev => ({ ...prev, cedula: cedulaParam }));
      setShowAddModal(true);
      router.replace('/prestamos');
    }
  }, [cedulaParam]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    
    const today = new Date().toISOString().split('T')[0];
    if (formValues.fecha_inicio > today) {
      setPendingAction('create');
      setShowFutureDateWarning(true);
      return;
    }
    await executeCreateSubmit();
  };

  const executeCreateSubmit = async () => {
    if (!formValues.cedula || !formValues.monto_aprobado || !formValues.total_cuotas) {
      showToast('Llene los campos obligatorios', 'error');
      return;
    }
    if (calculo.totalAPagar <= 0) {
      showToast('Ingrese un monto válido mayor a cero.', 'error');
      return;
    }
    if (formValues.metodo_desembolso === 'banco' && (!formValues.banco_nombre || !formValues.numero_cuenta)) {
      showToast('Debe ingresar el banco y número de cuenta para transferencia.', 'error');
      return;
    }

    if (finConfig) {
      const min = parseFloat(finConfig.monto_minimo) || 0;
      const max = parseFloat(finConfig.monto_maximo) || Infinity;
      const monto = parseFloat(formValues.monto_aprobado) || 0;
      if (monto < min) {
        showToast(`El monto no puede ser menor a RD$ ${min.toLocaleString()}`, 'error');
        return;
      }
      if (monto > max) {
        showToast(`El monto no puede ser mayor a RD$ ${max.toLocaleString()}`, 'error');
        return;
      }
    }

    try {
      setSaving(true);
      const payload = {
        ...formValues,
        tasa_interes: calculo.tasaDecimal   // Convertir de porcentaje a decimal para la API
      };
      const res = await fetch('/api/prestamos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Préstamo ${data.data?.numero_prestamo} creado correctamente`, 'success');
        setShowAddModal(false);
        setFormValues({
          cedula: '', monto_aprobado: '', frecuencia: 'mensual',
          total_cuotas: '12', tasa_interes: finConfig?.tasa_interes_default || '5',
          fecha_inicio: new Date().toISOString().split('T')[0],
          metodo_desembolso: 'efectivo',
          banco_nombre: '',
          numero_cuenta: ''
        });
        fetchLoans();
      } else {
        showToast(data.error || 'Error al crear', 'error');
      }
    } catch (err) {
      showToast('Error de red', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (loan) => {
    setEditingLoan(loan);
    setFormValues({
      cedula: loan.cedula,
      monto_aprobado: loan.monto_aprobado.toString(),
      frecuencia: loan.tipo_frecuencia || 'mensual',
      total_cuotas: loan.total_cuotas.toString(),
      tasa_interes: loan.tasa_interes ? (parseFloat(loan.tasa_interes) * 100).toString() : '5',
      fecha_inicio: loan.created_at ? new Date(loan.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      metodo_desembolso: loan.metodo_desembolso || 'efectivo',
      banco_nombre: loan.banco_nombre || '',
      numero_cuenta: loan.numero_cuenta || ''
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingLoan) return;

    const today = new Date().toISOString().split('T')[0];
    if (formValues.fecha_inicio > today) {
      setPendingAction('edit');
      setShowFutureDateWarning(true);
      return;
    }
    await executeEditSubmit();
  };

  const executeEditSubmit = async () => {
    if (calculo.totalAPagar <= 0) {
      showToast('Ingrese un monto válido mayor a cero.', 'error');
      return;
    }

    if (finConfig) {
      const min = parseFloat(finConfig.monto_minimo) || 0;
      const max = parseFloat(finConfig.monto_maximo) || Infinity;
      const monto = parseFloat(formValues.monto_aprobado) || 0;
      if (monto < min) {
        showToast(`El monto no puede ser menor a RD$ ${min.toLocaleString()}`, 'error');
        return;
      }
      if (monto > max) {
        showToast(`El monto no puede ser mayor a RD$ ${max.toLocaleString()}`, 'error');
        return;
      }
    }

    try {
      setSaving(true);
      const payload = {
        ...formValues,
        tasa_interes: calculo.tasaDecimal
      };
      const res = await fetch(`/api/prestamos/${encodeURIComponent(editingLoan.numero_prestamo)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Préstamo actualizado correctamente', 'success');
        setShowEditModal(false);
        setEditingLoan(null);
        fetchLoans();
      } else {
        showToast(data.error || 'Error al actualizar', 'error');
      }
    } catch (err) {
      showToast('Error de red', 'error');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value) => {
    if (value === undefined || value === null) return 'RD$ 0.00';
    return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 2 })
      .format(value).replace('DOP', 'RD$');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const offset = date.getTimezoneOffset() * 60000;
    const local  = new Date(date.getTime() + offset);
    return `${String(local.getDate()).padStart(2,'0')}/${String(local.getMonth()+1).padStart(2,'0')}/${local.getFullYear()}`;
  };

  const handleExportXLSX = () => {
    if (!loans.length) { showToast('No hay datos para exportar', 'error'); return; }
    const ws = XLSX.utils.json_to_sheet(loans.map(l => ({
      'Préstamo': l.numero_prestamo, 'Cliente': l.nombre_cliente, 'Cédula': l.cedula,
      'Monto': l.monto_aprobado, 'Balance': l.balance_pendiente,
      'Frecuencia': l.tipo_frecuencia, 'Estado': l.estado
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Préstamos');
    XLSX.writeFile(wb, 'prestamos.xlsx');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Módulo de Préstamos</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Listado y administración de préstamos y calendarios de pago
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={handleExportXLSX}>📥 Exportar</button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <span>➕</span> Otorgar Préstamo
          </button>
        </div>
      </div>

      {/* Filtros */}
      <section className="filters-bar">
        <div className="filter-item" style={{ width: '180px' }}>
          <label>Estado</label>
          <select className="form-control" value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)}>
            <option value="">Todos</option>
            <option value="activo">Activo</option>
            <option value="atrasado">Atrasado</option>
            <option value="pagado">Pagado</option>
          </select>
        </div>
        <div className="filter-item" style={{ width: '160px' }}>
          <label>Días mín. atraso</label>
          <input type="number" className="form-control" value={diasMinFilter}
            onChange={(e) => setDiasMinFilter(e.target.value)} placeholder="Ej. 30" />
        </div>
        <div className="filter-item" style={{ width: '160px' }}>
          <label>Fecha desde</label>
          <input type="date" className="form-control" value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)} />
        </div>
        <div className="filter-item" style={{ width: '160px' }}>
          <label>Fecha hasta</label>
          <input type="date" className="form-control" value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)} />
        </div>
      </section>

      {/* Tabla */}
      <section>
        {loading ? (
          <div className="card" style={{ padding: '48px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[...Array(6)].map((_, i) => <div key={i} className="shimmer shimmer-row"></div>)}
          </div>
        ) : loans.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Cédula</th>
                  <th># Préstamo</th>
                  <th>Monto Aprobado</th>
                  <th>Total c/Interés</th>
                  <th>Balance Pendiente</th>
                  <th>Cuota</th>
                  <th>Frecuencia</th>
                  <th>Estado</th>
                  {currentUser?.rol === 'admin' && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => {
                  const totalConInteres = parseFloat(loan.monto_aprobado) + (parseFloat(loan.monto_interes) || 0);
                  return (
                    <tr key={loan.id}>
                      <td style={{ fontWeight: 600 }}>{loan.nombre_cliente}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{loan.cedula}</td>
                      <td>
                        <code style={{ color: 'var(--primary)', fontWeight: '700', fontSize: '13px' }}>
                          {loan.numero_prestamo}
                        </code>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {loan.metodo_desembolso === 'banco' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              🏦 <b>{loan.banco_nombre}</b>: {loan.numero_cuenta}
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              💵 Efectivo
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{formatCurrency(loan.monto_aprobado)}</td>
                      <td style={{ fontWeight: '600' }}>
                        {formatCurrency(totalConInteres > loan.monto_aprobado ? totalConInteres : loan.balance_pendiente)}
                      </td>
                      <td style={{ fontWeight: 700, color: loan.balance_pendiente === 0 ? 'var(--secondary)' : 'inherit' }}>
                        {formatCurrency(loan.balance_pendiente)}
                      </td>
                      <td>{formatCurrency(loan.cuota_mensual)}</td>
                      <td style={{ textTransform: 'capitalize' }}>
                        {loan.tipo_frecuencia || 'mensual'}
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {loan.total_cuotas} cuotas
                        </div>
                      </td>
                      <td><span className={`badge badge-${loan.estado}`}>{loan.estado}</span></td>
                      {currentUser?.rol === 'admin' && (
                        <td>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                            onClick={() => openEditModal(loan)}
                          >
                            ✏️ Editar
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card empty-state">
            <div className="empty-state-icon">💼</div>
            <div className="empty-state-title">No se encontraron préstamos</div>
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════
          MODAL OTORGAR PRÉSTAMO con cálculo automático
      ══════════════════════════════════════════ */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <form onSubmit={handleCreateSubmit}>
              <div className="modal-header">
                <h2>Otorgar Nuevo Préstamo</h2>
                <button type="button" className="btn" style={{ background: 'none', padding: 0 }}
                  onClick={() => setShowAddModal(false)}>❌</button>
              </div>
              <div className="modal-body">

                {/* Cédula del cliente */}
                <div className="form-group">
                  <label>Cédula del Cliente <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="text"
                    required
                    maxLength={11}
                    className="form-control"
                    value={formValues.cedula}
                    placeholder="00100000000 (debe estar registrado)"
                    onChange={(e) => setFormValues({ ...formValues, cedula: e.target.value.replace(/\D/g, '') })}
                  />
                  <small style={{ color: 'var(--text-muted)' }}>El cliente debe estar registrado en el módulo de Clientes.</small>
                </div>

                {/* Monto + Tasa */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Monto Aprobado (RD$) <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="0.01"
                      className="form-control"
                      value={formValues.monto_aprobado}
                      placeholder="0.00"
                      onChange={(e) => setFormValues({ ...formValues, monto_aprobado: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      Tasa de Interés Total (%)
                      {currentUser?.rol !== 'admin' && <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--warning)', fontWeight: '700' }}>🔒 Solo Admin</span>}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        className="form-control"
                        value={formValues.tasa_interes}
                        onChange={(e) => currentUser?.rol === 'admin' && setFormValues({ ...formValues, tasa_interes: e.target.value })}
                        readOnly={currentUser?.rol !== 'admin'}
                        style={{ paddingRight: '36px', cursor: currentUser?.rol !== 'admin' ? 'not-allowed' : 'text', backgroundColor: currentUser?.rol !== 'admin' ? 'var(--primary-bg)' : '' }}
                      />
                      <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px', fontWeight: '600' }}>%</span>
                    </div>
                    <small style={{ color: 'var(--text-muted)' }}>Ej: 5 = 5% sobre el capital</small>
                  </div>
                </div>

                {/* Frecuencia + Cuotas */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Frecuencia de Pago</label>
                    <select
                      className="form-control"
                      value={formValues.frecuencia}
                      onChange={(e) => setFormValues({ ...formValues, frecuencia: e.target.value })}
                    >
                      <option value="diario">Diario</option>
                      <option value="semanal">Semanal</option>
                      <option value="quincenal">Quincenal</option>
                      <option value="mensual">Mensual</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Cantidad de Cuotas <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                      type="number"
                      required
                      min="1"
                      className="form-control"
                      value={formValues.total_cuotas}
                      onChange={(e) => setFormValues({ ...formValues, total_cuotas: e.target.value })}
                    />
                  </div>
                </div>

                {/* Fecha de inicio */}
                <div className="form-group">
                  <label>Fecha de Inicio del Préstamo <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="date"
                    required
                    className="form-control"
                    value={formValues.fecha_inicio}
                    onChange={(e) => setFormValues({ ...formValues, fecha_inicio: e.target.value })}
                  />
                </div>

                {/* Método de desembolso */}
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Método de Desembolso</label>
                    <select
                      className="form-control"
                      value={formValues.metodo_desembolso}
                      onChange={(e) => setFormValues({ ...formValues, metodo_desembolso: e.target.value })}
                    >
                      <option value="efectivo">💵 Efectivo</option>
                      <option value="banco">🏦 Transferencia Bancaria</option>
                    </select>
                  </div>
                </div>

                {formValues.metodo_desembolso === 'banco' && (
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Banco <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input
                        type="text"
                        required
                        className="form-control"
                        placeholder="Ej: Banco Popular, Banreservas"
                        value={formValues.banco_nombre || ''}
                        onChange={(e) => setFormValues({ ...formValues, banco_nombre: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Número de Cuenta <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input
                        type="text"
                        required
                        className="form-control"
                        placeholder="Ej: 0102030405"
                        value={formValues.numero_cuenta || ''}
                        onChange={(e) => setFormValues({ ...formValues, numero_cuenta: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {/* ── Panel de cálculo automático ── */}
                {calculo.totalAPagar > 0 && (
                  <div style={{
                    marginTop: '8px',
                    background: 'linear-gradient(135deg, rgba(var(--primary-rgb, 30,58,95),0.06) 0%, rgba(var(--secondary-rgb, 16,185,129),0.05) 100%)',
                    border: '1.5px solid var(--primary)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '16px' }}>🧮</span>
                      <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--primary)' }}>Cálculo Automático del Préstamo</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                      <div style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)', padding: '10px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>Capital Prestado</div>
                        <div style={{ fontWeight: '700', fontSize: '15px' }}>
                          {formatCurrency(parseFloat(formValues.monto_aprobado) || 0)}
                        </div>
                      </div>
                      <div style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)', padding: '10px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                          Interés ({formValues.tasa_interes}%)
                        </div>
                        <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--warning)' }}>
                          + {formatCurrency(calculo.montoInteres)}
                        </div>
                      </div>
                      <div style={{ background: 'linear-gradient(135deg, var(--primary) 0%, #1e5a9c 100%)', borderRadius: 'var(--radius-sm)', padding: '10px' }}>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '3px' }}>Total a Pagar</div>
                        <div style={{ fontWeight: '800', fontSize: '17px', color: '#fff' }}>
                          {formatCurrency(calculo.totalAPagar)}
                        </div>
                      </div>
                      <div style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)', padding: '10px', border: '2px solid var(--secondary)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                          Cuota {formValues.frecuencia === 'mensual' ? 'Mensual' : formValues.frecuencia === 'semanal' ? 'Semanal' : formValues.frecuencia === 'quincenal' ? 'Quincenal' : 'Diaria'}
                        </div>
                        <div style={{ fontWeight: '800', fontSize: '17px', color: 'var(--secondary)' }}>
                          {formatCurrency(calculo.cuotaEstimada)}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                      {formValues.total_cuotas} cuotas de {formatCurrency(calculo.cuotaEstimada)} | Frecuencia: {formValues.frecuencia}
                    </div>
                  </div>
                )}

                {/* Nota informativa */}
                {calculo.totalAPagar <= 0 && (
                  <div style={{ backgroundColor: 'var(--primary-bg)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: 'var(--radius-sm)', marginTop: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    💡 Ingresa el monto aprobado para ver el cálculo automático de cuotas e intereses.
                  </div>
                )}

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)} disabled={saving}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving || calculo.totalAPagar <= 0}>
                  {saving ? 'Procesando...' : '✅ Guardar y Generar Calendario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          MODAL EDITAR PRÉSTAMO
      ══════════════════════════════════════════ */}
      {showEditModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-header">
                <h2>Editar Préstamo {editingLoan?.numero_prestamo}</h2>
                <button type="button" className="btn" style={{ background: 'none', padding: 0 }}
                  onClick={() => { setShowEditModal(false); setEditingLoan(null); }}>❌</button>
              </div>
              <div className="modal-body">
                
                <div style={{ backgroundColor: 'rgba(255,193,7,0.1)', border: '1px solid #ffc107', padding: '12px', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#856404' }}>
                  ⚠️ <b>Importante:</b> Al guardar los cambios, se eliminará el calendario de cuotas actual y se generará uno nuevo con estos datos. Esta acción no se puede realizar si el cliente ya ha pagado alguna cuota.
                </div>

                {/* Cédula del cliente (Disabled en edición) */}
                <div className="form-group">
                  <label>Cédula del Cliente</label>
                  <input
                    type="text"
                    disabled
                    className="form-control"
                    value={formValues.cedula}
                  />
                </div>

                {/* Monto + Tasa */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Monto Aprobado (RD$) <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="0.01"
                      className="form-control"
                      value={formValues.monto_aprobado}
                      onChange={(e) => setFormValues({ ...formValues, monto_aprobado: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      Tasa de Interés Total (%)
                      {currentUser?.rol !== 'admin' && <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--warning)', fontWeight: '700' }}>🔒 Solo Admin</span>}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        className="form-control"
                        value={formValues.tasa_interes}
                        onChange={(e) => currentUser?.rol === 'admin' && setFormValues({ ...formValues, tasa_interes: e.target.value })}
                        readOnly={currentUser?.rol !== 'admin'}
                        style={{ paddingRight: '36px', cursor: currentUser?.rol !== 'admin' ? 'not-allowed' : 'text', backgroundColor: currentUser?.rol !== 'admin' ? 'var(--primary-bg)' : '' }}
                      />
                      <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px', fontWeight: '600' }}>%</span>
                    </div>
                  </div>
                </div>

                {/* Frecuencia + Cuotas */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Frecuencia de Pago</label>
                    <select
                      className="form-control"
                      value={formValues.frecuencia}
                      onChange={(e) => setFormValues({ ...formValues, frecuencia: e.target.value })}
                    >
                      <option value="diario">Diario</option>
                      <option value="semanal">Semanal</option>
                      <option value="quincenal">Quincenal</option>
                      <option value="mensual">Mensual</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Cantidad de Cuotas <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                      type="number"
                      required
                      min="1"
                      className="form-control"
                      value={formValues.total_cuotas}
                      onChange={(e) => setFormValues({ ...formValues, total_cuotas: e.target.value })}
                    />
                  </div>
                </div>

                {/* Fecha de inicio */}
                <div className="form-group">
                  <label>Fecha de Inicio Original <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="date"
                    required
                    className="form-control"
                    value={formValues.fecha_inicio}
                    onChange={(e) => setFormValues({ ...formValues, fecha_inicio: e.target.value })}
                  />
                </div>

                {/* Método de desembolso */}
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Método de Desembolso</label>
                    <select
                      className="form-control"
                      value={formValues.metodo_desembolso}
                      onChange={(e) => setFormValues({ ...formValues, metodo_desembolso: e.target.value })}
                    >
                      <option value="efectivo">💵 Efectivo</option>
                      <option value="banco">🏦 Transferencia Bancaria</option>
                    </select>
                  </div>
                </div>

                {formValues.metodo_desembolso === 'banco' && (
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Banco <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input
                        type="text"
                        required
                        className="form-control"
                        value={formValues.banco_nombre || ''}
                        onChange={(e) => setFormValues({ ...formValues, banco_nombre: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Número de Cuenta <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input
                        type="text"
                        required
                        className="form-control"
                        value={formValues.numero_cuenta || ''}
                        onChange={(e) => setFormValues({ ...formValues, numero_cuenta: e.target.value })}
                      />
                    </div>
                  </div>
                )}

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowEditModal(false); setEditingLoan(null); }} disabled={saving}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving || calculo.totalAPagar <= 0}>
                  {saving ? 'Guardando...' : '💾 Actualizar Préstamo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmación de Fecha Futura */}
      {showFutureDateWarning && (
        <div className="modal-backdrop" style={{ zIndex: 1050 }}>
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>⚠️ Fecha Futura</h2>
              <button className="close-btn" onClick={() => setShowFutureDateWarning(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Estás intentando registrar o editar un préstamo con una <strong>fecha de inicio en el futuro</strong> ({formValues.fecha_inicio}).</p>
              <p>¿Estás seguro de que deseas continuar?</p>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setShowFutureDateWarning(false)}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={async () => {
                  setShowFutureDateWarning(false);
                  if (pendingAction === 'create') {
                    await executeCreateSubmit();
                  } else if (pendingAction === 'edit') {
                    await executeEditSubmit();
                  }
                  setPendingAction(null);
                }}
              >
                Sí, continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PrestamosPageWrapper() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <PrestamosContent />
    </Suspense>
  );
}
