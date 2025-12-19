import React from "react";

const DEFAULT_RATES = { BDT: 1, USD: 117, GBP: 146 };
const DEFAULT_CURRENCY = "BDT";

export const useCurrency = () => {
  const [currency, setCurrency] = React.useState(DEFAULT_CURRENCY);
  const [rates, setRates] = React.useState(DEFAULT_RATES);

  const toBdt = React.useCallback(
    (amount) => {
      const rate = rates[currency] || 1;
      return Number(amount) * rate;
    },
    [currency, rates]
  );

  const fromBdt = React.useCallback(
    (amount) => {
      const rate = rates[currency] || 1;
      return Number(amount) / rate;
    },
    [currency, rates]
  );

  const symbol = currency === "USD" ? "$" : currency === "GBP" ? "£" : "৳";

  return {
    currency,
    setCurrency,
    rates,
    setRates,
    toBdt,
    fromBdt,
    symbol,
  };
};
