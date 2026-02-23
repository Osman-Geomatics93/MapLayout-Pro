/**
 * MapLayout Pro — Internationalization (i18n)
 * Provides translations for key UI elements.
 */

export type Locale = 'en' | 'ar' | 'fr' | 'es';

export interface TranslationStrings {
  // Toolbar
  export: string;
  save: string;
  load: string;
  undo: string;
  redo: string;
  darkMode: string;
  shortcuts: string;
  about: string;

  // Left panel sections
  areaOfInterest: string;
  layers: string;
  importData: string;
  layoutFields: string;
  layoutElements: string;
  legendEntries: string;
  logoImage: string;
  customText: string;
  drawingTools: string;
  pageTemplate: string;
  boundaryColors: string;

  // Fields
  title: string;
  subtitle: string;
  author: string;
  date: string;

  // Actions
  clear: string;
  rectangle: string;
  refresh: string;
  resetPositions: string;
  addImage: string;
  addEntry: string;
  populateFromLayers: string;
  clearCustom: string;

  // Status
  ready: string;
  rendering: string;
  selectArea: string;
  projectSaved: string;
  exportDone: string;

  // Elements
  northArrow: string;
  scaleBar: string;
  legend: string;
  coordinateGrid: string;

  // Export
  format: string;
  allFormats: string;
  dpi: string;
}

const en: TranslationStrings = {
  export: 'Export',
  save: 'Save',
  load: 'Load',
  undo: 'Undo',
  redo: 'Redo',
  darkMode: 'Dark Mode',
  shortcuts: 'Shortcuts',
  about: 'About',

  areaOfInterest: 'Area of Interest',
  layers: 'Layers',
  importData: 'Import Data',
  layoutFields: 'Layout Fields',
  layoutElements: 'Layout Elements',
  legendEntries: 'Legend Entries',
  logoImage: 'Logo / Image',
  customText: 'Custom Text',
  drawingTools: 'Drawing Tools',
  pageTemplate: 'Page & Template',
  boundaryColors: 'Boundary Colors',

  title: 'Title',
  subtitle: 'Subtitle',
  author: 'Author',
  date: 'Date',

  clear: 'Clear',
  rectangle: 'Rectangle',
  refresh: 'Refresh',
  resetPositions: 'Reset Positions',
  addImage: '+ Add Image',
  addEntry: '+ Add Entry',
  populateFromLayers: 'Populate from Layers',
  clearCustom: 'Clear Custom',

  ready: 'Ready. Click a country on the map.',
  rendering: 'Rendering layout preview...',
  selectArea: 'Click a country to select it as your study area',
  projectSaved: 'Project saved!',
  exportDone: 'Export complete!',

  northArrow: 'North Arrow',
  scaleBar: 'Scale Bar',
  legend: 'Legend',
  coordinateGrid: 'Coordinate Grid',

  format: 'Format',
  allFormats: 'All',
  dpi: 'DPI',
};

const ar: TranslationStrings = {
  export: 'تصدير',
  save: 'حفظ',
  load: 'تحميل',
  undo: 'تراجع',
  redo: 'إعادة',
  darkMode: 'الوضع الداكن',
  shortcuts: 'اختصارات',
  about: 'حول',

  areaOfInterest: 'منطقة الاهتمام',
  layers: 'الطبقات',
  importData: 'استيراد البيانات',
  layoutFields: 'حقول التخطيط',
  layoutElements: 'عناصر التخطيط',
  legendEntries: 'مفتاح الخريطة',
  logoImage: 'شعار / صورة',
  customText: 'نص مخصص',
  drawingTools: 'أدوات الرسم',
  pageTemplate: 'الصفحة والقالب',
  boundaryColors: 'ألوان الحدود',

  title: 'العنوان',
  subtitle: 'العنوان الفرعي',
  author: 'المؤلف',
  date: 'التاريخ',

  clear: 'مسح',
  rectangle: 'مستطيل',
  refresh: 'تحديث',
  resetPositions: 'إعادة تعيين المواضع',
  addImage: '+ إضافة صورة',
  addEntry: '+ إضافة عنصر',
  populateFromLayers: 'ملء من الطبقات',
  clearCustom: 'مسح المخصص',

  ready: 'جاهز. انقر على دولة على الخريطة.',
  rendering: 'جاري تحضير المعاينة...',
  selectArea: 'انقر على دولة لتحديدها كمنطقة دراسة',
  projectSaved: 'تم حفظ المشروع!',
  exportDone: 'اكتمل التصدير!',

  northArrow: 'سهم الشمال',
  scaleBar: 'مقياس الرسم',
  legend: 'مفتاح الخريطة',
  coordinateGrid: 'شبكة الإحداثيات',

  format: 'الصيغة',
  allFormats: 'الكل',
  dpi: 'DPI',
};

