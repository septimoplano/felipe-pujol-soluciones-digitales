const crypto = require("crypto");

const FLOW_API_KEY   = process.env.FLOW_API_KEY;
const FLOW_SECRET    = process.env.FLOW_SECRET_KEY;
const FLOW_BASE      = process.env.FLOW_ENV === "production"
  ? "https://www.flow.cl/api"
  : "https://sandbox.flow.cl/api";

const SUPABASE_URL   = process.env.SUPABASE_URL;
const SUPABASE_KEY   = process.env.SUPABASE_ANON_KEY;
const RESEND_KEY     = process.env.RESEND_API_KEY;
const OWNER_EMAIL    = process.env.OWNER_EMAIL; // tu email

function sign(params) {
  const keys = Object.keys(params).sort();
  const str  = keys.map(k => k + params[k]).join("");
  return crypto.createHmac("sha256", FLOW_SECRET).update(str).digest("hex");
}

async function getPaymentStatus(token) {
  const params = { apiKey: FLOW_API_KEY, token };
  params.s = sign(params);
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${FLOW_BASE}/payment/getStatus?${qs}`);
  return res.json();
}

async function saveToSupabase(pago) {
  await fetch(`${SUPABASE_URL}/rest/v1/pagos`, {
    method:  "POST",
    headers: {
      "apikey":        SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type":  "application/json",
      "Prefer":        "return=minimal",
    },
    body: JSON.stringify(pago),
  });
}

async function sendEmail(pago) {
  await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_KEY}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      from:    "Notificaciones <onboarding@resend.dev>",
      to:      OWNER_EMAIL,
      subject: `💰 Nuevo pago recibido — ${pago.nombre}`,
      html: `
        <h2>Nuevo pago confirmado</h2>
        <table style="border-collapse:collapse;font-family:sans-serif">
          <tr><td style="padding:8px;font-weight:bold">Nombre</td><td style="padding:8px">${pago.nombre}</td></tr>
          <tr><td style="padding:8px;font-weight:bold">Email</td><td style="padding:8px">${pago.email}</td></tr>
          <tr><td style="padding:8px;font-weight:bold">Teléfono</td><td style="padding:8px">${pago.telefono}</td></tr>
          <tr><td style="padding:8px;font-weight:bold">Monto</td><td style="padding:8px">$${Number(pago.monto).toLocaleString("es-CL")}</td></tr>
          <tr><td style="padding:8px;font-weight:bold">Orden</td><td style="padding:8px">${pago.orden}</td></tr>
        </table>
      `,
    }),
  });
}

module.exports = async (req, res) => {
  const token = req.body?.token || req.query?.token;
  if (!token) return res.status(400).end();

  const data = await getPaymentStatus(token);

  // status 2 = pagado
  if (data.status !== 2) return res.status(200).end();

  let nombre   = "";
  let telefono = "";
  try {
    const optional = JSON.parse(data.optional || "{}");
    nombre   = optional.name  || "";
    telefono = optional.phone || "";
  } catch {}

  const pago = {
    nombre,
    email:      data.payer,
    telefono,
    monto:      data.amount,
    orden:      data.commerceOrder,
    flow_order: String(data.flowOrder),
  };

  await Promise.all([
    saveToSupabase(pago),
    sendEmail(pago),
  ]);

  res.status(200).end();
};
