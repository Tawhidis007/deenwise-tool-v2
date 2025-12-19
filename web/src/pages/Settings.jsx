import React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchDisplaySettings, updateDisplaySettings } from "../api/settings";
import { useCurrency } from "../hooks/useCurrency";

const SettingsPage = () => {
  const { currency, setCurrency } = useCurrency();
  const [rates, setRates] = React.useState({ USD: 117, GBP: 146, BDT: 1 });
  const [statusMsg, setStatusMsg] = React.useState("");

  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: fetchDisplaySettings });

  React.useEffect(() => {
    if (settingsQuery.data) {
      setCurrency(settingsQuery.data.currency || "BDT");
      setRates(settingsQuery.data.exchange_rates || { USD: 117, GBP: 146, BDT: 1 });
    }
  }, [settingsQuery.data, setCurrency]);

  const updateMut = useMutation({
    mutationFn: updateDisplaySettings,
    onSuccess: (data) => {
      setStatusMsg("Exchange rates updated.");
      setCurrency(data.currency);
      setRates(data.exchange_rates);
    },
    onError: () => setStatusMsg("Failed to update settings."),
  });

  const handleSave = () => {
    updateMut.mutate({ currency, exchange_rates: rates });
  };

  const onRateChange = (key, val) => {
    setRates((prev) => ({ ...prev, [key]: Number(val) }));
  };

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-wide text-accent">Settings</p>
        <h1 className="text-3xl font-semibold">Settings & Global Assumptions</h1>
        <p className="text-muted text-sm">Adjust currency display and exchange rates. More settings will come as the app expands.</p>
      </header>

      {statusMsg && <div className="text-sm text-accent">{statusMsg}</div>}

      <section className="card space-y-4">
        <h2 className="text-xl font-semibold">Currency Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted">Display all financials in:</label>
            <select
              className="mt-1 w-full bg-bg border border-border rounded px-3 py-2"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="BDT">BDT</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
          <div className="bg-bg border border-border rounded-lg p-3">
            <div className="text-xs text-muted uppercase tracking-wide">Current Symbol</div>
            <div className="text-xl font-semibold mt-1">{currency === "USD" ? "$" : currency === "GBP" ? "£" : "৳"}</div>
            <p className="text-muted text-sm mt-2">
              Showing all prices as {currency}. Internally, everything is still stored in BDT to keep calculations stable.
            </p>
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-xl font-semibold">Exchange Rates</h2>
        <p className="text-muted text-sm">Update only if needed. These rates convert BDT → USD/GBP for display.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-muted">1 BDT = 1 BDT</label>
            <input className="mt-1 w-full bg-bg border border-border rounded px-3 py-2" value={1} disabled />
          </div>
          <div>
            <label className="text-sm text-muted">1 USD = ... BDT</label>
            <input
              type="number"
              min="1"
              step="0.5"
              className="mt-1 w-full bg-bg border border-border rounded px-3 py-2"
              value={rates.USD}
              onChange={(e) => onRateChange("USD", e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-muted">1 GBP = ... BDT</label>
            <input
              type="number"
              min="1"
              step="0.5"
              className="mt-1 w-full bg-bg border border-border rounded px-3 py-2"
              value={rates.GBP}
              onChange={(e) => onRateChange("GBP", e.target.value)}
            />
          </div>
        </div>
        <button
          onClick={handleSave}
          className="bg-accent text-black px-4 py-2 rounded-md font-semibold"
          disabled={updateMut.isLoading}
        >
          Save Exchange Rates
        </button>
      </section>

      <section className="card">
        <p className="text-muted text-sm">
          Future items: VAT assumptions, default return/discount rates, manufacturing & shipping multipliers, yearly inflation assumptions, currency auto-refresh, user permissions & locking.
        </p>
      </section>
    </div>
  );
};

export default SettingsPage;
