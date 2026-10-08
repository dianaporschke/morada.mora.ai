/** Portal navigation only. Radio IDs are the public contract used by MORA. */
export function initializePortalNavigation(document) {
  const navigation = document.querySelector('.portal-nav');
  if (!navigation) return;
  const labels = [...navigation.querySelectorAll('label[for]')];
  const update = () => {
    for (const label of labels) {
      if (document.getElementById(label.htmlFor)?.checked) label.setAttribute('aria-current', 'page');
      else label.removeAttribute('aria-current');
    }
  };
  for (const label of labels) {
    document.getElementById(label.htmlFor)?.addEventListener('change', update);
  }
  document.querySelectorAll('.portal-shell label[for][role="button"], .portal-quick label[for]').forEach(label => {
    label.setAttribute('tabindex', '0');
    label.setAttribute('role', 'button');
    label.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      label.click();
    });
  });
  document.addEventListener('click', () => queueMicrotask(update));
  document.addEventListener('submit', () => queueMicrotask(update));
  // MORA's asynchronous handover changes radios without a change event.
  // Its existing rendering updates child nodes; observe those updates without
  // modifying its handlers or state. Only navigation accessibility is updated.
  const Observer = document.defaultView?.MutationObserver;
  if (Observer) new Observer(update).observe(document.querySelector('.portal-shell'), { childList:true, subtree:true });
  update();
}

if (typeof document !== 'undefined') initializePortalNavigation(document);
