'use client';

import React, { useState, useEffect } from 'react';
import { useToast } from '@/context/ToastContext';

export default function UsuariosPage() {
  const { showToast } = useToast();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formValues, setFormValues] = useState({ id: null, username: '', nombre: '', password: '', rol: 'colaborador', permisos: [] });
  const [saving, setSaving] = useState(false);

  const ALL_PERMISSIONS = [
    { key: 'dashboard', label: '📊 Dashboard' },
    { key: 'clientes', label: '👥 CRM Clientes' },
    { key: 'cobros', label: '💳 Módulo de Cobros' },
    { key: 'recordatorios', label: '🔔 Recordatorios' },
    { key: 'prestamos', label: '💼 Préstamos' },
    { key: 'reportes', label: '📈 Reportes' },
    { key: 'usuarios', label: '👥 Usuarios' },
    { key: 'auditoria', label: '📋 Auditoría' },
    { key: 'configuracion', label: '⚙️ Configuración' }
  ];

  const fetchUsuarios = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/usuarios');
      if (res.ok) {
        const json = await res.json();
        setUsuarios(json.data || []);
      }
    } catch (err) {
      showToast('Error al obtener usuarios', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const handleOpenAdd = () => {
    setFormValues({ id: null, username: '', nombre: '', password: '', rol: 'colaborador', permisos: ['clientes', 'cobros', 'recordatorios'] });
    setIsEdit(false);
    setShowModal(true);
  };

  const handleOpenEdit = (u) => {
    setFormValues({ id: u.id, username: u.username, nombre: u.nombre, password: '', rol: u.rol, permisos: u.permisos || [] });
    setIsEdit(true);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Seguro que deseas eliminar este usuario?')) return;
    try {
      const res = await fetch(`/api/usuarios/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Usuario eliminado', 'success');
        fetchUsuarios();
      } else {
        const json = await res.json();
        showToast(json.error || 'Error al eliminar', 'error');
      }
    } catch (err) {
      showToast('Error de red', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = isEdit ? `/api/usuarios/${formValues.id}` : '/api/usuarios';
      const method = isEdit ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues)
      });

      if (res.ok) {
        showToast(`Usuario ${isEdit ? 'actualizado' : 'creado'}`, 'success');
        setShowModal(false);
        fetchUsuarios();
      } else {
        const json = await res.json();
        showToast(json.error || 'Error al guardar', 'error');
      }
    } catch (err) {
      showToast('Error de red', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Módulo de Usuarios</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Administración de accesos y roles (Colaboradores y Administradores)
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <span>➕</span> Agregar Usuario
        </button>
      </div>

      <section className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: '48px' }}>Cargando...</div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Nombre Completo</th>
                  <th>Rol / Permisos</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.username}</td>
                    <td>{u.nombre}</td>
                    <td>
                      <span className={`badge badge-${u.rol === 'admin' ? 'activo' : 'secundario'}`}>
                        {u.rol === 'admin' ? 'Administrador' : 'Colaborador'}
                      </span>
                      {u.rol === 'colaborador' && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Accesos: <b>{u.permisos?.length || 0}</b> / {ALL_PERMISSIONS.length}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px', marginRight: '8px' }} onClick={() => handleOpenEdit(u)}>
                        ✏️
                      </button>
                      <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '13px' }} onClick={() => handleDelete(u.id)}>
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <form onSubmit={handleSubmit}>
              <div className="modal-header">
                <h2>{isEdit ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
                <button type="button" className="btn" style={{ background: 'none', padding: 0 }} onClick={() => setShowModal(false)}>❌</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>Nombre de Usuario</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formValues.username}
                    onChange={(e) => setFormValues({ ...formValues, username: e.target.value })}
                    disabled={isEdit}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Nombre Completo</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formValues.nombre}
                    onChange={(e) => setFormValues({ ...formValues, nombre: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Contraseña {isEdit && <span style={{ fontSize: '11px', color: 'gray' }}>(Dejar en blanco para no cambiar)</span>}</label>
                  <input
                    type="password"
                    className="form-control"
                    value={formValues.password}
                    onChange={(e) => setFormValues({ ...formValues, password: e.target.value })}
                    required={!isEdit}
                  />
                </div>
                 <div className="form-group">
                  <label>Rol</label>
                  <select
                    className="form-control"
                    value={formValues.rol}
                    onChange={(e) => setFormValues({ ...formValues, rol: e.target.value })}
                  >
                    <option value="colaborador">Colaborador</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                
                <div className="form-group" style={{ marginTop: '20px' }}>
                  <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>Privilegios y Accesos (Cotejos)</label>
                  {formValues.rol === 'admin' ? (
                    <div style={{ backgroundColor: 'var(--primary-bg)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-muted)' }}>
                      🛡️ Los administradores tienen acceso completo a todas las funciones del sistema por defecto.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginTop: '10px' }}>
                      {ALL_PERMISSIONS.map((perm) => {
                        const isChecked = formValues.permisos?.includes(perm.key);
                        return (
                          <label key={perm.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', padding: '6px 10px', borderRadius: '6px', background: isChecked ? 'rgba(var(--primary-rgb, 30,58,95), 0.05)' : 'transparent', border: isChecked ? '1px solid var(--primary)' : '1px solid var(--border-color)', transition: 'all 0.2s ease' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                              onChange={(e) => {
                                let newPerms = [...(formValues.permisos || [])];
                                if (e.target.checked) {
                                  newPerms.push(perm.key);
                                } else {
                                  newPerms = newPerms.filter(k => k !== perm.key);
                                }
                                setFormValues({ ...formValues, permisos: newPerms });
                              }}
                            />
                            <span>{perm.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
