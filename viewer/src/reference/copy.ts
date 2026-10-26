/** Fixed German copy for the reference surface. Recorded task text stays outside this file. */
export const copy = {
  skip: 'Zum Inhalt',
  brand: 'TruthLens',
  demo: 'Beispieldaten',
  search: 'Suchen',
  check: '+ Lauf prüfen',
  exportJson: 'JSON exportieren',
  recheck: 'Erneut prüfen',
  runs: 'Übersicht',
  checksTitle: 'Prüfdetails',
  checksBody: 'Was je Anforderung tatsächlich geprüft wurde. Ein Ergebnis ist keine Freigabe.',
  checksEmpty: 'Noch keine geprüfte Anforderung.',
  recordsTitle: 'Nachweise',
  recordsBody: 'Originalverweise und die Integritätsprüfung. Keine Dateigalerie und kein Aufgabenarchiv.',
  recordsEmpty: 'Keine Originalverweise geladen.',
  noRecord: 'Kein Originalverweis',
  developer: 'Entwickleransicht',
  developerBody: 'Technische Ereignisse. Sie sind kein Prüfergebnis.',
  developerEmpty: 'Keine technischen Ereignisse.',
  requirement: 'Anforderung',
  reason: 'Grund',
  doubtful: 'Testqualität zweifelhaft',
  witnessedPass: 'Beobachteter Test',
  witnessedFail: 'Beobachteter Fehlschlag',
  noCriteria: 'Keine Anforderung',
  unwitnessed: 'Ohne Beleg',
  agentsRetired: 'Agenten sind ein Filter in der Übersicht. Diese Ansicht startet und steuert keine Agenten.',
  checks: 'Prüfdetails',
  records: 'Nachweise',
  reports: 'Prüfberichte',
  agents: 'Agenten',
  sources: 'Quellen',
  projects: 'Projekte',
  settings: 'Einstellungen',
  doctor: 'Doctor',
  menu: 'Menü',
  close: 'Schließen',
  allProjects: 'Alle Projekte',
  agentAll: 'Agent: alle',
  statusAll: 'Status: alle',
  range7: 'Letzte 7 Tage',
  range1: 'Letzte 24 Stunden',
  range30: 'Letzte 30 Tage',
  rangeAll: 'Gesamter Zeitraum',
  reset: 'Filter zurücksetzen',
  connect: 'Projekt verbinden',
  sample: 'Beispiel ansehen',
  emptyTitle: 'Noch kein Projekt verbunden',
  emptyBody: 'Verbinde ein Projekt oder sieh dir die gekennzeichneten Beispieldaten an.',
  filteredTitle: 'Keine Läufe für diesen Filter',
  filteredBody: 'Setze den Filter zurück, um alle Läufe im Zeitraum zu sehen.',
  errorTitle: 'Läufe konnten nicht geladen werden',
  errorBody: 'Die Projektion ist fehlgeschlagen. Der letzte Stand bleibt unverändert.',
  retry: 'Erneut versuchen',
  offline: 'Offline · letzter Stand',
  loading: 'Läufe werden geladen',
  intro: 'Jede Agent-Aufgabe, deren Behauptungen geprüft wurden',
  source: 'Quelle',
  unknown: '—',
  noComparison: 'keine Vergleichsdaten',
  runsWindow: 'Läufe (7 Tage)',
  claimsChecked: 'Behauptungen geprüft',
  perRun: 'pro Lauf',
  confirmedRate: 'Bestätigt',
  rateHint: 'TRUE / alle bewerteten Aussagen, UNKNOWN zählt mit',
  notable: 'Auffälligster Agent',
  refutedClaims: 'FALSE',
  noNotable: 'kein eindeutiger Abstand',
  colRun: 'Lauf',
  colTask: 'Aufgabe',
  colAgent: 'Agent',
  colClaims: 'Behauptungen',
  colResult: 'Ergebnis',
  colTime: 'Zeit',
  colVerdict: 'Ergebnis',
  colStatement: 'Behauptung des Agenten',
  colEvidence: 'Beleg',
  colOrigin: 'Quelle',
  confirmed: 'TRUE',
  refuted: 'FALSE',
  unclear: 'UNKNOWN',
  damaged: 'beschädigt',
  damagedTitle: 'Nachweis beschädigt oder inkonsistent',
  damagedBody: 'Bestätigte Aussagen aus diesem Lauf werden nicht angezeigt.',
  integrityHash: 'Hash only · signature not checked',
  integrityHmac: 'HMAC geprüft bei der Projektion',
  integrityUnknown: 'Integrität unbekannt',
  integrityLine: 'Integrität ist keine Freigabe.',
  claims: 'Behauptungen',
  timeline: 'Zeitablauf',
  captured: 'erfasst',
  reported: 'Agentenbericht',
  imported: 'importiert',
  duration: 'Dauer',
  project: 'Projekt',
  today: 'heute',
  page: 'Seite',
  next: 'Weiter',
  previous: 'Zurück',
  newRuns: 'neue Läufe',
  dialogTitle: 'Lauf prüfen',
  dialogBody: 'Wähle einen gespeicherten Lauf oder importiere ein Exportbündel. Eine freie Serverpfadeingabe gibt es hier nicht.',
  pickSaved: 'Gespeicherten Lauf wählen',
  importBundle: 'Export importieren',
  recheckTitle: 'Erneut prüfen',
  recheckBody: 'Das startet eine neue Auditrevision und behält die bisherige. Der Agent wird nicht neu ausgeführt.',
  startRecheck: 'Revision anlegen',
  cancel: 'Abbrechen',
  recheckPending: 'Audit wartet',
  recheckFail: 'Kein Auditdienst verbunden. Die Prüfung wurde nicht gestartet.',
  recheckCli: 'Der echte Audit läuft nur in der CLI: truthlens runs recheck',
  importNote: 'Import ist kein Authentizitätsnachweis. Bestätigte Aussagen ohne Beleg werden abgelehnt.',
  importRejected: 'Dieses Bündel wurde abgelehnt.',
  importOk: 'Import geprüft und als unbestätigt gekennzeichnet.',
  searchTitle: 'Suche',
  searchLabel: 'Projekte, Läufe oder Aufgaben',
  nothingFound: 'Nichts gefunden',
  settingsTitle: 'Einrichtung',
  settingsBody: 'Die Oberfläche zeigt die geplante Workspace-Datei. Schreiben kann nur die lokale CLI, nicht dieser Browser.',
  settingsPlan: 'Geplante Änderung: projektbezogene Adapter-Konfiguration. Live-Aufzeichnung ist nicht qualifiziert.',
  applyHint: 'Zum Anwenden im Projektordner: truthlens workspace init --project NAME --root PATH --harness agent-zero --target local --dry-run',
  agentsTitle: 'Agenten',
  agentsBody: 'Adapter und Verbindungen. Eine Konfigurationsdatei bedeutet nicht, dass die Aufzeichnung läuft.',
  notQualified: 'Nicht qualifiziert',
  notConnected: 'Nicht verbunden',
  manual: 'Manueller Import',
  reportsTitle: 'Prüfberichte',
  reportsBody: 'Auditrevisionen vorhandener Läufe. Ein Bericht ist keine Freigabe.',
  reportsEmpty: 'Noch keine abgeschlossene Auditrevision.',
  sourcesTitle: 'Quellen',
  sourcesBody: 'Registrierte Herkunft und Reader. Kein Dateiexplorer.',
  sourcesEmpty: 'Keine Quelle verbunden.',
  doctorTitle: 'Doctor',
  doctorBody: 'Grün nur für abgeschlossene Prüfungen. Isolation bleibt ungeprüft, bis ein separater Host-Nachweis vorliegt.',
  doctorOk: 'abgeschlossen',
  doctorWarn: 'Warnung',
  doctorBad: 'Fehler',
  doctorIdle: 'nicht geprüft',
  docWorkspace: 'Workspace-Datei ist in diesem Browser nicht geprüft',
  docWorkspaceOk: 'Beispielkatalog gelesen',
  docAdapter: 'Kein qualifizierter Capture-Adapter',
  docHeart: 'Lebenszeichen nicht geprüft',
  docOutput: 'Reader nicht verbunden',
  docAgent: 'Agentenstatus nicht getestet',
  docIsolation: 'Isolation ist nicht geprüft',
  agy: 'agy',
  backRuns: 'Alle Läufe',
  missingRun: 'Lauf nicht gefunden',
  vsPrevious: 'zur Vorwoche',
  average: 'Ø',
  sameWindow: 'Zeitraum und Stichprobe entsprechen dem gewählten Filter.',
  openTimeline: 'Zeitablauf',
  regionTable: 'Lauf-Tabelle',
  navLabel: 'TruthLens',
  mainLabel: 'Inhalt',
} as const

