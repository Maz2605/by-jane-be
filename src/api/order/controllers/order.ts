// path: src/api/order/controllers/order.ts
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::order.order', ({ strapi }) => ({

  async placeOrder(ctx) {
    try {
      console.time("⏱️ Speed Test"); // Bắt đầu bấm giờ
      const { data } = ctx.request.body;
      const { items, ...orderInfo } = data;

      if (!items?.length) return ctx.badRequest('Giỏ hàng trống!');

      // 1. GỘP NHÓM (Giảm số lần gọi DB)
      // Ví dụ: Mua 3 cái áo cùng loại -> Chỉ gọi DB 1 lần
      const productMap = new Map();
      for (const item of items) {
        const pId = item.documentId || item.id || item.productId;
        if (!pId) continue;
        if (!productMap.has(pId)) productMap.set(pId, []);
        productMap.get(pId).push(item);
      }

      // 2. XỬ LÝ SONG SONG (Parallel) + DÙNG DB ENGINE (Fast Read)
      const updatePromises = Array.from(productMap.entries()).map(async ([prodId, cartItems]) => {
        
        // 🔥 TỐI ƯU 1: Dùng strapi.db.query để ĐỌC (Nhanh hơn documents API)
        // Hỗ trợ tìm cả documentId lẫn id số
        const whereClause = (typeof prodId === 'string' && isNaN(Number(prodId)))
            ? { documentId: prodId }
            : { id: prodId };

        const product = await strapi.db.query('api::product.product').findOne({
            where: whereClause,
            populate: ['variants'], 
        });

        if (!product) throw new Error(`Không tìm thấy SP ID: ${prodId}`);

        const variants = product.variants || [];
        let isModified = false;

        // Xử lý trừ kho trong RAM
        for (const item of cartItems) {
            const buyQty = Number(item.stock) || 1;
            const idx = variants.findIndex(v => 
                v.size?.toLowerCase() === item.size?.toLowerCase() && 
                v.color?.toLowerCase() === item.color?.toLowerCase()
            );

            if (idx !== -1) {
                const currentStock = Number(variants[idx].stock) || 0;
                if (currentStock < buyQty) throw new Error(`Hết hàng: ${product.name}`);
                
                variants[idx].stock = currentStock - buyQty;
                isModified = true;
            }
        }

        // 🔥 TỐI ƯU 2: Chỉ Update khi thực sự có thay đổi
        if (isModified) {
             const cleanedVariants = variants.map(v => ({
                size: v.size, color: v.color, stock: v.stock
             }));

             // Bắt buộc dùng documents API để update (để sync Draft/Publish)
             await strapi.documents('api::product.product').update({
                documentId: product.documentId,
                data: { variants: cleanedVariants },
                status: 'published'
            });
        }
      });

      // Chạy tất cả cùng lúc
      await Promise.all(updatePromises);

      // 3. TẠO ORDER (Song song hóa việc map data)
      const strapiOrderItems = items.map(item => ({
        productName: item.name,
        price: item.price,
        stock: item.stock,
        size: item.size,
        color: item.color,
      }));

      const newOrder = await strapi.documents('api::order.order').create({
        data: { ...orderInfo, items: strapiOrderItems, publishedAt: new Date() },
        status: 'published'
      });

      console.timeEnd("⏱️ Speed Test"); // Xem kết quả trong terminal
      return { data: newOrder, meta: { message: "Thành công" } };

    } catch (err) {
      console.error("🔥 Error:", err);
      return ctx.badRequest(err.message);
    }
  }
}));