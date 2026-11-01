// iOS renders U+2197 as a blue emoji tile. Keep portal links typographic.
export function installPortalTextArrows(root) {
 if (!root || root.dataset.textArrowsInstalled) return;
 root.dataset.textArrowsInstalled = 'true';
 const doc = root.ownerDocument;
 const win = doc.defaultView;
 const clean = subtree => {
  const walker = doc.createTreeWalker(subtree, win.NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
   const text = walker.currentNode;
   if (text.nodeValue.includes('↗')) text.nodeValue = text.nodeValue.replace(/↗[\uFE0E\uFE0F]?/g, '→');
  }
 };
 clean(root);
 const observer = new win.MutationObserver(records => {
  for (const record of records) {
   for (const node of record.addedNodes) {
    if (node.nodeType === win.Node.TEXT_NODE && node.nodeValue.includes('↗'))
     node.nodeValue = node.nodeValue.replace(/↗[\uFE0E\uFE0F]?/g, '→');
    else if (node.nodeType === win.Node.ELEMENT_NODE) clean(node);
   }
  }
 });
 observer.observe(root, {childList:true, subtree:true});
 return () => {observer.disconnect();delete root.dataset.textArrowsInstalled;};
}
if (typeof document !== 'undefined') installPortalTextArrows(document.querySelector('#portalPreview'));
