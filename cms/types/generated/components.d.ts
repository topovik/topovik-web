import type { Schema, Struct } from '@strapi/strapi';

export interface SharedSeo extends Struct.ComponentSchema {
  collectionName: 'components_shared_seos';
  info: {
    description: 'SEO metadata migrated from AIOSEO';
    displayName: 'SEO';
    icon: 'search';
  };
  attributes: {
    canonicalPath: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 512;
      }>;
    metaDescription: Schema.Attribute.Text;
    metaTitle: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
      }>;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'shared.seo': SharedSeo;
    }
  }
}
