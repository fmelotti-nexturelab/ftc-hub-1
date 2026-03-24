"""
Anonimizzazione PII per testo inviato a provider AI esterni.

Sostituisce dati personali strutturati con placeholder univoci prima
di inviare il testo all'AI, e li ripristina nella risposta finale.

Pattern coperti:
  - Email
  - Codice fiscale italiano (16 caratteri)
  - IBAN italiano
  - Partita IVA (11 cifre, opzionalmente precedute da "P.IVA")
  - Numeri di telefono italiani (fisso e mobile, con/senza +39)
  - Numeri di carta di credito (formato 4×4 cifre)
"""
import re


_RULES: list[tuple[str, re.Pattern]] = [
    # Email — deve stare prima di IBAN/CF per non fare match parziali
    ("EMAIL", re.compile(
        r'\b[\w.+\-]+@[\w\-]+\.[\w.]+\b',
        re.IGNORECASE,
    )),
    # Codice fiscale italiano (esattamente 16 char: 6L-2N-1L-2N-1L-3N-1L)
    ("CF", re.compile(
        r'\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b',
        re.IGNORECASE,
    )),
    # IBAN italiano (IT + 2 cifre + 1 lettera + 10 cifre + 12 alfanumerici)
    ("IBAN", re.compile(
        r'\bIT\d{2}[A-Z]\d{10}[A-Z0-9]{12}\b',
        re.IGNORECASE,
    )),
    # Carta di credito (4 gruppi da 4 cifre, separati da spazio o trattino)
    ("CARTA", re.compile(
        r'\b(?:\d{4}[\s\-]?){3}\d{4}\b',
    )),
    # Telefono italiano: mobile (3xx) o fisso (0x...), con opzionale +39
    ("TEL", re.compile(
        r'\b(?:\+39[\s\-]?)?(?:0\d{1,3}[\s\-]?\d{4,8}|3\d{2}[\s\-]?\d{6,7})\b',
    )),
    # Partita IVA: 11 cifre, opzionalmente precedute da "P.IVA" / "PI" / "PIVA"
    ("PIVA", re.compile(
        r'\b(?:P\.?\s*IVA:?\s*|PI:?\s*)?\d{11}\b',
        re.IGNORECASE,
    )),
]


class Anonymizer:
    """
    Istanza per una singola richiesta AI.

    Uso:
        anon = Anonymizer()
        safe_text = anon.anonymize(original_text)
        # ... chiama AI con safe_text ...
        restored = anon.rehydrate(ai_response)
    """

    def __init__(self) -> None:
        self._map: dict[str, str] = {}   # placeholder → valore originale
        self._seen: dict[str, str] = {}  # valore originale → placeholder

    def anonymize(self, text: str) -> str:
        """Sostituisce PII con placeholder e memorizza la corrispondenza."""
        for label, pattern in _RULES:
            text = pattern.sub(lambda m: self._replace(m.group(0), label), text)
        return text

    def rehydrate(self, text: str) -> str:
        """Ripristina i valori originali nei placeholder presenti nel testo."""
        for placeholder, original in self._map.items():
            text = text.replace(placeholder, original)
        return text

    def _replace(self, original: str, label: str) -> str:
        normalized = original.strip()
        if normalized in self._seen:
            return self._seen[normalized]
        idx = sum(1 for ph in self._map if ph.startswith(f"[{label}"))
        placeholder = f"[{label}]" if idx == 0 else f"[{label}_{idx}]"
        self._map[placeholder] = normalized
        self._seen[normalized] = placeholder
        return placeholder
