import {createPortalTranslator} from './portal-i18n-core.js';
export type PortalI18n = ReturnType<typeof createPortalTranslator> & {
  storageAvailable: boolean;
  localizeStatic(root: Element, localized?: boolean): void;
  setPersistenceAdapter(adapter: {load(): string | null; save(language: string): void}): void;
};
declare global {
  interface Window { MoradaI18n: PortalI18n; }
  const previewOpen: boolean;
  function portalViewSnapshot(): unknown;
  const portalNavigation: {restore: unknown};
  function render(): void;
}
