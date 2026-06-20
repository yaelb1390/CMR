'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useToast } from '@/context/ToastContext';

function ClientesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();

  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => setUser(data.user))
      .catch(console.error);
  }, []);

  const cedulaParam = searchParams.get('cedula');

  // List state
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('activos');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [selectedClient, setSelectedClient] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Form values — incluye telefono2 y métodos de desembolso
  const [formValues, setFormValues] = useState({
    cedula: '',
    nombre: '',
    telefono: '',
    telefono2: '',
    direccion: '',
    metodo_desembolso: 'efectivo',
    banco_nombre: '',
    numero_cuenta: '',
    email: ''
  });

  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteConfirmCedula, setDeleteConfirmCedula] = useState('');

  // ── Calculadora de Préstamo ────────────────────────────
  const [calcMonto, setCalcMonto] = useState('');
  const [calcTasa, setCalcTasa] = useState('20');
  const [calcCuotas, setCalcCuotas] = useState('12');
  const [calcFreq, setCalcFreq] = useState('mensual');
  const [showCalc, setShowCalc] = useState(false);

  const calcResultado = (() => {
    const monto = parseFloat(calcMonto) || 0;
    const tasa = parseFloat(calcTasa) || 0;
    const cuotas = parseInt(calcCuotas) || 1;
    if (monto <= 0) return null;
    const tasaDecimal = tasa / 100;
    const interes = monto * tasaDecimal;
    const total = monto + interes;
    const cuotaCalc = Math.round((total / cuotas) * 100) / 100;
    return { monto, interes, total, cuota: cuotaCalc, cuotas, tasa };
  })();
  // ───────────────────────────────────────────────────────

  const fetchClients = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/clientes?search=${encodeURIComponent(search)}&tab=${activeTab}&page=${page}&limit=10`);
      if (res.ok) {
        const json = await res.json();
        setClients(json.data || []);
        setTotalPages(json.pagination.totalPages || 1);
        setTotalRecords(json.pagination.totalRecords || 0);
      } else {
        showToast('Error al obtener la lista de clientes.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red al conectar con el servidor.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, [search, activeTab, page]);

  useEffect(() => {
    if (cedulaParam) {
      handleOpenDetail(cedulaParam);
      router.replace('/clientes');
    }
  }, [cedulaParam]);

  const handleOpenDetail = async (cedula) => {
    try {
      setDetailLoading(true);
      setShowDetailModal(true);
      const res = await fetch(`/api/clientes/${cedula}`);
      if (res.ok) {
        const json = await res.json();
        setSelectedClient(json.data);
      } else {
        showToast('No se pudieron obtener los detalles del cliente.', 'error');
        setShowDetailModal(false);
      }
    } catch (err) {
      showToast('Error al conectar con la base de datos.', 'error');
      setShowDetailModal(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setFormValues({ cedula: '', nombre: '', telefono: '', telefono2: '', direccion: '', metodo_desembolso: 'efectivo', banco_nombre: '', numero_cuenta: '', email: '' });
    setFormErrors({});
    setCalcMonto('');
    setCalcTasa('20');
    setCalcCuotas('12');
    setCalcFreq('mensual');
    setShowCalc(false);
    setShowAddModal(true);
  };

  const handleOpenEdit = () => {
    if (!selectedClient) return;
    setFormValues({
      cedula: selectedClient.cedula,
      nombre: selectedClient.nombre,
      telefono: selectedClient.telefono || '',
      telefono2: selectedClient.telefono2 || '',
      direccion: selectedClient.direccion || '',
      metodo_desembolso: selectedClient.metodo_desembolso || 'efectivo',
      banco_nombre: selectedClient.banco_nombre || '',
      numero_cuenta: selectedClient.numero_cuenta || '',
      email: selectedClient.email || ''
    });
    setFormErrors({});
    setShowDetailModal(false);
    setShowEditModal(true);
  };

  const handleOpenDelete = () => {
    if (!selectedClient) return;
    setDeleteConfirmCedula('');
    setShowDetailModal(false);
    setShowDeleteModal(true);
  };

  const validateForm = (isEdit = false) => {
    const errors = {};
    if (!isEdit) {
      if (!formValues.cedula || !/^\d{11}$/.test(formValues.cedula)) {
        errors.cedula = 'La cédula debe contener exactamente 11 dígitos numéricos.';
      }
    }
    if (!formValues.nombre || formValues.nombre.trim().length < 3) {
      errors.nombre = 'El nombre completo debe tener al menos 3 caracteres.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm(false)) return;
    try {
      setSaving(true);
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues)
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Cliente registrado correctamente', 'success');
        setShowAddModal(false);
        fetchClients();
      } else {
        showToast(data.error || 'Ocurrió un error.', 'error');
      }
    } catch (err) {
      showToast('Error de red.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm(true)) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/clientes/${formValues.cedula}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues)
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Cambios guardados correctamente', 'success');
        setShowEditModal(false);
        fetchClients();
        handleOpenDetail(formValues.cedula);
      } else {
        showToast(data.error || 'Ocurrió un error.', 'error');
      }
    } catch (err) {
      showToast('Error de red.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubmit = async (e) => {
    e.preventDefault();
    if (deleteConfirmCedula !== selectedClient.cedula) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/clientes/${selectedClient.cedula}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Cliente eliminado correctamente', 'success');
        setShowDeleteModal(false);
        setSelectedClient(null);
        fetchClients();
      } else {
        const json = await res.json();
        showToast(json.error || 'Error al eliminar.', 'error');
      }
    } catch (err) {
      showToast('Error de red.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // --- Helpers de formato ---
  const formatCurrency = (val) =>
    new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' })
      .format(val || 0)
      .replace('DOP', 'RD$');

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  };

  const renderScoreStars = (scoreStr) => {
    const s = scoreStr || 'nuevo';
    const stars = {
      excelente: '⭐⭐⭐⭐⭐ Excelente',
      muy_bueno: '⭐⭐⭐⭐ Muy Bueno',
      bueno: '⭐⭐⭐ Bueno',
      regular: '⭐⭐ Regular',
      riesgoso: '⭐ Riesgoso',
      nuevo: '🆕 Nuevo Cliente'
    };
    const colors = {
      excelente: '#10B981', muy_bueno: '#3B82F6', bueno: '#F59E0B',
      regular: '#F97316', riesgoso: '#EF4444', nuevo: '#6B7280'
    };
    return <span style={{ color: colors[s], fontWeight: 'bold' }}>{stars[s]}</span>;
  };

  // Cálculo de totales del historial
  const calcularTotalesHistorial = (prestamos = []) => {
    const total = prestamos.reduce((acc, p) => {
      acc.capitalPrestado += parseFloat(p.monto_aprobado) || 0;
      acc.capitalPagado   += parseFloat(p.monto_aprobado - p.balance_pendiente) || 0;
      acc.pendiente       += parseFloat(p.balance_pendiente) || 0;
      return acc;
    }, { capitalPrestado: 0, capitalPagado: 0, pendiente: 0 });
    return total;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Módulo de Clientes</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Listado y administración de clientes activos e históricos
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <span>➕</span> Agregar Cliente
        </button>
      </div>

      {/* Tabs + Búsqueda */}
      <section className="filters-bar" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid var(--border-color)', flex: 1 }}>
          {['activos', 'historicos'].map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setPage(1); }}
              style={{
                padding: '8px 16px', background: 'none', border: 'none',
                borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                fontWeight: activeTab === tab ? 'bold' : 'normal',
                color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer', textTransform: 'capitalize'
              }}
            >
              {tab === 'activos' ? 'Clientes Activos' : 'Clientes Históricos'}
            </button>
          ))}
        </div>
        <div className="filter-item" style={{ width: '280px' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Buscar por cédula o nombre..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </section>

      {/* Tabla */}
      <section className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: '48px' }}>
            {[...Array(5)].map((_, i) => <div key={i} className="shimmer shimmer-row"></div>)}
          </div>
        ) : clients.length > 0 ? (
          <>
            <div className="table-container" style={{ border: 'none' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Nombre Completo</th>
                    <th>Cédula</th>
                    <th>Calificación</th>
                    <th>Préstamos Totales</th>
                    {activeTab === 'activos'
                      ? <th>Capital Pendiente</th>
                      : <th>Préstamos Liquidados</th>
                    }
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.cedula}>
                      <td style={{ fontWeight: 600 }}>{client.nombre}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{client.cedula}</td>
                      <td>{renderScoreStars(client.clasificacion)}</td>
                      <td>{client.total_prestamos}</td>
                      {activeTab === 'activos' ? (
                        <td style={{ fontWeight: '700', color: 'var(--danger)' }}>
                          {formatCurrency(parseFloat(client.capital_prestado) - parseFloat(client.capital_pagado))}
                        </td>
                      ) : (
                        <td style={{ fontWeight: '700', color: 'var(--success)' }}>
                          {client.prestamos_liquidados}
                        </td>
                      )}
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }}
                          onClick={() => handleOpenDetail(client.cedula)}>
                          👁️ Perfil Completo
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination-container">
              <span className="pagination-info">Página <b>{page}</b> de <b>{totalPages}</b> ({totalRecords} clientes)</span>
              <div className="pagination-buttons">
                <button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage(p => Math.max(p - 1, 1))}>◀️ Anterior</button>
                <button className="btn btn-secondary" disabled={page === totalPages} onClick={() => setPage(p => Math.min(p + 1, totalPages))}>Siguiente ▶️</button>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <div className="empty-state-title">No se encontraron clientes</div>
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════
          MODAL DETALLE DEL CLIENTE
      ══════════════════════════════════════════ */}
      {showDetailModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '860px', width: '100%' }}>
            <div className="modal-header">
              <h2>Perfil del Cliente</h2>
              <button className="btn" style={{ background: 'none', padding: 0 }} onClick={() => setShowDetailModal(false)}>❌</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              {detailLoading || !selectedClient ? (
                <div style={{ padding: '24px' }}>
                  {[...Array(4)].map((_, i) => <div key={i} className="shimmer shimmer-row" style={{ marginBottom: '12px' }}></div>)}
                </div>
              ) : (() => {
                const totales = calcularTotalesHistorial(selectedClient.prestamos || []);
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* Encabezado del perfil */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <h2 style={{ fontSize: '22px', margin: 0 }}>{selectedClient.nombre}</h2>
                        <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                          Cédula: <b>{selectedClient.cedula}</b> &nbsp;|&nbsp;
                          Cliente desde: {formatDate(selectedClient.created_at)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '16px' }}>{renderScoreStars(selectedClient.clasificacion)}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                          Score Crediticio: <b>{selectedClient.score_crediticio || 100}/100</b>
                        </div>
                      </div>
                    </div>

                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '12px', background: 'var(--primary-bg)', borderRadius: 'var(--radius-sm)',
                      padding: '14px', border: '1px solid var(--border-color)'
                    }}>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600', marginBottom: '4px' }}>📞 Teléfono Principal</div>
                        <div style={{ fontWeight: '600' }}>{selectedClient.telefono || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600', marginBottom: '4px' }}>📱 WhatsApp</div>
                        <div style={{ fontWeight: '600' }}>{selectedClient.telefono2 || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600', marginBottom: '4px' }}>📧 Correo Electrónico</div>
                        <div style={{ fontWeight: '600' }}>{selectedClient.email || '—'}</div>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600', marginBottom: '4px' }}>📍 Dirección</div>
                        <div style={{ fontWeight: '600' }}>{selectedClient.direccion || '—'}</div>
                      </div>
                    </div>

                    {/* Métricas financieras del cliente */}
                    <div>
                      <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                        Resumen Financiero del Cliente
                      </h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                        {[
                          { label: 'Total Préstamos', value: selectedClient.total_prestamos, color: 'var(--primary)' },
                          { label: 'Liquidados', value: selectedClient.prestamos_liquidados, color: 'var(--success)' },
                          { label: 'Capital Prestado', value: formatCurrency(totales.capitalPrestado), color: 'inherit' },
                          { label: 'Capital Recuperado', value: formatCurrency(totales.capitalPagado), color: 'var(--success)' },
                          { label: 'Balance Pendiente', value: formatCurrency(totales.pendiente), color: totales.pendiente > 0 ? 'var(--danger)' : 'var(--success)' },
                          { label: 'Máx. Días Atraso', value: `${selectedClient.max_dias_atraso || 0} días`, color: selectedClient.max_dias_atraso > 0 ? 'var(--warning)' : 'var(--success)' },
                        ].map((m, i) => (
                          <div key={i} style={{
                            background: 'var(--card-bg)', border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)', padding: '12px'
                          }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>{m.label}</div>
                            <div style={{ fontWeight: '700', fontSize: '15px', color: m.color }}>{m.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Historial de préstamos */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h3 style={{ margin: 0 }}>Historial de Préstamos con la Institución</h3>
                        <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '13px' }}
                          onClick={() => { setShowDetailModal(false); router.push(`/prestamos?cedula=${selectedClient.cedula}`); }}>
                          💰 Otorgar Nuevo Préstamo
                        </button>
                      </div>

                      {selectedClient.prestamos && selectedClient.prestamos.length > 0 ? (
                        <div className="table-container">
                          <table className="table" style={{ fontSize: '13px' }}>
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>Préstamo</th>
                                <th>Monto Aprobado</th>
                                <th>Total a Pagar</th>
                                <th>Balance Pend.</th>
                                <th>Cuota</th>
                                <th>Frecuencia</th>
                                <th>Cuotas</th>
                                <th>Fecha Inicio</th>
                                <th>Estado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedClient.prestamos.map((p, idx) => {
                                // El "total a pagar" es lo que se calcula: balance original = monto + interés
                                // Si balance_pendiente > monto_aprobado, el total es balance (incluye interés)
                                // De otra forma usamos monto_aprobado como base
                                const balanceOriginal = parseFloat(p.balance_original || p.balance_pendiente + (p.monto_aprobado - p.balance_pendiente));
                                const totalAPagar = parseFloat(p.monto_aprobado) + (parseFloat(p.monto_interes) || 0);
                                const pagado = totalAPagar - parseFloat(p.balance_pendiente);

                                return (
                                  <tr key={p.numero_prestamo} style={{ background: p.estado === 'pagado' ? 'rgba(16,185,129,0.04)' : 'inherit' }}>
                                    <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{idx + 1}</td>
                                    <td>
                                      <code style={{ color: 'var(--primary)', fontWeight: '700', fontSize: '12px' }}>
                                        {p.numero_prestamo}
                                      </code>
                                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        {p.metodo_desembolso === 'banco' ? (
                                          <span>🏦 <b>{p.banco_nombre}</b>: {p.numero_cuenta}</span>
                                        ) : (
                                          <span>💵 Efectivo</span>
                                        )}
                                      </div>
                                    </td>
                                    <td>{formatCurrency(p.monto_aprobado)}</td>
                                    <td style={{ fontWeight: '600' }}>
                                      {formatCurrency(totalAPagar)}
                                      {p.tasa_interes > 0 && (
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                          ({(parseFloat(p.tasa_interes) * 100).toFixed(1)}% interés)
                                        </div>
                                      )}
                                    </td>
                                    <td style={{ fontWeight: '700', color: parseFloat(p.balance_pendiente) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                                      {formatCurrency(p.balance_pendiente)}
                                    </td>
                                    <td>{formatCurrency(p.cuota_mensual)}</td>
                                    <td style={{ textTransform: 'capitalize' }}>{p.tipo_frecuencia || 'mensual'}</td>
                                    <td style={{ textAlign: 'center' }}>
                                      <span style={{ fontSize: '12px' }}>{p.cuotas_pagadas || 0}/{p.total_cuotas || '—'}</span>
                                    </td>
                                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(p.fecha_inicio || p.created_at)}</td>
                                    <td><span className={`badge badge-${p.estado}`}>{p.estado}</span></td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            {/* Fila de totales */}
                            <tfoot>
                              <tr style={{ background: 'var(--primary-bg)', fontWeight: '700' }}>
                                <td colSpan="2" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>TOTALES ({selectedClient.prestamos.length} préstamos)</td>
                                <td>{formatCurrency(totales.capitalPrestado)}</td>
                                <td>—</td>
                                <td style={{ color: totales.pendiente > 0 ? 'var(--danger)' : 'var(--success)' }}>
                                  {formatCurrency(totales.pendiente)}
                                </td>
                                <td colSpan="5"></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      ) : (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--primary-bg)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-color)' }}>
                          <div style={{ fontSize: '32px', marginBottom: '8px' }}>💼</div>
                          <div>Este cliente aún no tiene préstamos registrados.</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              {user?.rol === 'admin' ? (
                <button className="btn btn-danger" onClick={handleOpenDelete}>🗑️ Eliminar Cliente</button>
              ) : <div></div>}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>Cerrar</button>
                <button className="btn btn-primary" onClick={handleOpenEdit}>✏️ Editar Datos</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          MODAL AGREGAR / EDITAR CLIENTE
      ══════════════════════════════════════════ */}
      {(showAddModal || showEditModal) && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: showAddModal ? '960px' : '600px', width: '96vw' }}>
            <form onSubmit={showAddModal ? handleAddSubmit : handleEditSubmit}>
              <div className="modal-header">
                <h2>{showAddModal ? '👤 Registrar Nuevo Cliente' : '✏️ Editar Cliente'}</h2>
                <button type="button" className="btn" style={{ background: 'none', padding: 0 }}
                  onClick={() => { setShowAddModal(false); setShowEditModal(false); }}>❌</button>
              </div>

              {/* BODY — layout horizontal */}
              <div className="modal-body" style={{ padding: '20px 24px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: showAddModal ? '1fr 1fr' : '1fr',
                  gap: '24px',
                  alignItems: 'flex-start'
                }}>

                  {/* ── COLUMNA IZQUIERDA: Datos del cliente ── */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.06em', paddingBottom: '6px', borderBottom: '1px solid var(--border-color)' }}>
                      📋 Datos Personales
                    </div>

                    {/* Cédula + Nombre */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Cédula (11 dígitos) <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <input
                          type="text" maxLength={11} disabled={showEditModal}
                          className={`form-control ${formErrors.cedula ? 'is-invalid' : ''}`}
                          value={formValues.cedula}
                          onChange={(e) => setFormValues({ ...formValues, cedula: e.target.value.replace(/\D/g, '') })}
                          placeholder="00100000000"
                        />
                        {formErrors.cedula && <div className="invalid-feedback">{formErrors.cedula}</div>}
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Nombre Completo <span style={{ color: 'var(--danger)' }}>*</span></label>
                        <input
                          type="text"
                          className={`form-control ${formErrors.nombre ? 'is-invalid' : ''}`}
                          value={formValues.nombre}
                          onChange={(e) => setFormValues({ ...formValues, nombre: e.target.value })}
                          placeholder="Juan Pérez García"
                        />
                        {formErrors.nombre && <div className="invalid-feedback">{formErrors.nombre}</div>}
                      </div>
                    </div>

                    {/* Teléfonos */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>📞 Teléfono Principal</label>
                        <input type="tel" className="form-control" value={formValues.telefono}
                          onChange={(e) => setFormValues({ ...formValues, telefono: e.target.value })}
                          placeholder="809-000-0000" />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>📱 WhatsApp <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(opcional)</span></label>
                        <input type="tel" className="form-control" value={formValues.telefono2}
                          onChange={(e) => setFormValues({ ...formValues, telefono2: e.target.value })}
                          placeholder="829-000-0000" />
                      </div>
                    </div>

                    {/* Dirección + Email */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>📍 Dirección</label>
                        <input type="text" className="form-control" value={formValues.direccion}
                          onChange={(e) => setFormValues({ ...formValues, direccion: e.target.value })}
                          placeholder="Calle, No., Sector, Ciudad" />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>📧 Correo <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(opcional)</span></label>
                        <input type="email" className="form-control" value={formValues.email}
                          onChange={(e) => setFormValues({ ...formValues, email: e.target.value })}
                          placeholder="cliente@email.com" />
                      </div>
                    </div>

                    {/* Desembolso */}
                    <div style={{ paddingTop: '12px', borderTop: '1px dashed var(--border-color)' }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: '10px' }}>
                        💳 Preferencia de Desembolso
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Método Preferido</label>
                        <select className="form-control" value={formValues.metodo_desembolso}
                          onChange={(e) => setFormValues({ ...formValues, metodo_desembolso: e.target.value })}>
                          <option value="efectivo">💵 Efectivo</option>
                          <option value="banco">🏦 Depósito Bancario</option>
                        </select>
                      </div>

                      {formValues.metodo_desembolso === 'banco' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label>Nombre del Banco</label>
                            <select className="form-control" value={formValues.banco_nombre}
                              onChange={(e) => setFormValues({ ...formValues, banco_nombre: e.target.value })}>
                              <option value="">Selecciona un banco...</option>
                              <option value="Banco Popular">Banco Popular</option>
                              <option value="Banreservas">Banreservas</option>
                              <option value="BHD">BHD</option>
                              <option value="Asociación Popular (APAP)">Asociación Popular (APAP)</option>
                              <option value="Scotiabank">Scotiabank</option>
                              <option value="Asociación Cibao">Asociación Cibao</option>
                              <option value="Otro">Otro</option>
                            </select>
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label>Número de Cuenta</label>
                            <input type="text" className="form-control" value={formValues.numero_cuenta}
                              onChange={(e) => setFormValues({ ...formValues, numero_cuenta: e.target.value })}
                              placeholder="000-000000-0" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── COLUMNA DERECHA: Calculadora (solo al agregar) ── */}
                  {showAddModal && (
                    <div style={{
                      background: 'linear-gradient(160deg, rgba(30,58,95,0.05) 0%, rgba(16,185,129,0.04) 100%)',
                      border: '1.5px solid var(--primary)', borderRadius: 'var(--radius-sm)',
                      padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px'
                    }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        🧮 Calculadora de Préstamo
                      </div>

                      {/* Monto + Tasa */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: '12px' }}>Monto solicitado (RD$)</label>
                          <input type="number" className="form-control" value={calcMonto}
                            onChange={e => setCalcMonto(e.target.value)} placeholder="Ej: 10,000" min="0" />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: '12px' }}>
                            Tasa de interés (%)
                            {user?.rol !== 'admin' && <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--warning)', fontWeight: '700' }}>🔒 Solo Admin</span>}
                          </label>
                          <div style={{ position: 'relative' }}>
                            <input type="number" className="form-control" value={calcTasa}
                              onChange={e => user?.rol === 'admin' && setCalcTasa(e.target.value)}
                              readOnly={user?.rol !== 'admin'}
                              min="0" max="100" step="0.5"
                              style={{ paddingRight: '32px', cursor: user?.rol !== 'admin' ? 'not-allowed' : 'text', backgroundColor: user?.rol !== 'admin' ? 'var(--primary-bg)' : '' }} />
                            <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: '700' }}>%</span>
                          </div>
                        </div>
                      </div>

                      {/* Frecuencia + Cuotas */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: '12px' }}>Frecuencia</label>
                          <select className="form-control" value={calcFreq} onChange={e => setCalcFreq(e.target.value)}>
                            <option value="diario">📆 Diario</option>
                            <option value="semanal">📆 Semanal</option>
                            <option value="quincenal">📆 Quincenal</option>
                            <option value="mensual">📆 Mensual</option>
                          </select>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: '12px' }}>Cantidad de cuotas</label>
                          <input type="number" className="form-control" value={calcCuotas}
                            onChange={e => setCalcCuotas(e.target.value)} min="1" placeholder="12" />
                        </div>
                      </div>

                      {/* Resultados */}
                      {calcResultado ? (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '3px', textTransform: 'uppercase', fontWeight: '600' }}>Capital</div>
                              <div style={{ fontWeight: '700', fontSize: '14px' }}>{formatCurrency(calcResultado.monto)}</div>
                            </div>
                            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '3px', textTransform: 'uppercase', fontWeight: '600' }}>Interés ({calcResultado.tasa}%)</div>
                              <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--warning)' }}>+ {formatCurrency(calcResultado.interes)}</div>
                            </div>
                            <div style={{ background: 'linear-gradient(135deg, var(--primary) 0%, #1e5a9c 100%)', borderRadius: 'var(--radius-sm)', padding: '10px' }}>
                              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', marginBottom: '3px', textTransform: 'uppercase', fontWeight: '600' }}>Total a devolver</div>
                              <div style={{ fontWeight: '800', fontSize: '16px', color: '#fff' }}>{formatCurrency(calcResultado.total)}</div>
                            </div>
                            <div style={{ background: 'var(--card-bg)', border: '2px solid var(--secondary)', borderRadius: 'var(--radius-sm)', padding: '10px' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '3px', textTransform: 'uppercase', fontWeight: '600' }}>
                                Cuota {calcFreq === 'diario' ? 'Diaria' : calcFreq === 'semanal' ? 'Semanal' : calcFreq === 'quincenal' ? 'Quincenal' : 'Mensual'}
                              </div>
                              <div style={{ fontWeight: '800', fontSize: '16px', color: 'var(--secondary)' }}>{formatCurrency(calcResultado.cuota)}</div>
                            </div>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', borderTop: '1px dashed var(--border-color)', paddingTop: '8px', lineHeight: '1.5' }}>
                            {calcResultado.cuotas} cuotas {calcFreq === 'diario' ? 'diarias' : calcFreq === 'semanal' ? 'semanales' : calcFreq === 'quincenal' ? 'quincenales' : 'mensuales'} de {formatCurrency(calcResultado.cuota)}<br/>
                            <span style={{ fontStyle: 'italic' }}>Este cálculo es orientativo. El préstamo se formaliza en el módulo de Préstamos.</span>
                          </div>
                        </>
                      ) : (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', color: 'var(--text-muted)', textAlign: 'center', gap: '8px' }}>
                          <div style={{ fontSize: '36px' }}>💡</div>
                          <div style={{ fontSize: '13px' }}>Ingresa el monto para ver el cálculo estimado de cuotas en tiempo real.</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" disabled={saving}
                  onClick={() => { setShowAddModal(false); setShowEditModal(false); }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : showAddModal ? '✅ Registrar Cliente' : '💾 Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}




      {/* MODAL ELIMINAR */}
      {showDeleteModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Eliminar Cliente</h2>
            </div>
            <div className="modal-body">
              <p>¿Estás seguro de eliminar a <b>{selectedClient?.nombre}</b>? Esta acción no se puede deshacer.</p>
              <div className="form-group" style={{ marginTop: '12px' }}>
                <label>Escribe la cédula para confirmar</label>
                <input type="text" className="form-control" placeholder={selectedClient?.cedula}
                  value={deleteConfirmCedula} onChange={(e) => setDeleteConfirmCedula(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancelar</button>
              <button className="btn btn-danger"
                disabled={deleteConfirmCedula !== selectedClient?.cedula || saving}
                onClick={handleDeleteSubmit}>
                {saving ? 'Eliminando...' : 'Confirmar Eliminación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClientesPage() {
  return (
    <Suspense fallback={<div>Cargando módulo...</div>}>
      <ClientesContent />
    </Suspense>
  );
}
