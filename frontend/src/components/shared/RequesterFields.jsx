/**
 * RequesterFields — sezione "Dati richiedente" riutilizzabile.
 *
 * Props:
 *   values:   { requester_name, requester_phone, requester_email }
 *   onChange: (field, value) => void
 *   defaults: { name, phone, email }  — usati come placeholder dal DB
 */
export default function RequesterFields({ values, onChange, defaults = {} }) {
  const inputClass = "w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition"
  const set = (field) => (e) => onChange(field, e.target.value)

  return (
    <div>
      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Dati richiedente</div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Nome richiedente *</label>
          <input
            type="text"
            value={values.requester_name}
            onChange={set("requester_name")}
            placeholder={defaults.name || "Nome e Cognome"}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Recapito telefonico *</label>
          <input
            type="tel"
            value={values.requester_phone}
            onChange={set("requester_phone")}
            placeholder={defaults.phone || "+39 ..."}
            className={inputClass}
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Email richiedente <span className="font-normal text-gray-500 text-xs">(opzionale)</span>
          </label>
          <input
            type="email"
            value={values.requester_email}
            onChange={set("requester_email")}
            placeholder={defaults.email || "es. mario.rossi@email.com"}
            className={inputClass}
          />
        </div>
      </div>
    </div>
  )
}
