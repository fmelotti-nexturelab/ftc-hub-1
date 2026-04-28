import { useEffect, useRef } from "react"
import JsBarcode from "jsbarcode"

// Formatta net_weight (in kg) come stringa leggibile: 0.5 → "500 g", 1.5 → "1,5 kg"
function formatNetWeight(netWeight) {
  if (!netWeight || netWeight <= 0) return null
  if (netWeight < 1) return `${Math.round(netWeight * 1000)} g`
  return `${netWeight.toLocaleString("it-IT", { maximumFractionDigits: 3 })} kg`
}

// Calcola prezzo unitario EU (EUR X/L o EUR X/KG) da stringa misura (es. "500 ml", "40 g")
function calcUnitPrice(price, measureStr) {
  if (!price || !measureStr) return null
  const m = String(measureStr).trim().match(/^([\d,.]+)\s*(ml|cl|dl|l|g|kg)$/i)
  if (!m) return null
  const amount = parseFloat(m[1].replace(",", "."))
  if (!amount || amount <= 0) return null
  const unit = m[2].toLowerCase()
  let base, label
  switch (unit) {
    case "ml": base = amount / 1000; label = "L"; break
    case "cl": base = amount / 100;  label = "L"; break
    case "dl": base = amount / 10;   label = "L"; break
    case "l":  base = amount;        label = "L"; break
    case "g":  base = amount / 1000; label = "KG"; break
    case "kg": base = amount;        label = "KG"; break
    default: return null
  }
  return `EUR ${Math.round(price / base)}/${label}`
}

/**
 * Layout etichetta (dal PDF reference):
 *
 * ┌────────────────────────────────────┐
 * │ Acqua Naturale              badge  │  desc (bold)
 * │ 500 ml                             │  desc2 (light)
 * │ Food                               │  categoria (light)
 * │                                    │
 * │                          1€        │  prezzo (enorme, allineato DX)
 * │                                    │
 * │ ||||BARCODE||||  2401060  EUR 2/L  │  barcode + codice + kgl
 * └────────────────────────────────────┘
 */
export default function LabelCell({ item, format }) {
  const barcodeRef = useRef(null)

  useEffect(() => {
    if (item.barcode && barcodeRef.current) {
      try {
        const isLarge = format === "large"
        JsBarcode(barcodeRef.current, item.barcode, {
          format: "CODE128",
          width: isLarge ? 0.8 : 0.6,
          height: isLarge ? 15 : 10,
          displayValue: false,
          margin: 0,
          background: "transparent",
        })
      } catch { /* barcode non valido */ }
    }
  }, [item.barcode, format])

  // Prezzo formattato: 1,00→1  0,50→0,5  1,25→1,25
  const priceDisplay = (() => {
    if (item.ecc_testo_prezzo) return item.ecc_testo_prezzo
    if (item.effective_price == null) return ""
    const v = item.effective_price
    if (v === Math.floor(v)) return `${Math.floor(v)}\u20AC`
    const s = v.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    // Rimuovi zero finale dopo la virgola: 0,50→0,5  ma 1,25 resta 1,25
    const cleaned = s.replace(/0$/, "")
    return `${cleaned}\u20AC`
  })()

  const desc2 = item.description2 || formatNetWeight(item.net_weight) || ""
  const unitPrice = calcUnitPrice(item.effective_price, desc2)

  return (
    <div className="label-cell">
      {/* ── TOP: 3 righe descrizione a sinistra + badge a destra ── */}
      <div className="label-top">
        <div className="label-top-left">
          <div className="label-desc-row1">{item.description}</div>
          <div className="label-desc-row2">{desc2 || "\u00A0"}</div>
          <div className="label-desc-row3">{item.category || "\u00A0"}</div>
        </div>
        <div className="label-top-right">
          {item.is_bestseller && (
            <span className="label-badge-bs">Best<br />seller</span>
          )}
        </div>
      </div>

      {/* ── MIDDLE: prezzo allineato a destra ── */}
      <div className="label-price-area">
        <div className="label-price">{priceDisplay}</div>
      </div>

      {/* ── BOTTOM: barcode | EUR x/L | codice articolo ── */}
      <div className="label-footer">
        <div className="label-barcode">
          {item.barcode ? <svg ref={barcodeRef} /> : null}
        </div>
        <div className="label-kgl">{unitPrice || "\u00A0"}</div>
        <div className="label-zebra">{item.zebra}</div>
      </div>
    </div>
  )
}
