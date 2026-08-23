const normalize = (text = '') =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const has = (text, words) => words.some(word => text.includes(word));

function answer(message) {
  const text = normalize(message);

  if (
    has(text, [
      'wasser',
      'wasserschaden',
      'rohrbruch',
      'tropft',
      'leck',
      'feuchtigkeit',
      'schimmel'
    ])
  ) {
    return `Bei einem Wasser- oder Feuchtigkeitsschaden sollten Sie zuerst prüfen, ob noch aktiv Wasser austritt. Falls möglich, stoppen Sie die Wasserzufuhr und begrenzen Sie weitere Schäden. Dokumentieren Sie die Situation mit Fotos und melden Sie das Anliegen im MORADA-Portal mit der betroffenen Einheit und einer kurzen Beschreibung. Bei starkem Wasseraustritt oder unmittelbarer Gefahr sollten Sie zusätzlich sofort einen geeigneten Notdienst kontaktieren.`;
  }

  if (
    has(text, [
      'feuer',
      'brand',
      'rauch',
      'gasgeruch',
      'gas'
    ])
  ) {
    return `Bei Feuer, Rauch, Gasgeruch oder einer anderen akuten Gefahr verlassen Sie zuerst den Gefahrenbereich und verständigen die zuständigen Notdienste. MORA und das MORADA-Portal dienen anschliessend zur Dokumentation und weiteren Koordination.`;
  }

  if (
    has(text, [
      'dokument',
      'mietvertrag',
      'vertrag',
      'protokoll',
      'abrechnung',
      'mieterspiegel'
    ])
  ) {
    return `Ihre Unterlagen finden Sie im Bereich „Dokumente“. Dort können beispielsweise Mietverträge, Übergabeprotokolle, Abrechnungen und weitere Objektunterlagen hinterlegt werden. Falls ein bestimmtes Dokument fehlt, können Sie über „Service“ eine Anfrage an MORADA erfassen.`;
  }

  if (
    has(text, [
      'anliegen',
      'melden',
      'schaden',
      'reparatur',
      'handwerker',
      'auftrag',
      'defekt',
      'kaputt'
    ])
  ) {
    return `Öffnen Sie in der MORADA-App den Bereich „Service“. Beschreiben Sie möglichst genau, was passiert ist, welche Einheit betroffen ist und seit wann das Problem besteht. Bei einem Schaden können zusätzlich Fotos hilfreich sein. MORADA kann danach die weitere Bearbeitung und gegebenenfalls die Koordination eines Handwerkers übernehmen.`;
  }

  if (
    has(text, [
      'immobilie',
      'liegenschaft',
      'portfolio',
      'wohnung',
      'einheit',
      'leerstand',
      'vermietet',
      'mieteinnahmen',
      'miete'
    ])
  ) {
    return `Im Bereich „Portfolio“ finden Sie eine Übersicht Ihrer Immobilie beziehungsweise Liegenschaft. Dort können unter anderem Einheiten, Vermietungsstatus, offene Anliegen, Dokumente und wichtige Kennzahlen zusammengeführt werden. Die derzeit angezeigten Werte dienen noch als Demo.`;
  }

  if (
    has(text, [
      'walkthrough',
      '360',
      'rundgang',
      'virtuell',
      'begehen'
    ])
  ) {
    return `Der 360° WalkThrough ermöglicht einen virtuellen Rundgang durch die Immobilie. Sie können sich innerhalb der Räume umsehen und zwischen verschiedenen Positionen wechseln. Der Rundgang soll direkt bei der jeweiligen Immobilie im MORADA-Portal verfügbar sein.`;
  }

  if (
    has(text, [
      'ubergabe',
      'übergabe',
      'abnahme',
      'einzug',
      'auszug',
      'schlussel',
      'schlüssel'
    ])
  ) {
    return `Bei einer Wohnungsübergabe oder -abnahme werden unter anderem der Zustand der Räume, Zählerstände, Schlüssel und allfällige Mängel dokumentiert. MORADA kann die Durchführung und administrative Abwicklung begleiten. Das fertige Protokoll kann anschliessend im Portal abgelegt werden.`;
  }

  if (
    has(text, [
      'login',
      'einloggen',
      'profil',
      'konto',
      'passwort',
      'app',
      'portal'
    ])
  ) {
    return `Das MORADA-Kundenportal bündelt Ihre Immobilie, Dokumente, Serviceanliegen, den 360° WalkThrough und MORA an einem Ort. Später erhält jeder Kunde einen persönlichen Zugang und sieht ausschliesslich die für ihn freigegebenen Daten.`;
  }

  if (
    has(text, [
      'kontakt',
      'erreichen',
      'telefon',
      'email',
      'schreiben'
    ])
  ) {
    return `Sie können MORADA über den Service- beziehungsweise Kontaktbereich des Portals erreichen. Dort können später auch direkte Kontaktdaten und die zuständige Betreuung angezeigt werden.`;
  }

  if (
    has(text, [
      'recht',
      'gesetz',
      'kündigung',
      'kundigung',
      'mietrecht',
      'steuer',
      'haftung'
    ])
  ) {
    return `Ich kann allgemeine Informationen zu Immobilien- und Mietthemen geben, aber keine verbindliche Rechts- oder Steuerberatung ersetzen. Bei wichtigen rechtlichen oder finanziellen Entscheidungen sollte der konkrete Fall fachlich geprüft werden.`;
  }

  if (
    has(text, [
      'hallo',
      'guten tag',
      'guten morgen',
      'hey',
      'hi'
    ])
  ) {
    return `Guten Tag. Ich bin MORA, der digitale Assistent von MORADA Immobilien. Sie können mich unter anderem zu Dokumenten, Schäden, Handwerkern, Übergaben, Ihrer Immobilie oder zum 360° WalkThrough fragen.`;
  }

  return `Ich kann Ihre Frage in dieser kostenlosen Testversion noch nicht sicher genug zuordnen. Fragen Sie mich beispielsweise zu Dokumenten, Schäden, Handwerkern, Übergaben, Ihrer Immobilie, dem Portfolio oder dem 360° WalkThrough.`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Nur POST-Anfragen sind erlaubt.'
    });
  }

  const message =
    typeof req.body?.message === 'string'
      ? req.body.message.trim()
      : '';

  if (!message) {
    return res.status(400).json({
      error: 'Bitte geben Sie eine Nachricht ein.'
    });
  }

  return res.status(200).json({
    reply: answer(message)
  });
}
