import { useNavigate } from "react-router-dom"

export default function Unauthorized() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-6">
      <div className="text-6xl mb-4">🔒</div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Accesso non autorizzato</h1>
      <p className="text-gray-500 mb-6">Non hai i permessi per visualizzare questa pagina.</p>
      <button
        onClick={() => navigate(-1)}
        className="px-6 py-2 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#2563eb] transition"
      >
        Torna indietro
      </button>
    </div>
  )
}
