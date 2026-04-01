import logoTiger from "@/assets/logo-tiger.png"
import nlabIcon from "@/assets/nlab-icon.png"

export default function Home() {
  return (
    <div className="flex flex-col min-h-[80vh] -m-6 p-6" style={{ backgroundColor: "#F7F7F7" }}>
      {/* Metà superiore — Flying Tiger */}
      <div className="flex-1 flex items-end justify-center pb-4">
        <img src={logoTiger} alt="Flying Tiger Copenhagen" className="h-[312px]" />
      </div>

      {/* Centro — messaggio lampeggiante */}
      <div className="flex items-center justify-center py-2">
        <p className="text-lg text-gray-400 animate-pulse">
          Seleziona una sezione dal menu laterale
        </p>
      </div>

      {/* Metà inferiore — NextureLab icon + testi */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <img src={nlabIcon} alt="NextureLab" className="h-40" />
        <a href="https://www.nexturelab.com" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-gray-500 transition -mt-14">
          www.nexturelab.com
        </a>
        <span className="text-xs text-gray-300 tracking-widest -mt-0.5">software factory</span>
      </div>
    </div>
  )
}
