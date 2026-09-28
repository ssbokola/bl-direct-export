/** Un BL vide, prêt à recevoir un fichier — un seul à l'ouverture de
 * l'import (App.jsx, makeInitialImportData), un de plus par "+ Ajouter un
 * BL" (Step1Import.jsx, handleAddDocument). Séparé de Step1Import.jsx : une
 * fonction utilitaire dans un fichier de composants casse le Fast Refresh. */
export function makeEmptyDocument(id) {
  return { id, pdfFile: null, blProducts: [], invoiceNumber: '', orderNumber: '', blNumber: '', supplierName: '' }
}
