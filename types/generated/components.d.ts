import type { Schema, Struct } from '@strapi/strapi';

export interface ElementsHeroSlide extends Struct.ComponentSchema {
  collectionName: 'components_elements_hero_slides';
  info: {
    displayName: 'HeroSlide';
  };
  attributes: {
    alt_text: Schema.Attribute.String;
    media: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    poster: Schema.Attribute.Media<'images'>;
    type: Schema.Attribute.Enumeration<['image', 'video']> &
      Schema.Attribute.DefaultTo<'image'>;
  };
}

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

export interface ShopCartItem extends Struct.ComponentSchema {
  collectionName: 'components_shop_cart_items';
  info: {
    displayName: 'CartItem';
  };
  attributes: {
    product: Schema.Attribute.Relation<'oneToOne', 'api::product.product'>;
    quantity: Schema.Attribute.Integer;
    variant: Schema.Attribute.JSON;
  };
}

export interface ShopOrderItem extends Struct.ComponentSchema {
  collectionName: 'components_shop_order_items';
  info: {
    displayName: 'OrderItem';
  };
  attributes: {
    price: Schema.Attribute.BigInteger;
    product: Schema.Attribute.Relation<'oneToOne', 'api::product.product'>;
    productImage: Schema.Attribute.String;
    productName: Schema.Attribute.String;
    quantity: Schema.Attribute.Integer;
    variant: Schema.Attribute.JSON;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'elements.hero-slide': ElementsHeroSlide;
      'inventory.variant': InventoryVariant;
      'shop.cart-item': ShopCartItem;
      'shop.order-item': ShopOrderItem;
    }
  }
}
