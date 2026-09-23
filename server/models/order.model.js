'use strict';

/* MODEL — tạo đơn hàng qua stored procedure dbo.usp_TaoDonHang (bảng TVP
 * dbo.OrderItemType). Tách từ lib/order-repository.js khi chuẩn hoá cấu trúc MVC;
 * logic giữ nguyên 100%. Lỗi nghiệp vụ từ proc (error number 50001–50009) được
 * đánh dấu isBusinessError + status 400 để controller trả 400 thay vì 503. */

const businessErrorNumbers = new Set([50001, 50002, 50003, 50004, 50005, 50006, 50007, 50008, 50009]);

const createOrderRepository = ({ pool, sql }) => ({
  async createOrder(input) {
    const table = new sql.Table('dbo.OrderItemType');
    table.columns.add('ProductId', sql.Int, { nullable: false });
    table.columns.add('Qty', sql.Int, { nullable: false });
    for (const item of input.items) table.rows.add(item.id, item.qty);

    try {
      const result = await pool.request()
        .input('CustomerName', sql.NVarChar(80), input.customer.name)
        .input('CustomerPhone', sql.NVarChar(10), input.customer.phone)
        .input('CustomerAddress', sql.NVarChar(300), input.customer.address)
        .input('DeliveryMethod', sql.NVarChar(10), input.delivery)
        .input('PaymentMethod', sql.NVarChar(10), input.payment)
        .input('PromoCode', sql.NVarChar(20), input.promoCode || null)
        .input('Note', sql.NVarChar(500), input.customer.note || null)
        .input('Items', table)
        .execute('dbo.usp_TaoDonHang');

      const summary = result.recordsets[0] && result.recordsets[0][0];
      const itemRows = (result.recordsets[1] || []).map((row) => ({
        id: Number(row.ProductId), name: row.ProductName, price: Number(row.UnitPrice), qty: Number(row.Qty),
      }));
      if (!summary) throw new Error('Stored procedure không trả thông tin đơn hàng.');
      return {
        code: summary.OrderCode,
        items: itemRows,
        delivery: summary.DeliveryMethod,
        payment: summary.PaymentMethod,
        promoCode: summary.PromoCode || null,
        subtotal: Number(summary.Subtotal),
        shippingFee: Number(summary.ShippingFee),
        discount: Number(summary.Discount),
        total: Number(summary.Total),
        customer: {
          name: summary.CustomerName, phone: summary.CustomerPhone,
          address: summary.CustomerAddress, note: summary.Note || '',
        },
        createdAt: new Date(summary.CreatedAt).toISOString(),
      };
    } catch (error) {
      const number = Number(error && (error.number || (error.originalError && error.originalError.info && error.originalError.info.number)));
      if (businessErrorNumbers.has(number)) {
        error.isBusinessError = true;
        error.status = 400;
      }
      throw error;
    }
  },
});

module.exports = { createOrderRepository };
