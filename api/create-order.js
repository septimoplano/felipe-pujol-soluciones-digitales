const crypto = require("crypto");

const FLOW_API_KEY = process.env.FLOW_API_KEY;
const FLOW_SECRET  = process.env.FLOW_SECRET_KEY;
const SITE_URL     = process.env.SITE_URL;
const FLOW_BASE    = process.env.FLOW_ENV === "production"
  ? "https://www.flow.cl/api"
  : "https://sandbox.flow.cl/api";

function sign(params) {
  const keys = Object.keys(params).sort();
  const str  = keys.map(k => k + params[k]).join("");
  return crypto.createHmac("sha256", FLOW_SECRET).update(str).digest("hex");
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();

  const { name, email, phone, amount } = req.body;
  if (!email || !name || !amount) return res.status(400).json({ error: "Datos incompletos" });

  const commerceOrder = `FP-${Date.now()}`;

  const params = {
    apiKey:          FLOW_API_KEY,
    commerceOrder,
    subject:         "Asesoría 1 hora — Felipe Pujol",
    currency:        "CLP",
    amount:          String(amount),
    email,
    optional:        JSON.stringify({ name, phone }),
    urlConfirmation: `${SITE_URL}/api/confirm`,
    urlReturn:       `${SITE_URL}/api/return`,
  };
  params.s = sign(params);

  const body = new URLSearchParams(params).toString();

  const response = await fetch(`${FLOW_BASE}/payment/create`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await response.json();

  if (data.url && data.token) {
    return res.json({ redirect: `${data.url}?token=${data.token}` });
  }

  res.status(500).json({ error: data.message || "Error al crear la orden en Flow" });
};
