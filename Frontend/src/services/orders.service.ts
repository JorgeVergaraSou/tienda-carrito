//src/services/orders.service.ts
import { api } from '@/api/axios';
import { AdminOrder, Order, OrderStatus, PaginatedOrders } from '@/interfaces';

export interface CreateOrderItemData {
  idProducto: number;
  cantidad: number;
}

export interface CreateOrderData {
  nombreContacto: string;
  email: string;
  telefono: string;
  notas?: string;
  items: CreateOrderItemData[];
}

/** público — checkout como invitado, POST /ordenes no requiere login (ver
 * Backend/CLAUDE.md, sección "Carrito de compra + Mercado Pago"). El
 * pedido y la Preferencia de Mercado Pago se crean en la misma request —
 * la respuesta ya trae `initPoint`, listo para redirigir
 * (CheckoutPage.tsx). */
export const crearOrdenService = async (data: CreateOrderData): Promise<Order> => {
  const res = await api.post('/ordenes', data);
  return res.data;
};

export interface FindOrdersQueryData {
  search?: string;
  estado?: OrderStatus;
  page?: number;
  limit?: number;
}

/** ADMIN — panel de pedidos (Fase 5, ver Backend/CLAUDE.md). */
export const getAdminOrdersService = async (
  query: FindOrdersQueryData,
): Promise<PaginatedOrders> => {
  const res = await api.get('/ordenes/admin/listado', { params: query });
  return res.data;
};

/** ADMIN — detalle de un pedido puntual. */
export const getAdminOrderService = async (idOrden: number): Promise<AdminOrder> => {
  const res = await api.get(`/ordenes/admin/${idOrden}`);
  return res.data;
};
