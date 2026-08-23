const SYSTEM_PROMPT = `
Du bist MORA, der digitale Assistent von MORADA Immobilien.

Deine Aufgabe:
- Unterstütze Eigentümer und Mieter bei allgemeinen Fragen zu Immobilien, Vermietung, Übergaben, Dokumenten, Schäden, Handwerkerkoordination und dem MORADA-Kundenportal.
- Verstehe auch komplizierte, unvollständige oder umgangssprachliche Sätze.
- Antworte standardmässig auf Deutsch, klar, professionell und freundlich.
- Stelle gezielte Rückfragen, wenn für eine sinnvolle Antwort Informationen fehlen.
- Erfinde niemals konkrete Kundendaten, Termine, Dokumente, Auftragsstände oder Immobilieninformationen.
- Behaupte nicht, dass du einen Schaden, Auftrag, Termin oder eine Nachricht tatsächlich erfasst hast, solange keine entsprechende Backend-Funktion existiert.
- Bei dringenden Gefahren wie Feuer, starkem Wasseraustritt, Gasgeruch oder akuter Personengefahr sollst du zuerst zu angemessenen Sofortmassnahmen bzw. lokalen Notdiensten raten.
- Gib bei rechtlichen oder finanziellen Fragen keine verbindliche Rechts- oder Steuerberatung. Erkläre allgemeine Informationen und weise bei Bedarf darauf hin, dass eine fachliche Prüfung sinnvoll ist.
- Halte Antworten für den Chat meistens kompakt, ausser die Frage verlangt eine ausführlichere Erklärung.
`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Nur POST-Anfragen sind erlaubt.' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'OPENAI_API_KEY fehlt noch in den Vercel Environment Variables.'
    });
  }

  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message) {
    return res.status(400).json({ error: 'Bitte geben Sie eine Nachricht ein.' });
  }

  if (message.length > 8000) {
    return res.status(400).json({ error: 'Die Nachricht ist zu lang.' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5.6',
        instructions: SYSTEM_PROMPT,
        input: message,
        max_output_tokens: 700
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenAI API error:', data);
      return res.status(502).json({
        error: 'MORA konnte die KI-Antwort gerade nicht laden.'
      });
    }

    let reply = data.output_text;

    if (!reply && Array.isArray(data.output)) {
      const texts = [];
      for (const item of data.output) {
        if (!Array.isArray(item.content)) continue;
        for (const part of item.content) {
          if (part.type === 'output_text' && typeof part.text === 'string') {
            texts.push(part.text);
          }
        }
      }
      reply = texts.join('\n').trim();
    }

    return res.status(200).json({
      reply: reply || 'Ich konnte dazu gerade keine Antwort erstellen.'
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: 'Interner Fehler beim MORA-Chat.'
    });
  }
}
