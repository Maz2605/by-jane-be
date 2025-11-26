import type { Schema, Struct } from '@strapi/strapi';

export interface InventoryVariant extends Struct.ComponentSchema {
  collectionName: 'components_inventory_variants';
  info: {
    displayName: 'Variant';
  };
  attributes: {
    color: Schema.Attribute.String;
    size: Schema.Attribute.Enumeration<['S', 'M', 'L', 'XL']>;
    stock: Schema.Attribute.Integer;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'inventory.variant': InventoryVariant;
    }
  }
}
