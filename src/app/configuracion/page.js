'use client';

import React, { useState, useEffect } from 'react';
import { useToast } from '@/context/ToastContext';

export default function ConfiguracionPage() {
  const { showToast } = useToast();
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState('');

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/configuracion');
      if (res.ok) {
        const json = await res.json();
        setConfigs(json.data || []);
      } else {
        showToast('Error al cargar configuración', 'error');
      }
    } catch (err) {
      showToast('Error de red', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleEdit = (conf) => {
    setEditingKey(conf.clave);
    setEditValue(conf.valor);
  };

  const handleSave = async (clave) => {
    try {
      setSaving(true);
      const res = await fetch('/api/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave, valor: editValue })
      });
      if (res.ok) {
        showToast('Configuración guardada', 'success');
        setEditingKey(null);
        fetchConfigs();
      } else {
        showToast('Error al guardar', 'error');
      }
    } catch (err) {
      showToast('Error de red', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1>Configuración Financiera</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Gestiona tasas, moras y límites operativos del sistema.
        </p>
      </div>

      <section className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: '48px' }}>Cargando...</div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Clave</th>
                  <th>Descripción</th>
                  <th>Valor Actual</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {configs.map((c) => (
                  <tr key={c.clave}>
                    <td style={{ fontWeight: 600 }}>{c.clave}</td>
                    <td>{c.descripcion}</td>
                    <td>
                      {editingKey === c.clave ? (
                        <input
                          type={c.tipo === 'decimal' || c.tipo === 'integer' ? 'number' : 'text'}
                          step={c.tipo === 'decimal' ? '0.001' : '1'}
                          className="form-control"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          style={{ width: '120px' }}
                        />
                      ) : (
                        <span style={{ fontWeight: '700', color: 'var(--primary)' }}>
                          {c.valor}
                        </span>
                      )}
                    </td>
                    <td>
                      {editingKey === c.clave ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn btn-primary" style={{ padding: '4px 8px' }} onClick={() => handleSave(c.clave)} disabled={saving}>💾 Guardar</button>
                          <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setEditingKey(null)} disabled={saving}>❌ Cancelar</button>
                        </div>
                      ) : (
                        <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => handleEdit(c)}>✏️ Editar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {/* Logo Upload Section */}
      <section className="card" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Apariencia y Marca</h2>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{
            width: '150px', height: '150px',
            border: '2px dashed var(--border-color)', borderRadius: '8px',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            background: 'var(--primary-bg)', overflow: 'hidden'
          }}>
            <img 
              src={`/api/configuracion/logo?t=${new Date().getTime()}`} 
              alt="Logo actual" 
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              onError={(e) => { e.target.src = '/logo.png?v=1'; }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '250px' }}>
            <h3 style={{ fontSize: '15px', marginBottom: '8px' }}>Logo de la Empresa</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Sube tu propio logo para personalizar el CRM. Recomendado: formato PNG con fondo transparente. Tamaño máximo: 10MB.
            </p>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input 
                type="file" 
                accept="image/png, image/jpeg, image/svg+xml"
                id="logo-upload"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  if (file.size > 10 * 1024 * 1024) {
                    showToast('El archivo es demasiado grande (máximo 10MB)', 'error');
                    return;
                  }
                  
                  const reader = new FileReader();
                  reader.onloadend = async () => {
                    const base64String = reader.result;
                    try {
                      setSaving(true);
                      const res = await fetch('/api/configuracion/logo', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ logo_base64: base64String })
                      });
                      const data = await res.json();
                      if (res.ok) {
                        showToast('Logo actualizado correctamente', 'success');
                        setTimeout(() => window.location.reload(), 1000); // Recargar para actualizar en todo el layout
                      } else {
                        showToast(data.error || 'Error al actualizar logo', 'error');
                      }
                    } catch (err) {
                      showToast('Error de red', 'error');
                    } finally {
                      setSaving(false);
                      e.target.value = ''; // reset input
                    }
                  };
                  reader.readAsDataURL(file);
                }}
              />
              <label 
                htmlFor="logo-upload" 
                className="btn btn-primary" 
                style={{ cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? '⏳ Subiendo...' : '📁 Cambiar Logo'}
              </label>
              <button 
                className="btn btn-secondary" 
                disabled={saving}
                onClick={async () => {
                  if(!confirm('¿Seguro que deseas restablecer el logo al por defecto?')) return;
                  try {
                    setSaving(true);
                    const res = await fetch('/api/configuracion/logo', { method: 'DELETE' });
                    if (res.ok) {
                      showToast('Logo restablecido', 'success');
                      setTimeout(() => window.location.reload(), 1000);
                    } else {
                      showToast('Error al restablecer logo', 'error');
                    }
                  } catch (err) {
                    showToast('Error de red', 'error');
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                🔄 Restablecer
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
