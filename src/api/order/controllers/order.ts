import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::order.order', ({ strapi }) => ({

  async placeOrder(ctx) {
    try {
      console.time("⏱️ Order Processing Time");

      // ============================================================
      // 1. NHẬN DIỆN NGƯỜI DÙNG (USER IDENTIFICATION)
      // ============================================================
      // Strapi tự động giải mã Token từ Header và nhét vào ctx.state.user
      const user = ctx.state.user;

      if (user) {
        console.log(`✅ [Backend] User đang đặt hàng: ${user.email} (ID: ${user.id} - DocID: ${user.documentId})`);
      } else {
        console.warn("⚠️ [Backend] Khách vãng lai (Guest) - Không tìm thấy Token hợp lệ.");
      }

      // ============================================================
      // 2. CHUẨN HÓA DỮ LIỆU ĐẦU VÀO (INPUT PARSING)
      // ============================================================
      const rawBody = ctx.request.body;
      // Hỗ trợ cả 2 format: { data: {...} } hoặc {...} phẳng
      const payload = rawBody.data || rawBody;
      
      const { items, voucherCode, ...orderInfo } = payload;

      if (!items || items.length === 0) {
        return ctx.badRequest('Giỏ hàng trống, không thể tạo đơn!');
      }

      // ============================================================
      // 3. XỬ LÝ VOUCHER (VOUCHER LOGIC)
      // ============================================================
      let appliedVoucher = null;

      if (voucherCode) {
        // Tìm voucher trong DB
        const vouchers = await strapi.documents('api::voucher.voucher').findMany({
            filters: { code: voucherCode },
            status: 'published',
        });

        if (!vouchers || vouchers.length === 0) {
            return ctx.badRequest(`Mã giảm giá "${voucherCode}" không tồn tại.`);
        }

        const voucher = vouchers[0];
        const currentDate = new Date();

        // 3.1. Check ngày hết hạn
        if (voucher.endDate && new Date(voucher.endDate) < currentDate) {
            return ctx.badRequest(`Mã "${voucherCode}" đã hết hạn sử dụng.`);
        }

        // 3.2. Check số lượng giới hạn (Limit vs Uses)
        if (voucher.usageLimit && voucher.usuageCount >= voucher.usageLimit) {
            return ctx.badRequest(`Mã "${voucherCode}" đã hết lượt sử dụng.`);
        }

        // 3.3. Check giá trị đơn hàng tối thiểu
        const currentSubTotal = payload.subTotal || 0;
        if (voucher.minOrderValue && currentSubTotal < voucher.minOrderValue) {
             return ctx.badRequest(`Đơn hàng chưa đủ ${voucher.minOrderValue.toLocaleString()}đ để dùng mã này.`);
        }

        // Voucher hợp lệ -> Lưu lại để tí nữa update số lần dùng
        appliedVoucher = voucher;
      }

      // ============================================================
      // 4. XỬ LÝ KHO HÀNG (INVENTORY MANAGEMENT)
      // ============================================================
      const productMap = new Map();
      
      // Gom nhóm sản phẩm để tối ưu query (Tránh gọi DB trong vòng lặp quá nhiều)
      for (const item of items) {
        // Ưu tiên lấy documentId, nếu không có thì lấy id thường
        const pId = item.documentId || item.id || item.productId;
        
        if (!pId) continue;
        if (!productMap.has(pId)) productMap.set(pId, []);
        
        productMap.get(pId).push(item);
      }

      // Xử lý song song từng nhóm sản phẩm
      const updatePromises = Array.from(productMap.entries()).map(async ([prodId, cartItems]) => {
        
        // Tạo where clause linh hoạt (tìm theo documentId hoặc id số)
        const whereClause = (typeof prodId === 'string' && isNaN(Number(prodId)))
            ? { documentId: prodId }
            : { id: prodId };

        // Query lấy sản phẩm và variants
        const product = await strapi.db.query('api::product.product').findOne({
            where: whereClause,
            populate: ['variants'], 
        });

        if (!product) throw new Error(`Sản phẩm với ID ${prodId} không tồn tại hoặc đã bị xóa.`);

        const variants = product.variants || [];
        let isModified = false;

        // Loop qua từng item khách mua để trừ kho
        for (const item of (cartItems as any[])) {
            const buyQty = Number(item.stock) || Number(item.quantity) || 1;
            
            // Tìm variant khớp Size và Color
            const idx = variants.findIndex((v: any) => 
                v.size?.toLowerCase() === item.size?.toLowerCase() && 
                v.color?.toLowerCase() === item.color?.toLowerCase()
            );

            if (idx !== -1) {
                const currentStock = Number(variants[idx].stock) || 0;
                
                // Check hết hàng
                if (currentStock < buyQty) {
                    throw new Error(`Sản phẩm "${product.name}" (${item.size}, ${item.color}) hiện không đủ hàng.`);
                }
                
                // Trừ kho trong RAM
                variants[idx].stock = currentStock - buyQty;
                isModified = true;
            }
        }

        // Nếu có thay đổi kho -> Update vào Database
        if (isModified) {
             const cleanedVariants = variants.map((v: any) => ({
                size: v.size, color: v.color, stock: v.stock
             }));

             // Dùng Document Service API để update (đúng chuẩn Strapi v5)
             await strapi.documents('api::product.product').update({
                documentId: product.documentId,
                data: { variants: cleanedVariants },
                status: 'published'
            });
        }
      });

      // Chờ tất cả kho hàng update xong mới đi tiếp
      await Promise.all(updatePromises);

      // ============================================================
      // 5. CẬP NHẬT SỐ LẦN DÙNG VOUCHER (VOUCHER USAGE)
      // ============================================================
      if (appliedVoucher) {
          await strapi.documents('api::voucher.voucher').update({
              documentId: appliedVoucher.documentId,
              data: { usuageCount: (appliedVoucher.usuageCount || 0) + 1 },
              status: 'published'
          });
      }

      // ============================================================
      // 6. TẠO ĐƠN HÀNG (ORDER CREATION)
      // ============================================================
      
      // 6.1 Map lại items theo cấu trúc sạch sẽ để lưu vào Order
      const strapiOrderItems = items.map((item: any) => ({
        productName: item.name,
        price: item.price,
        stock: item.stock || item.quantity, // Số lượng mua
        size: item.size,
        color: item.color,
      }));

      // 6.2 Xác định User ID (Support cả Strapi v4 và v5)
      const userDocId = user?.documentId; // ID dạng chuỗi (v5)
      const userId = user?.id;            // ID dạng số (v4)

      // 6.3 Chuẩn bị Payload tạo đơn
      const orderDataInput = {
            ...orderInfo, 
            items: strapiOrderItems,
            
            // 🔥 ÉP CỨNG TRẠNG THÁI PENDING
            status: 'pending',

            // 🔥 CHIẾN THUẬT "2 TAY 2 SÚNG" ĐỂ GẮN USER
            // Chúng ta lưu vào cả 2 tên trường phổ biến nhất.
            // Strapi sẽ tự động bỏ qua trường nào sai tên, và ăn vào trường đúng tên.
            user: userDocId || userId || null,
            users_permissions_user: userId || userDocId || null,

            // Lưu thông tin tài chính
            voucherCode: appliedVoucher ? appliedVoucher.code : null,
            discountAmount: payload.discountAmount || 0,
            subTotal: payload.subTotal || 0,
            totalAmount: payload.totalAmount || 0,
            paymentMethod: payload.paymentMethod || 'cod',
            
            publishedAt: new Date() 
      };

      // 6.4 Lưu vào Database
      const newOrder = await strapi.documents('api::order.order').create({
        data: orderDataInput,
        status: 'published'
      });

      console.timeEnd("⏱️ Order Processing Time");
      
      // Trả kết quả về cho Frontend
      return { 
          data: newOrder, 
          meta: { 
              message: "Đặt hàng thành công",
              status: "pending",
              orderId: newOrder.documentId
          } 
      };

    } catch (err: any) {
      console.error("🔥 [Controller] Lỗi tạo đơn hàng:", err);
      // Trả về lỗi 400 để Frontend hiển thị thông báo
      return ctx.badRequest(err.message || "Đã có lỗi xảy ra trong quá trình xử lý đơn hàng.");
    }
  }
}));