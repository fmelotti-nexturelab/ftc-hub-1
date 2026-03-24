import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

/**
 * Team che richiedono il codice TeamViewer prima della creazione.
 * Aggiungere qui altri team se necessario.
 */
const TEAMVIEWER_TEAMS = ["IT"]

/**
 * TeamSelectModal — popup selezione team con step opzionale TeamViewer.
 *
 * Props:
 *   analysis: { suggested_teams: [{id, name}], all_teams: [{id, name}] }
 *   onSelect: ({ teamId, tvCode }) => void   ← chiamato quando l'utente conferma
 *   onClose: () => void                      ← chiamato su "← Modifica"
 *   isPending: bool
 */
export default function TeamSelectModal({ analysis, onSelect, onClose, isPending }) {
  const [pendingTeam, setPendingTeam] = useState(null)
  const [teamviewerCode, setTeamviewerCode] = useState("")
  const [showAllTeams, setShowAllTeams] = useState(false)

  const suggestedIds = new Set((analysis.suggested_teams || []).map(t => t.id))
  const otherTeams = (analysis.all_teams || []).filter(t => !suggestedIds.has(t.id))

  const handleTeamSelect = (team) => {
    if (TEAMVIEWER_TEAMS.includes(team.name.toUpperCase())) {
      setPendingTeam(team)
      setTeamviewerCode("")
    } else {
      onSelect({ teamId: team.id, tvCode: "" })
    }
  }

  const btnPrimary = "px-4 py-2 bg-[#1e3a5f] hover:bg-[#2563eb] text-white text-sm font-semibold rounded-xl transition disabled:opacity-50"
  const btnSecondary = "px-4 py-2 bg-gray-100 hover:bg-[#1e3a5f] hover:text-white text-gray-700 text-sm font-semibold rounded-xl transition disabled:opacity-50"

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">

        {pendingTeam ? (
          /* ── Step 2: TeamViewer ── */
          <>
            <div>
              <h2 className="text-base font-bold text-gray-800">Codice TeamViewer</h2>
              <p className="text-xs text-gray-400 mt-1">
                Il team <span className="font-semibold text-[#1e3a5f]">{pendingTeam.name}</span> ha
                bisogno del codice TeamViewer per accedere al tuo dispositivo.
              </p>
            </div>
            <input
              type="text"
              value={teamviewerCode}
              onChange={e => setTeamviewerCode(e.target.value)}
              placeholder="Es. 123 456 789"
              autoFocus
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2563eb] focus:border-transparent outline-none transition font-mono tracking-wider"
            />
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setPendingTeam(null)}
                className="text-xs text-gray-400 hover:text-gray-600 transition"
              >
                ← Cambia team
              </button>
              <button
                onClick={() => onSelect({ teamId: pendingTeam.id, tvCode: teamviewerCode })}
                disabled={isPending}
                className={btnPrimary}
              >
                {isPending ? "Creazione..." : "Crea ticket"}
              </button>
            </div>
          </>
        ) : (
          /* ── Step 1: selezione team ── */
          <>
            <div>
              <h2 className="text-base font-bold text-gray-800">A chi vuoi inviare il ticket?</h2>
              <p className="text-xs text-gray-400 mt-1">Seleziona il team di destinazione</p>
            </div>

            {analysis.suggested_teams?.length > 0 ? (
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Suggerito dall'AI
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.suggested_teams.map(team => (
                      <button
                        key={team.id}
                        onClick={() => handleTeamSelect(team)}
                        disabled={isPending}
                        className={btnPrimary}
                      >
                        {team.name}
                      </button>
                    ))}
                  </div>
                </div>

                {otherTeams.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowAllTeams(v => !v)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition"
                    >
                      {showAllTeams ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      Scegli un team diverso
                    </button>
                    {showAllTeams && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {otherTeams.map(team => (
                          <button
                            key={team.id}
                            onClick={() => handleTeamSelect(team)}
                            disabled={isPending}
                            className={btnSecondary}
                          >
                            {team.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-400">Seleziona il team destinatario:</p>
                <div className="flex flex-wrap gap-2">
                  {analysis.all_teams?.map(team => (
                    <button
                      key={team.id}
                      onClick={() => handleTeamSelect(team)}
                      disabled={isPending}
                      className={btnSecondary}
                    >
                      {team.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={onClose}
                className="text-xs text-gray-400 hover:text-gray-600 transition"
              >
                ← Modifica
              </button>
              {isPending && (
                <span className="text-xs text-gray-400">Creazione in corso...</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
