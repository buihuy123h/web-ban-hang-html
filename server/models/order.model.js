'use strict';

/* MODEL — tạo đơn hàng qua hàm PostgreSQL app.fn_tao_don_hang (thay stored procedure
 * dbo.usp_TaoDonHang + TVP của SQL Server): items truyền dạng tham số jsonb thứ 8,
 * hàm trả 1 dòng gồm thông tin đơn + cột items (jsonb). Lỗi nghiệp vụ do hàm RAISE
 * EXCEPTION (SQLSTATE P0001) được đánh dấu isBusinessError + status 400 để controller
 * trả 400 thay vì 503; lỗi khác (mất kết nối, timeout…) → 503 qua error handler. */

const CREATE_ORDER_SQL = 'SELECT * FROM app.fn_tao_don_hang($1, $2, $3, $4, $5, $6, $7, $8::jsonb)';

const createOrderRepository = ({ pool }) => ({
  async createOrder(input) {
    const items = input.items.map((item) => ({ id: Number(item.id), qty: Number(item.qty) }));
    try {
      const result = await pool.query(CREATE_ORDER_SQL, [
        input.customer.name,
        input.customer.phone,
        input.customer.address,
        input.delivery,
        input.payment,
        input.promoCode || null,
        input.customer.note || null,
        JSON.stringify(items),
      ]);
      const summary = result.rows && result.rows[0];
      if (!summary) throw new Error('Hàm tạo đơn hàng không trả thông tin đơn hàng.');
      return {
        code: summary.order_code,
        items: (summary.items || []).map((row) => ({
          id: Number(row.id), name: row.name, price: Number(row.price), qty: Number(row.qty),
        })),
        delivery: summary.delivery_method,
        payment: summary.payment_method,
        promoCode: summary.promo_code || null,
        subtotal: Number(summary.subtotal),
        shippingFee: Number(summary.shipping_fee),
        discount: Number(summary.discount),
        total: Number(summary.total),
        customer: {
          name: summary.customer_name, phone: summary.customer_phone,
          address: summary.customer_address, note: summary.note || '',
        },
        createdAt: new Date(summary.created_at).toISOString(),
      };
    } catch (error) {
      if (error && error.code === 'P0001') {
        error.isBusinessError = true;
        error.status = 400;
      }
      throw error;
    }
  },
});

module.exports = { createOrderRepository };
