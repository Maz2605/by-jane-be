export default {
  routes: [
    {
      method: 'POST',
      path: '/orders/place-order', // API mới của chúng ta
      handler: 'order.placeOrder', // Gọi đến controller tên là placeOrder
      config: {
        auth: false, // Để false nếu cho khách vãng lai mua, hoặc true nếu cần login
      },
    },
  ],
};