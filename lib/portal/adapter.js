/** Phase 2: replace this boundary when authenticated, tenant-scoped APIs exist.
 * Demo cards are never returned as verified customer records.
 */
export const portalCapabilities = Object.freeze({
  customerContext: false, documents: false, appointments: false, requests: false,
  submitRequest: false, uploadAttachments: false,
  navigation: ['docs', 'service', 'profile', 'portfolio'],
  sections: {
    docs:{label:'Dokumente',purpose:'Dokumentenansicht',personalRecords:false},
    service:{label:'Service',purpose:'Anliegenentwürfe',transmitted:false},
    profile:{label:'Profil',purpose:'Profilansicht',verifiedCustomer:false},
    portfolio:{label:'Portfolio',purpose:'Immobilienübersicht',personalRecords:false},
  },
  previewScope: 'No verified personal records or request transmission anywhere in this Preview. Navigation opens prepared UI sections, not an alternative personal-data or sending integration.',
  localDraft: {view:'service',sectionLabel:'Service',storage:'customer_device',transmitted:false},
});

export async function submitRequest({ draft, idempotencyKey, customerContext }) {
  // Future adapters must enforce identity, unit permissions and idempotency.
  void idempotencyKey;
  void customerContext;
  return { accepted: false, status: 'integration_required', draftId: draft.id };
}
