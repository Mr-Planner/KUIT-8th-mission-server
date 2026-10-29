import { randomUUID } from "node:crypto";
import cors from "cors";
import express from "express";
import stores from "./data/stores";
import type { CreateOrderRequest } from "./types/stores";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/stores", (_request, response) => {
  const storeSummaries = stores.map(({ menus: _menus, ...store }) => store);

  response.status(200).json(storeSummaries);
});

app.get("/api/stores/:storeId", (request, response) => {
  const storeId = Number(request.params.storeId);
  const store = stores.find((item) => item.id === storeId);

  if (!Number.isInteger(storeId) || !store) {
    response.status(404).json({
      code: "STORE_NOT_FOUND",
      message: "존재하지 않는 가게입니다.",
    });
    return;
  }

  response.status(200).json(store);
});

app.post("/api/orders", (request, response) => {
  const body = request.body as Partial<CreateOrderRequest> | undefined;
  const storeId = body?.storeId;
  const items = body?.items;

  if (!Number.isInteger(storeId) || !Array.isArray(items) || items.length === 0) {
    response.status(400).json({
      code: "INVALID_ORDER",
      message: "가게와 주문할 메뉴를 확인해주세요.",
    });
    return;
  }

  const store = stores.find((item) => item.id === storeId);

  if (!store) {
    response.status(404).json({
      code: "STORE_NOT_FOUND",
      message: "존재하지 않는 가게입니다.",
    });
    return;
  }

  const orderItems = [];

  for (const item of items) {
    if (
      typeof item !== "object" ||
      item === null ||
      !Number.isInteger(item.menuId) ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0
    ) {
      response.status(400).json({
        code: "INVALID_ORDER",
        message: "메뉴와 수량을 확인해주세요.",
      });
      return;
    }

    const menu = store.menus.find((itemMenu) => itemMenu.id === item.menuId);

    if (!menu) {
      response.status(404).json({
        code: "MENU_NOT_FOUND",
        message: "해당 가게에 존재하지 않는 메뉴입니다.",
      });
      return;
    }

    orderItems.push({
      menuId: menu.id,
      name: menu.name,
      price: menu.price,
      quantity: item.quantity,
      subtotal: menu.price * item.quantity,
    });
  }

  const menuTotal = orderItems.reduce((total, item) => total + item.subtotal, 0);

  if (menuTotal < store.minDeliveryPrice) {
    response.status(400).json({
      code: "MINIMUM_ORDER_NOT_MET",
      message: `최소 주문금액은 ${store.minDeliveryPrice.toLocaleString("ko-KR")}원입니다.`,
    });
    return;
  }

  response.status(201).json({
    orderId: randomUUID(),
    storeId: store.id,
    items: orderItems,
    menuTotal,
    deliveryFee: store.deliveryFee,
    totalPrice: menuTotal + store.deliveryFee,
    status: "RECEIVED",
  });
});

export default app;
