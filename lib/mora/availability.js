/** Fixed operational errors, never substitute conversational/model replies. */
export function modelFailure(availability) {
  const provider = ['gateway','openai'].includes(availability?.provider) ? availability.provider : null;
  const model = typeof availability?.model === 'string' && /^[a-zA-Z0-9_.:/-]{1,120}$/.test(availability.model) ? availability.model : null;
  const reason = typeof availability?.reason === 'string' && /^[a-z][a-z0-9_]{1,64}$/.test(availability.reason) ? availability.reason : 'unavailable';
  const status = Number.isInteger(availability?.status) && availability.status >= 100 && availability.status <= 599 ? availability.status : null;
  let category = 'technical', retryable = true;
  let error = 'Die KI-Anbindung ist gerade nicht verfügbar. Ihre bisherigen Angaben bleiben erhalten. Bitte versuchen Sie es später erneut.';
  if (reason === 'inference_disabled') {
    category = 'activation'; retryable = false;
    error = 'Die KI ist in dieser Testversion noch nicht aktiviert. Der kostenlose Modellzugang muss zuerst geprüft werden. Ihre bisherigen Angaben bleiben erhalten.';
  } else if (['missing_credentials','invalid_provider_configuration','invalid_model_configuration'].includes(reason)) {
    category = 'configuration'; retryable = false;
    error = 'Die KI-Anbindung ist noch nicht vollständig eingerichtet. Bitte wenden Sie sich an MORADA. Ihre bisherigen Angaben bleiben erhalten.';
  } else if (['authentication_failed','oidc_access_denied'].includes(reason)) {
    category = 'authentication'; retryable = false;
    error = 'Der Zugang zur KI konnte nicht bestätigt werden. Bitte wenden Sie sich an MORADA. Ihre bisherigen Angaben bleiben erhalten.';
  } else if (reason === 'customer_verification_required') {
    category = 'account_verification'; retryable = false;
    error = 'Der KI-Zugang benötigt eine Kontoverifizierung durch MORADA. Ihre bisherigen Angaben bleiben erhalten.';
  } else if (['insufficient_funds','insufficient_quota','payment_required','quota_for_entity_exceeded'].includes(reason)) {
    category = 'billing'; retryable = false;
    error = 'Der KI-Zugang ist wegen eines Guthaben- oder Nutzungslimits gesperrt. Bitte wenden Sie sich an MORADA. Ihre bisherigen Angaben bleiben erhalten.';
  } else if (['model_not_found','no_providers_available','access_denied','model_access_denied'].includes(reason)) {
    category = 'model_access'; retryable = false;
    error = 'Für das gewählte KI-Modell steht derzeit kein freigegebener Zugang zur Verfügung. Bitte wenden Sie sich an MORADA. Ihre bisherigen Angaben bleiben erhalten.';
  } else if (reason === 'rate_limit_or_quota') {
    category = 'rate_limit';
  }
  return {error,code:'MODEL_UNAVAILABLE',retryable,category,modelAvailability:{provider,model,status,reason}};
}
