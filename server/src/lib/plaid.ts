import { Configuration, PlaidApi, PlaidEnvironments, CountryCode, Products } from "plaid";

const clientId = process.env.PLAID_CLIENT_ID || "";
const secret = process.env.PLAID_SECRET || "";
const env = process.env.PLAID_ENV || "sandbox";

export const plaidEnabled = Boolean(clientId && secret);

export const plaidClient = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[env] ?? PlaidEnvironments.sandbox,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  })
);

export const PLAID_PRODUCTS = (process.env.PLAID_PRODUCTS || "transactions").split(",") as Products[];
export const PLAID_COUNTRY_CODES = (process.env.PLAID_COUNTRY_CODES || "US,CA").split(",") as CountryCode[];
