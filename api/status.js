// El frontend llama a este endpoint al volver desde Flow para saber si el pago fue exitoso
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
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "Token requerido" });

  const params = { apiKey: FLOW_API_KEY, token };
  params.s = sign(params);
  const qs = new URLSearchParams(params).toString();

  const response = await fetch(`${FLOW_BASE}/payment/getStatus?${qs}`);
  const data = await response.json();

  res.json({
    status:        data.status,       // 2 = pagado
    amount:        data.amount,
    commerceOrder: data.commerceOrder,
    flowOrder:     data.flowOrder,
    subject:       data.subject,
  });
};
