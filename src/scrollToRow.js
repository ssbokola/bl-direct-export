/**
 * Ramène une ligne au centre du cadre défilant. Calculé nous-mêmes plutôt
 * que `scrollIntoView`, qui déplacerait aussi les conteneurs parents et
 * ferait sauter la page entière. Le cadre porte `data-scroller`, chaque
 * ligne `data-row={idx}` (voir WorkTable.jsx).
 */
export function scrollToRow(idx) {
  const row = document.querySelector(`[data-row="${idx}"]`)
  const box = document.querySelector('[data-scroller]')
  if (row && box) box.scrollTop = Math.max(0, row.offsetTop - box.clientHeight / 2)
}
