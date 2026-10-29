const effect='(?:vorbereitet|erstellt|geöffnet|gespeichert|versendet|gesendet|eingereicht|beauftragt|gebucht)';
const success=new RegExp('\\b(?:ich habe|wir haben|wurde|ist bereits|sind bereits)\\b[^.!?;\\n]{0,100}\\b'+effect+'\\b','iu');
// A narrowly scoped complete denial is not an executed operation. Mixed clauses
// and "nicht nur" deliberately do not qualify; semantic verification remains
// responsible for meanings beyond this conservative local backstop.
const recipient='(?:(?:an|bei) (?:(?!(?:und|oder|aber|sondern|jedoch|doch|nur|gespeichert|versendet|gesendet|eingereicht|beauftragt|gebucht)\\b)[\\p{L}\\p{N}_-]+ ){1,8})?';
const denial=new RegExp('^(?:nein[, :]*)?(?:(?:ich|wir) hab(?:e|en)|(?:(?:es|das Anliegen|die Meldung|der Entwurf|die Anfrage) )?wurde) (?:(?:es|das Anliegen|die Meldung|der Entwurf|die Anfrage) )?(?:noch )?(?:nichts|nicht|kein(?:e|en)? (?:Anliegen|Meldung|Entwurf|Anfrage|Auftrag)) '+recipient+effect+'$','iu');
export function hasUnconfirmedSuccess(reply,{localStorageConfirmed=false}={}){
  return reply.split(/[.!?;\n]+/u).map(s=>s.trim().replace(/\s+/g,' ')).some(s=>{
    if(!success.test(s)||denial.test(s))return false;
    // A native read-back receipt permits only explicitly local storage claims.
    // It never authorizes sending, ordering, booking, or another external effect.
    const confirmedLocal=localStorageConfirmed&&/\bgespeichert\b/iu.test(s)&&/\b(?:lokal|auf diesem Gerät)\b/iu.test(s)&&!/\b(?:versendet|gesendet|eingereicht|beauftragt|gebucht)\b/iu.test(s);
    return !confirmedLocal;
  });
}

// Deterministic backstop for a specific unsupported role, including conditional
// advice. This is not a general medical/technical safety assessment. Never infer
// a customer hazard from the assistant's own hypothetical warning.
export function hasUnsupportedEmergencyRole(reply,{hazard=null}={}){
  const text=String(reply).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss').toLowerCase();
  const emergency=/\b(?:gas(?:geruch|austritt|leck)?|gefahr\w*|notfall\w*|notruf|feuer(?:wehr)?|brand(?:geruch)?|rauch|funken|stromschlag|rettungsdienst|wasseraustritt)\b/u;
  if((!hazard||hazard==='none')&&!emergency.test(text))return false;
  const target='(?:bei (?:mir|uns|mora)|an (?:mich|uns|mora)|mit (?:mir|uns|mora)|(?:mich|uns|mora)|(?:hier|im (?:chat|portal)|uber (?:den|diesen) (?:chat|das portal)))';
  const contact=new RegExp('\\b(?:meld(?:en|e)|schreib(?:en|e)|kontaktier(?:en|e)|informier(?:en|e)|benachrichtig(?:en|e)|wend(?:en|e)|ruf(?:en|e))\\b[^.!?;]{0,120}?\\b'+target+'\\b','gu');
  const wait=/\bwart(?:en|e)\b[^.!?;]{0,90}\b(?:auf (?:meine|unsere|eine) antwort|im chat|im portal)\b/gu;
  const dispatch=/\b(?:(?:ich|wir)\b[^.!?;]{0,35}\b(?:alarmier\w*|ruf\w*|kontaktier\w*|verstandig\w*|schick\w*)|(?:alarmier\w*|ruf\w*|kontaktier\w*|verstandig\w*|schick\w*)\s+(?:ich|wir))\b[^.!?;]{0,75}\b(?:notruf|feuerwehr|notdienst|rettungsdienst|hilfe|sanitat|notarzt)\b/gu;
  const dispatchLater=/\b(?:ich|wir)\b[^.!?;]{0,35}\b(?:notruf|feuerwehr|notdienst|rettungsdienst|hilfe|sanitat|notarzt)\b[^.!?;]{0,60}\b(?:alarmier\w*|anruf\w*|kontaktier\w*|verstandig\w*|schick\w*)\b/gu;
  const role=/\b(?:ich bin|wir sind|mora ist)\b[^.!?;]{0,45}\b(?:notfallstelle|notdienst|notrufzentrale|notfallkontakt)\b/gu;
  const denied=s=>/\b(?:nicht|nie|keinesfalls|kein\w*)\b/u.test(s)&&!/\b(?:sondern|aber|jedoch|nur)\b/u.test(s);
  return text.split(/[.!?;\n]+/u).some(sentence=>{
    // Optional follow-up after reaching safety is not emergency routing.
    const later=/\b(?:wenn|sobald|nachdem)\b[^,]{0,60}\b(?:in sicherheit|ausser gefahr|an einem sicheren ort)\b/u.test(sentence);
    for(const pattern of [contact,wait,dispatch,dispatchLater,role]){
      for(const match of sentence.matchAll(pattern)){
        const prefix=sentence.slice(0,match.index).split(/,|\bund\b/u).at(-1).slice(-20);
        if(denied(prefix+match[0]))continue;
        if(later&&pattern===contact&&!/\b(?:zuerst|sofort|statt|bevor)\b/u.test(sentence))continue;
        return true;
      }
    }
    return false;
  });
}
