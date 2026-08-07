import { api } from "./api";

export async function isBankLinkingEnabled(): Promise<boolean> {
  const { data } = await api.get<{ enabled: boolean }>("/plaid/enabled");
  return data.enabled;
}

export async function createLinkToken(): Promise<string> {
  const { data } = await api.post<{ linkToken: string }>("/plaid/link-token");
  return data.linkToken;
}

export async function exchangePublicToken(publicToken: string): Promise<void> {
  await api.post("/plaid/exchange-public-token", { publicToken });
}