export function relative(from: string, now: string): string {
  const delta = new Date(now).getTime() - new Date(from).getTime()
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (!Number.isFinite(delta)) return copy.unknown
  if (delta < hour) return `vor ${Math.max(1, Math.round(delta / minute))} Min`
  if (delta < day) return `vor ${Math.round(delta / hour)} Std`
  if (delta < 2 * day) return 'gestern'
  return `vor ${Math.round(delta / day)} Tagen`
}

export function when(value: string, now: string): string {
  const day = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit'})
  const current = new Date(value)
  if (Number.isNaN(current.getTime())) return copy.unknown
  if (day.format(current) === day.format(new Date(now))) return `${copy.today} ${clock(value)}`
  return fullStamp(value)
}

export function clock(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return copy.unknown
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin', hourCycle: 'h23',
  }).format(date)
}

export function fullStamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return copy.unknown
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'full', timeStyle: 'long', timeZone: 'Europe/Berlin',
  }).format(date)
}

export function grouped(value: number): string {
  return new Intl.NumberFormat('de-DE').format(value)
}

export function percent(part: number, total: number): string {
  if (total <= 0) return copy.unknown
  return `${Math.round((part / total) * 100)} %`
}

export function tenths(part: number, total: number): string {
  if (total <= 0) return copy.unknown
  const scaled = Math.round((part * 10) / total)
  return `${Math.trunc(scaled / 10)},${Math.abs(scaled % 10)}`
}

export function delta(current: number, previous: number | null | undefined): string {
  if (previous == null || previous <= 0) return copy.noComparison
  const scaled = Math.round(((current - previous) * 1000) / previous)
  const sign = scaled > 0 ? '+' : ''
  return `${sign}${Math.trunc(scaled / 10)},${Math.abs(scaled % 10)} % ${copy.vsPrevious}`
}

export function duration(ms: number | null | undefined): string {
  if (ms == null || ms < 0) return copy.unknown
  const total = Math.floor(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes} Min ${seconds} s`
}
