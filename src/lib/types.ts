// Shared types between customer + admin
import type { OrderStatus } from "@prisma/client";
export type { OrderStatus };

export interface MenuItemDto {
  id: number;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  available: boolean;
  customizationOptions: string;
  categoryId: number;
  category: { id: number; name: string };
}

export interface CategoryDto {
  id: number;
  name: string;
  description: string | null;
}

export interface OrderItemDto {
  id: number;
  quantity: number;
  itemName: string;
  unitPrice: number;
  subtotal: number;
  customization: string;
}

export interface OrderDto {
  id: number;
  orderNumber: string;
  orderDate: string; // "YYYY-MM-DD" local date the order was placed
  customerName: string | null;
  tableNumber: string | null;
  status: OrderStatus;
  totalPrice: number;
  createdAt: string;
  items: OrderItemDto[];
}

export interface CartLineInput {
  menuItemId: number;
  quantity: number;
  selection: {
    size: string;
    sugar: string;
    ice: string;
    extras: string[];
  };
}