const fr: TranslationStrings = {
  export: 'Exporter',
  save: 'Sauvegarder',
  load: 'Charger',
  undo: 'Annuler',
  redo: 'Rétablir',
  darkMode: 'Mode sombre',
  shortcuts: 'Raccourcis',
  about: 'À propos',

  areaOfInterest: "Zone d'intérêt",
  layers: 'Couches',
  importData: 'Importer des données',
  layoutFields: 'Champs de mise en page',
  layoutElements: 'Éléments de mise en page',
  legendEntries: 'Entrées de légende',
  logoImage: 'Logo / Image',
  customText: 'Texte personnalisé',
  drawingTools: 'Outils de dessin',
  pageTemplate: 'Page et modèle',
  boundaryColors: 'Couleurs des limites',

  title: 'Titre',
  subtitle: 'Sous-titre',
  author: 'Auteur',
  date: 'Date',

  clear: 'Effacer',
  rectangle: 'Rectangle',
  refresh: 'Actualiser',
  resetPositions: 'Réinitialiser',
  addImage: '+ Ajouter image',
  addEntry: '+ Ajouter entrée',
  populateFromLayers: 'Remplir depuis les couches',
  clearCustom: 'Effacer personnalisé',

  ready: 'Prêt. Cliquez sur un pays sur la carte.',
  rendering: 'Rendu de l\'aperçu...',
  selectArea: 'Cliquez sur un pays pour le sélectionner',
  projectSaved: 'Projet sauvegardé !',
  exportDone: 'Exportation terminée !',

  northArrow: 'Flèche du Nord',
  scaleBar: 'Barre d\'échelle',
  legend: 'Légende',
  coordinateGrid: 'Grille de coordonnées',

  format: 'Format',
  allFormats: 'Tous',
  dpi: 'PPP',
};

const es: TranslationStrings = {
  export: 'Exportar',
  save: 'Guardar',
  load: 'Cargar',
  undo: 'Deshacer',
  redo: 'Rehacer',
  darkMode: 'Modo oscuro',
  shortcuts: 'Atajos',
  about: 'Acerca de',

  areaOfInterest: 'Área de interés',
  layers: 'Capas',
  importData: 'Importar datos',
  layoutFields: 'Campos del diseño',
  layoutElements: 'Elementos del diseño',
  legendEntries: 'Entradas de leyenda',
  logoImage: 'Logo / Imagen',
  customText: 'Texto personalizado',
  drawingTools: 'Herramientas de dibujo',
  pageTemplate: 'Página y plantilla',
  boundaryColors: 'Colores de límites',

  title: 'Título',
  subtitle: 'Subtítulo',
  author: 'Autor',
  date: 'Fecha',

  clear: 'Limpiar',
  rectangle: 'Rectángulo',
  refresh: 'Actualizar',
  resetPositions: 'Restablecer posiciones',
  addImage: '+ Agregar imagen',
  addEntry: '+ Agregar entrada',
  populateFromLayers: 'Rellenar desde capas',
  clearCustom: 'Limpiar personalizado',

  ready: 'Listo. Haz clic en un país en el mapa.',
  rendering: 'Renderizando vista previa...',
  selectArea: 'Haz clic en un país para seleccionarlo',
  projectSaved: '¡Proyecto guardado!',
  exportDone: '¡Exportación completa!',

  northArrow: 'Flecha del Norte',
  scaleBar: 'Barra de escala',
  legend: 'Leyenda',
  coordinateGrid: 'Cuadrícula de coordenadas',

  format: 'Formato',
  allFormats: 'Todos',
  dpi: 'PPP',
};

export const LOCALES: Record<Locale, TranslationStrings> = { en, ar, fr, es };

let currentLocale: Locale = 'en';

export function setLocale(locale: Locale): void {
  currentLocale = locale;
  localStorage.setItem('maplayout-locale', locale);
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: keyof TranslationStrings): string {
  return LOCALES[currentLocale][key] || LOCALES.en[key] || key;
}

export function initLocale(): Locale {
  const saved = localStorage.getItem('maplayout-locale') as Locale | null;
  const locale = saved && LOCALES[saved] ? saved : 'en';
  setLocale(locale);
  return locale;
}

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
  fr: 'Français',
  es: 'Español',
};
