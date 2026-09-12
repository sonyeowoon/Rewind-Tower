// The build replaces this value with the content fingerprint of the release.
const ASSET_VERSION = 'development';
export function assetUrl(path) {
  const url = new URL(`./assets/${path}`, import.meta.url);
  if (ASSET_VERSION !== 'development') url.searchParams.set('v', ASSET_VERSION);
  return url.href;
}
