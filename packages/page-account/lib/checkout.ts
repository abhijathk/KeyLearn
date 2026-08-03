import type { UserDetails } from "@keylearn/pages-shared";
import { paddlePriceId } from "@keylearn/thirdparties";
import { loadPaddle } from "./paddle/loader.ts";

export function checkoutProduct({ id, email }: UserDetails) {
  return loadPaddle().then((paddle) => {
    paddle.Checkout.open({
      settings: {
        displayMode: "overlay",
        variant: "one-page",
        allowLogout: false,
      },
      customer: {
        email,
      },
      items: [
        {
          priceId: paddlePriceId,
          quantity: 1,
        },
      ],
      customData: {
        id,
      },
    });
  });
}
