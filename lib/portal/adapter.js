/** Phase 2: replace this boundary when authenticated, tenant-scoped APIs exist.
 * Demo cards are never returned as verified customer records.
 */
export const portalCapabilities = Object.freeze({
  customerContext: false, documents: false, appointments: false, requests: false,
  submitRequest: false, uploadAttachments: false,
  navigation: ['docs', 'service', 'profile', 'portfolio'],
});

export async function submitRequest({ draft, idempotencyKey, customerContext }) {
  // Future adapters must enforce identity, unit permissions and idempotency.
  void idempotencyKey;
  void customerContext;
  return { accepted: false, status: 'integration_required', draftId: draft.id };
}
