'use client';

import React, { useState, useEffect } from 'react';
import { useToast } from '@/context/ToastContext';
import { useRouter } from 'next/navigation';

export default function AuditoriaPage() {
  const { showToast } = useToast();
  const router = useRouter();
  
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [user, setUser] = useState(null);
  
  const limit = 50;

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (!data.user || data.user.rol !== 'admin') {
          showToast('No tienes permisos para ver esta página.', 'error');
          router.push('/dashboard');
        } else {
          setUser(data.user);
        }
      })
      .catch(console.error);
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const offset = (page - 1) * limit;
      const res = await fetch(`/api/auditoria?limit=${limit}&offset=${offset}`);
      if (res.ok) {
        const json = await res.json();
        setLogs(json.data || []);
        setTotalRecords(json.pagination.totalRecords || 0);
      } else {
        const data = await res.json();
        showToast(data.error || 'Error al cargar los logs', 'error');
      }
    } catch (err) {
      showToast('Error de conexión', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchLogs();
    }
  }, [page, user]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('es-DO');
  };

  if (!user) return <div style={{ padding: '24px' }}>Verificando permisos...</div>;

  const totalPages = Math.ceil(totalRecords / limit) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>Registro de Auditoría</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Historial de acciones críticas en el sistema
        </p>
      </div>

      <section className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: '48px' }}>
            {[...Array(6)].map((_, i) => <div key={i} className="shimmer shimmer-row"></div>)}
          </div>
        ) : logs.length > 0 ? (
          <>
            <div className="table-container" style={{ border: 'none' }}>
              <table className="table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Usuario</th>
                    <th>Acción</th>
                    <th>Tabla</th>
                    <th>ID Registro</th>
                    <th>Detalles</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(log.created_at)}</td>
                      <td>{log.usuario_nombre || 'Sistema'}</td>
                      <td>
                        <span className={`badge ${log.accion === 'INSERT' ? 'badge-success' : log.accion === 'UPDATE' ? 'badge-warning' : 'badge-danger'}`} style={{ backgroundColor: log.accion === 'INSERT' ? '#D1FAE5' : log.accion === 'UPDATE' ? '#FEF3C7' : '#FEE2E2', color: log.accion === 'INSERT' ? '#065F46' : log.accion === 'UPDATE' ? '#92400E' : '#991B1B' }}>
                          {log.accion}
                        </span>
                      </td>
                      <td style={{ fontWeight: 'bold' }}>{log.tabla}</td>
                      <td><code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{log.registro_id}</code></td>
                      <td>
                        <details>
                          <summary style={{ cursor: 'pointer', color: 'var(--primary)' }}>Ver Datos</summary>
                          <div style={{ marginTop: '8px', background: '#f8fafc', padding: '8px', borderRadius: '4px', fontSize: '12px' }}>
                            {log.datos_anteriores && <div><b>Antes:</b> <pre style={{ margin: 0 }}>{JSON.stringify(log.datos_anteriores, null, 2)}</pre></div>}
                            {log.datos_nuevos && <div><b>Después:</b> <pre style={{ margin: 0 }}>{JSON.stringify(log.datos_nuevos, null, 2)}</pre></div>}
                          </div>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination-container">
              <span className="pagination-info">Página <b>{page}</b> de <b>{totalPages}</b> ({totalRecords} registros)</span>
              <div className="pagination-buttons">
                <button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage(p => Math.max(p - 1, 1))}>◀️ Anterior</button>
                <button className="btn btn-secondary" disabled={page === totalPages} onClick={() => setPage(p => Math.min(p + 1, totalPages))}>Siguiente ▶️</button>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No hay registros</div>
            <div className="empty-state-desc">Aún no se han registrado acciones auditables en el sistema.</div>
          </div>
        )}
      </section>
    </div>
  );
}
