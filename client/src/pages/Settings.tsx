import { useEffect, useState, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useAuth } from "../lib/auth-context";
import { api, apiErrorMessage } from "../lib/api";
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushSubscriptionStatus,
  isPushSupported,
  sendTestNotification,
} from "../lib/push";
import { isBankLinkingEnabled, createLinkToken, exchangePublicToken } from "../lib/plaid";
import type { BankConnection } from "../lib/types";
import { formatDate } from "../lib/format";

type PushStatus = "unsupported" | "denied" | "subscribed" | "unsubscribed" | "loading";

function ConnectBankButton({ onConnected }: { onConnected: () => void }) {
  const [linkToken, setLinkToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    createLinkToken()
      .then(setLinkToken)
      .catch((err) => setError(apiErrorMessage(err, "Unable to start a bank connection")));
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken) => {
      if (!publicToken) return;
      setBusy(true);
      setError(null);
      try {
        await exchangePublicToken(publicToken);
        onConnected();
      } catch (err) {
        setError(apiErrorMessage(err, "Could not finish connecting that account"));
      } finally {
        setBusy(false);
      }
    },
  });

  return (
    <div>
      <button
        onClick={() => open()}
        disabled={!ready || busy}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
      >
        {busy ? "Connecting..." : "Connect a bank or credit card"}
      </button>
      {error && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}

function BankConnections() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadConnections = useCallback(() => {
    api
      .get<BankConnection[]>("/plaid/connections")
      .then((res) => setConnections(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    isBankLinkingEnabled().then((isEnabled) => {
      setEnabled(isEnabled);
      if (isEnabled) loadConnections();
    });
  }, [loadConnections]);

  async function syncNow(id: string) {
    setBusyId(id);
    setMessage(null);
    try {
      await api.post(`/plaid/connections/${id}/sync`);
      setMessage("Synced — check Expenses and Income for new transactions.");
      loadConnections();
    } catch (err) {
      setMessage(apiErrorMessage(err, "Sync failed"));
    } finally {
      setBusyId(null);
    }
  }

  async function disconnect(id: string, institutionName: string | null) {
    if (!confirm(`Disconnect ${institutionName ?? "this account"}? Past transactions stay, future ones won't sync.`)) return;
    setBusyId(id);
    try {
      await api.delete(`/plaid/connections/${id}`);
      loadConnections();
    } catch (err) {
      setMessage(apiErrorMessage(err, "Could not disconnect"));
    } finally {
      setBusyId(null);
    }
  }

  if (enabled === false) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Bank connections aren't set up on the server yet (missing Plaid API keys), so this account is manual-entry
        only for now.
      </p>
    );
  }

  if (enabled === null) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Checking...</p>;
  }

  return (
    <div className="space-y-3">
      {connections.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No bank or credit card connected yet. Connect one to pull in transactions automatically instead of typing
          them in.
        </p>
      ) : (
        <ul className="space-y-2">
          {connections.map((conn) => (
            <li
              key={conn.id}
              className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800"
            >
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {conn.institutionName ?? "Connected account"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {conn.accounts.map((a) => `${a.name}${a.mask ? ` ••${a.mask}` : ""}`).join(", ")}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {conn.lastSyncedAt ? `Last synced ${formatDate(conn.lastSyncedAt)}` : "Not synced yet"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => syncNow(conn.id)}
                  disabled={busyId === conn.id}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
                >
                  Sync now
                </button>
                <button
                  onClick={() => disconnect(conn.id, conn.institutionName)}
                  disabled={busyId === conn.id}
                  className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 disabled:opacity-60 dark:border-rose-900 dark:text-rose-400"
                >
                  Disconnect
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConnectBankButton onConnected={loadConnections} />
      {message && <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>}
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const [status, setStatus] = useState<PushStatus>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) {
      setStatus("unsupported");
      return;
    }
    getPushSubscriptionStatus().then(setStatus);
  }, []);

  async function handleEnable() {
    setBusy(true);
    setMessage(null);
    try {
      await enablePushNotifications();
      setStatus("subscribed");
      setMessage("Reminders enabled on this device.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not enable notifications");
      setStatus(await getPushSubscriptionStatus());
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);
    setMessage(null);
    try {
      await disablePushNotifications();
      setStatus("unsubscribed");
      setMessage("Reminders disabled on this device.");
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    setBusy(true);
    setMessage(null);
    try {
      await sendTestNotification();
      setMessage("Test notification sent — check your notifications.");
    } catch {
      setMessage("Could not send a test notification.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h1>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Account</h2>
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">Name</dt>
            <dd className="text-slate-900 dark:text-white">{user?.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">Email</dt>
            <dd className="text-slate-900 dark:text-white">{user?.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">Currency</dt>
            <dd className="text-slate-900 dark:text-white">{user?.currency}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Bank &amp; credit card connections</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Connect an account to pull in transactions automatically — spending becomes an expense, deposits become
          income, matched up so nothing gets logged twice.
        </p>
        <div className="mt-3">
          <BankConnections />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Bill reminders</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Get a browser notification a few days before a bill is due (and when it's overdue), even if the app isn't
          open. Enable this on every device you want reminders on.
        </p>

        <div className="mt-3">
          {status === "unsupported" && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              This browser doesn't support push notifications.
            </p>
          )}
          {status === "denied" && (
            <p className="text-sm text-rose-600 dark:text-rose-400">
              Notifications are blocked for this site in your browser settings. Allow notifications and reload the
              page to enable reminders.
            </p>
          )}
          {status === "unsubscribed" && (
            <button
              onClick={handleEnable}
              disabled={busy}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              Enable reminders on this device
            </button>
          )}
          {status === "subscribed" && (
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                Enabled on this device
              </span>
              <button
                onClick={handleTest}
                disabled={busy}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                Send test notification
              </button>
              <button
                onClick={handleDisable}
                disabled={busy}
                className="rounded-md border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 dark:border-rose-900 dark:text-rose-400"
              >
                Disable
              </button>
            </div>
          )}
          {message && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{message}</p>}
        </div>
      </section>
    </div>
  );
}
