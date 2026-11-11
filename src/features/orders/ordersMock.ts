/**
 * Dev-only fixtures (enabled with VITE_MOCK_ORDERS=true in `npm run dev` — never in a production build).
 * Lets the Orders screen be developed and reviewed without a live backend or staff credentials.
 */
import type { OrdersPage, OrdersQuery } from './ordersApi';

const base = {
  fullName: 'Ram',
  phone: '+91-9597942504',
  email: 'ram5119022@gmail.com',
  orderSourceName: 'Online',
  orderTypeGroup: 'D',
  orderTotal: 90.1,
  orderInstructions: [{ sortOrder: '1', comments: '313 E Carmel Dr, Carmel, IN 46032' }],
};

const ORDERS = [
  { ...base, orderId: 'o5', orderNo: '5', orderTime: '19:18:15', statusId: '6', isPaid: false },
  { ...base, orderId: 'o4', orderNo: '4', orderTime: '19:17:07', statusId: '6', isPaid: false },
  { ...base, orderId: 'o3', orderNo: '3', orderTime: '19:15:19', statusId: '6', isPaid: false },
  { ...base, orderId: 'o2', orderNo: '2', orderTime: '19:11:54', statusId: '19', isPaid: true },
  { ...base, orderId: 'o1', orderNo: '1', orderTime: '18:02:41', statusId: '9', isPaid: false, orderTotal: 45 },
];

const state = (o: any) => (['8', '9'].includes(o.statusId) ? 'cancelled' : o.isPaid ? 'paid' : 'unpaid');

export async function mockOrders(q: OrdersQuery): Promise<OrdersPage> {
  await new Promise((r) => setTimeout(r, 350));
  const s = (q.search ?? '').toLowerCase();
  let rows = ORDERS.filter((o) => q.paymentStatus.includes(state(o) as any));
  if (s) rows = rows.filter((o) => `${o.orderNo} ${o.fullName} ${o.phone}`.toLowerCase().includes(s));
  const [field, dir] = q.sort.split(',');
  if (field === 'orderNo') rows = [...rows].sort((a, b) => Number(a.orderNo) - Number(b.orderNo));
  else rows = [...rows].sort((a, b) => a.orderTime.localeCompare(b.orderTime));
  if (dir === 'desc') rows.reverse();
  return { content: rows, totalElements: rows.length, totalPages: rows.length ? 1 : 0, page: 0 };
}

export async function mockOrderDetail(orderId: string): Promise<any> {
  await new Promise((r) => setTimeout(r, 250));
  const o = ORDERS.find((x) => x.orderId === orderId) ?? ORDERS[0];
  return {
    ...o,
    items: [{ id: 'i1', itemName: 'Silver Hoops With Moissanites', quantity: '1', price: '85.00', subTotal: '85.00', options: [] }],
    transactions: o.isPaid ? [{ id: 't1', transactionAmount: 90.1, statusId: 19, tenderType: 'CNP', cardType: 'visa', cardInfo: 'XXXXXXXXXXXX0043', message: 'Approved', authorizationCode: 'XXdpm6wTYc', createdTime: '2026-10-28T19:11:54Z' }] : [],
    totals: [
      { code: '1', title: 'Item Total', value: '85.00' },
      { code: '2', title: 'Tax', value: '5.10' },
      { code: '3', title: 'Tip', value: '0.00' },
      { code: '9', title: 'Grand Total', value: String(o.orderTotal) },
    ],
  };
}
