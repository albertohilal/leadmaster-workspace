import { useEffect, useState } from 'react';
import { senderAPI } from '../../services/api';

const DAYS = [
  { key: 'mon', label: 'Lun' },
  { key: 'tue', label: 'Mar' },
  { key: 'wed', label: 'Mié' },
  { key: 'thu', label: 'Jue' },
  { key: 'fri', label: 'Vie' },
  { key: 'sat', label: 'Sáb' },
  { key: 'sun', label: 'Dom' }
];

export default function ProgramacionesForm() {
  const [campanias, setCampanias] = useState([]);
  const [form, setForm] = useState({
    campania_id: '',
    dias_semana: [],
    hora_inicio: '09:00:00',
    hora_fin: '13:00:00',
    cupo_diario: 50,
    fecha_inicio: '',
    fecha_fin: '',
    comentario: ''
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    senderAPI.getCampaigns()
      .then((res) => setCampanias(res.data || []))
      .catch(() => setCampanias([]));
  }, []);

  const toggleDay = (key) => {
    setForm((f) => {
      const has = f.dias_semana.includes(key);
      return {
        ...f,
        dias_semana: has ? f.dias_semana.filter((d) => d !== key) : [...f.dias_semana, key]
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setErrors({});
    // Validaciones básicas
    const errs = {};
    if (!form.campania_id) errs.campania_id = 'Selecciona una campaña';
    if (!form.fecha_inicio) errs.fecha_inicio = 'Selecciona fecha de inicio';
    if (!form.dias_semana.length) errs.dias_semana = 'Selecciona al menos un día';
    if (!form.hora_inicio) errs.hora_inicio = 'Ingresa hora de inicio';
    if (!form.hora_fin) errs.hora_fin = 'Ingresa hora de fin';
    if (Number(form.cupo_diario) <= 0) errs.cupo_diario = 'El cupo debe ser mayor a 0';
    if (Object.keys(errs).length) {
      setErrors(errs);
      setSaving(false);
      return;
    }
    try {
      const payload = {
        ...form,
        fecha_fin: form.fecha_fin || null,
        cupo_diario: Number(form.cupo_diario)
      };
      const res = await senderAPI.createProgramacion(payload);
      if (res?.data?.success) {
        setMessage('Programación creada correctamente.');
        setForm({
          campania_id: '',
          dias_semana: [],
          hora_inicio: '09:00:00',
          hora_fin: '13:00:00',
          cupo_diario: 50,
          fecha_inicio: '',
          fecha_fin: '',
          comentario: ''
        });
      } else {
        setMessage('No se pudo crear la programación.');
      }
    } catch (err) {
      setMessage('Error al crear programación.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm border">
      <h3 className="text-lg font-semibold mb-6">Nueva Programación</h3>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1">Campaña</label>
          <select
            className="w-full border rounded p-2"
            value={form.campania_id}
            onChange={(e) => setForm((f) => ({ ...f, campania_id: e.target.value }))}
          >
            <option value="">Selecciona campaña</option>
            {campanias.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
          {errors.campania_id && <p className="text-red-600 text-xs mt-1">{errors.campania_id}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Días de la semana</label>
          <div className="flex gap-2 flex-wrap">
            {DAYS.map((d) => (
              <label key={d.key} className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={form.dias_semana.includes(d.key)}
                  onChange={() => toggleDay(d.key)}
                />
                <span>{d.label}</span>
              </label>
            ))}
          </div>
          {errors.dias_semana && <p className="text-red-600 text-xs mt-1">{errors.dias_semana}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Hora inicio</label>
            <input
              type="time"
              step="1"
              className="w-full border rounded p-2"
              value={form.hora_inicio}
              onChange={(e) => setForm((f) => ({ ...f, hora_inicio: e.target.value + (e.target.value.length === 5 ? ':00' : '') }))}
            />
            {errors.hora_inicio && <p className="text-red-600 text-xs mt-1">{errors.hora_inicio}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Hora fin</label>
            <input
              type="time"
              step="1"
              className="w-full border rounded p-2"
              value={form.hora_fin}
              onChange={(e) => setForm((f) => ({ ...f, hora_fin: e.target.value + (e.target.value.length === 5 ? ':00' : '') }))}
            />
            {errors.hora_fin && <p className="text-red-600 text-xs mt-1">{errors.hora_fin}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Cupo diario</label>
            <input
              type="number"
              min={1}
              className="w-full border rounded p-2"
              value={form.cupo_diario}
              onChange={(e) => setForm((f) => ({ ...f, cupo_diario: e.target.value }))}
            />
            {errors.cupo_diario && <p className="text-red-600 text-xs mt-1">{errors.cupo_diario}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Fecha inicio</label>
            <input
              type="date"
              className="w-full border rounded p-2"
              value={form.fecha_inicio}
              onChange={(e) => setForm((f) => ({ ...f, fecha_inicio: e.target.value }))}
            />
            {errors.fecha_inicio && <p className="text-red-600 text-xs mt-1">{errors.fecha_inicio}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Fecha fin (opcional)</label>
            <input
              type="date"
              className="w-full border rounded p-2"
              value={form.fecha_fin}
              onChange={(e) => setForm((f) => ({ ...f, fecha_fin: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Comentario</label>
            <input
              type="text"
              className="w-full border rounded p-2"
              value={form.comentario}
              onChange={(e) => setForm((f) => ({ ...f, comentario: e.target.value }))}
              placeholder="Preferencias, notas para admin, etc."
            />
          </div>
        </div>

        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          disabled={saving}
        >
          {saving ? 'Guardando...' : 'Crear Programación'}
        </button>

        {message && <p className="text-sm mt-2">{message}</p>}
      </form>
    </div>
  );
}