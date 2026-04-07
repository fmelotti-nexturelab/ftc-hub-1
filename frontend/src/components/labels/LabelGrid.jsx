import LabelCell from "./LabelCell"

const ITEMS_PER_PAGE = { large: 9, small: 21 }

/**
 * Griglia etichette paginata per stampa.
 * Props: items (array arricchiti, gia' espansi per copie), format ("large"|"small")
 */
export default function LabelGrid({ items, format }) {
  const perPage = ITEMS_PER_PAGE[format]
  const pageClass = format === "large" ? "label-page-large" : "label-page-small"

  // Dividi in pagine
  const pages = []
  for (let i = 0; i < items.length; i += perPage) {
    pages.push(items.slice(i, i + perPage))
  }

  // Se non ci sono items, almeno una pagina vuota
  if (pages.length === 0) return null

  return (
    <>
      {pages.map((pageItems, pi) => (
        <div key={pi} className={pageClass}>
          {pageItems.map((item, ci) => (
            <LabelCell key={`${pi}-${ci}`} item={item} format={format} />
          ))}
          {/* Riempi celle vuote per completare la griglia */}
          {Array.from({ length: perPage - pageItems.length }).map((_, ei) => (
            <div key={`empty-${pi}-${ei}`} className="label-cell-empty" />
          ))}
        </div>
      ))}
    </>
  )
}
