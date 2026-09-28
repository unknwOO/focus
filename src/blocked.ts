import getBlockedMessage from "./helpers/get-blocked-message";
import { type CounterPeriod, VALIDATORS } from "./storage";

window.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);

  const url = params.get("url");
  if (!url) {
    return;
  }

  const rule = params.get("rule");
  if (!rule) {
    return;
  }

  const count = parseInt(params.get("count") || "", 10);
  const period = params.get("period");
  const countParams =
    !Number.isNaN(count) && VALIDATORS.counterPeriod(period)
      ? { count, period: period as CounterPeriod }
      : undefined;

  const message = getBlockedMessage({
    url,
    rule,
    countParams,
  });

  (document.getElementById("message") as HTMLParagraphElement).innerHTML = message;
  document.body.classList.add("ready");
});
