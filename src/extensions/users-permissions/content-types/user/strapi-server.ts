// src/extensions/users-permissions/strapi-server.ts

module.exports = (plugin) => {
  // Lưu lại controller gốc của Strapi để gọi lại sau khi check xong
  const originalUpdate = plugin.controllers.user.update;

  plugin.controllers.user.update = async (ctx) => {
    // 1. Lấy User đang đăng nhập từ Token
    const user = ctx.state.user;
    
    // 2. Lấy ID user mà request đang muốn sửa (từ URL /api/users/:id)
    const targetUserId = ctx.params.id;

    // 3. Logic bảo mật:
    // Nếu không phải Admin VÀ ID trong Token khác ID muốn sửa -> Chặn ngay
    // (Lưu ý: targetUserId thường là string, user.id là number nên cần convert)
    if (user.id !== parseInt(targetUserId) && user.role.type !== 'admin') {
      return ctx.forbidden("Bạn không có quyền sửa thông tin của người khác!");
    }

    // 4. Nếu hợp lệ, cho phép chạy tiếp logic gốc của Strapi
    return await originalUpdate(ctx);
  };

  return plugin;
};