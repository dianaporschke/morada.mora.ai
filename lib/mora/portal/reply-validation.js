const effect='(?:gespeichert|versendet|gesendet|eingereicht|beauftragt|gebucht)';
const success=new RegExp('\\b(?:ich habe|wir haben|wurde|ist bereits|sind bereits)\\b[^.!?;\\n]{0,100}\\b'+effect+'\\b','iu');
// A narrowly scoped complete denial is not an executed operation. Mixed clauses
// and "nicht nur" deliberately do not qualify; semantic verification remains
// responsible for meanings beyond this conservative local backstop.
const denial=new RegExp('^(?:nein[, :]*)?(?:(?:ich|wir) hab(?:e|en)|(?:(?:es|das Anliegen|die Meldung|der Entwurf|die Anfrage) )?wurde) (?:noch )?(?:nichts|nicht|kein(?:e|en)? (?:Anliegen|Meldung|Entwurf|Anfrage|Auftrag)) (?:(?:an|bei) MORADA )?'+effect+'$','iu');
export function hasUnconfirmedSuccess(reply,{localStorageConfirmed=false}={}){
  return reply.split(/[.!?;\n]+/u).map(s=>s.trim().replace(/\s+/g,' ')).some(s=>{
    if(!success.test(s)||denial.test(s))return false;
    // A native read-back receipt permits only explicitly local storage claims.
    // It never authorizes sending, ordering, booking, or another external effect.
    const confirmedLocal=localStorageConfirmed&&/\bgespeichert\b/iu.test(s)&&/\b(?:lokal|auf diesem Gerät)\b/iu.test(s)&&!/\b(?:versendet|gesendet|eingereicht|beauftragt|gebucht)\b/iu.test(s);
    return !confirmedLocal;
  });
}
