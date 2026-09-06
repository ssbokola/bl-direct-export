/**
 * Historique des BL exportés — nouveau dans la refonte, propre à ce poste
 * (localStorage, pas partagé comme la mémoire "déjà vu" de settings.js : un
 * historique partagé mélangerait les BL de plusieurs officines/postes sans
 * qu'on sache lequel a réellement produit quel export).
 *
 * Ne garde que le récapitulatif de chaque BL (voir HomeScreen/ArchiveScreen)
 * — pas le détail ligne à ligne, qui n'apporterait rien une fois le fichier
 * déjà téléchargé.
 */

const KEY = 'bl-direct-export:history'
const MAX_ENTRIES = 200

const MOIS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

export function loadHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem(KEY, JSON.stringify(history.slice(0, MAX_ENTRIES)))
  } catch {
    // Storage plein/indisponible — l'historique est un confort, pas un impératif.
  }
}

/** Ajoute une entrée en tête d'historique et persiste. Renvoie le nouvel historique. */
export function addHistoryEntry(current, entry) {
  const now = new Date()
  const withDate = {
    ...entry,
    id: entry.id || `${now.getTime()}`,
    date: now.toLocaleDateString('fr-FR'),
    mois: `${MOIS_FR[now.getMonth()]} ${now.getFullYear()}`,
  }
  const next = [withDate, ...current]
  saveHistory(next)
  return next
}
