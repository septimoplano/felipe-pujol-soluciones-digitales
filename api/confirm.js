// Webhook que Flow llama por POST cuando el pago se completa
const crypto = require("crypto");

const FLOW_API_KEY = process.env.FLOW_API_KEY;
const FLOW_SECRET  = process.env.FLOW_SECRET_KEY;
const FLOW_BASE    = process.env.FLOW_ENV === "production"
  ? "https://www.flow.cl/api"
  : "https://sandbox.flow.cl/api";

function sign(params) {
  const keys = Object.keys(params).sort();
  const str  = keys.map(k => k + params[k]).join("");
  return crypto.createHmac("sha256", FLOW_SECRET).update(str).digest("hex");
}

module.exports = async (req, res) => {
  const token = req.body?.token || req.query?.token;
  if (!token) return res.status(400).end();

  const params = { apiKey: FLOW_API_KEY, token };
  params.s = sign(params);
  const qs = new URLSearchParams(params).toString();

  const response = await fetch(`${FLOW_BASE}/payment/getStatus?${qs}`);
  const data = await response.json();

  // data.status: 1=pendiente 2=pagado 3=rechazado 4=anulado
  console.log("Flow confirm:", data.commerceOrder, "status:", data.status);

  res.status(200).end();
};
