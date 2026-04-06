import logoTiger from "@/assets/logo-tiger.png"

export default function Home() {
  return (
    <div className="relative flex flex-col min-h-[80vh] -m-6 p-6" style={{ background: "linear-gradient(180deg, #efefef 0%, #F7F7F7 15%, #F7F7F7 85%, #efefef 100%)" }}>
      {/* Metà superiore — Flying Tiger */}
      <div className="flex-1 flex items-end justify-center pb-4">
        <img src={logoTiger} alt="Flying Tiger Copenhagen" className="h-[312px]" />
      </div>

      {/* Centro — messaggio lampeggiante con effetto tubo */}
      <div className="flex items-center justify-center py-3 -mx-6 px-6" style={{ background: "linear-gradient(180deg, #e8e8e8 0%, #f2f2f2 50%, #e8e8e8 100%)", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06), inset 0 -1px 2px rgba(0,0,0,0.06)" }}>
        <p className="text-lg text-gray-400 animate-pulse">
          Seleziona una sezione dal menu laterale
        </p>
      </div>

      {/* Spazio inferiore */}
      <div className="flex-1" />


      {/* Riga inferiore */}
      <div className="border-b -mx-6 -mb-6" style={{ borderColor: "#ebebeb" }} />
    </div>
  )
}
