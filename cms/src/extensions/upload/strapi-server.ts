/**
 * Strapi always generates formats.thumbnail for Media Library previews.
 * There is no official config flag to turn it off; override the service instead.
 * Responsive sizes still come from config/plugins.ts breakpoints (medium only).
 */
export default (plugin: {
  services: Record<string, Record<string, unknown>>;
}) => {
  plugin.services['image-manipulation'].generateThumbnail = async () => null;
  return plugin;
};
