const crypto = require("crypto");

const FLOW_API_KEY = process.env.FLOW_API_KEY;
const FLOW_SECRET  = process.env.FLOW_SECRET_KEY;
const FLOW_BASE    = process.env.FLOW_ENV === "production"
  ? "https://www.flow.cl/api"
  : "https://sandbox.flow.cl/api";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const OWNER_EMAIL  = process.env.OWNER_EMAIL;

function sign(params) {
  const keys = Object.keys(params).sort();
  const str  = keys.map(k => k + params[k]).join("");
  return crypto.createHmac("sha256", FLOW_SECRET).update(str).digest("hex");
}

module.exports = async (req, res) => {
  const token = req.body?.token || req.query?.token;
  if (!token) return res.status(400).end();

  // Verificar estado del pago con Flow
  const params = { apiKey: FLOW_API_KEY, token };
  params.s = sign(params);
  const qs = new URLSearchParams(params).toString();
  const flowRes = await fetch(`${FLOW_BASE}/payment/getStatus?${qs}`);
  const data = await flowRes.json();

  // Solo procesar pagos confirmados
  if (data.status !== 2) return res.status(200).end();

  // Recuperar datos del cliente guardados al crear la orden
  const sbRes = await fetch(
    `${SUPABASE_URL}/rest/v1/pagos?orden=eq.${data.commerceOrder}&select=nombre,telefono`,
    { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } }
  );
  const records = await sbRes.json();
  const stored  = records?.[0] || {};

  // Actualizar registro con el número de orden de Flow
  await fetch(`${SUPABASE_URL}/rest/v1/pagos?orden=eq.${data.commerceOrder}`, {
    method:  "PATCH",
    headers: {
      "apikey":        SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({ flow_order: String(data.flowOrder) }),
  });

  // Enviar email de notificación
  await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_KEY}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      from:    "Notificaciones <onboarding@resend.dev>",
      to:      OWNER_EMAIL,
      subject: `💰 Nuevo pago — ${stored.nombre || data.payer}`,
      html: `
        <h2 style="font-family:sans-serif">Nuevo pago confirmado</h2>
        <table style="border-collapse:collapse;font-family:sans-serif;font-size:15px">
          <tr><td style="padding:8px 16px 8px 0;font-weight:bold">Nombre</td><td style="padding:8px">${stored.nombre || "—"}</td></tr>
          <tr><td style="padding:8px 16px 8px 0;font-weight:bold">Email</td><td style="padding:8px">${data.payer}</td></tr>
          <tr><td style="padding:8px 16px 8px 0;font-weight:bold">Teléfono</td><td style="padding:8px">${stored.telefono || "—"}</td></tr>
          <tr><td style="padding:8px 16px 8px 0;font-weight:bold">Monto</td><td style="padding:8px">$${Number(data.amount).toLocaleString("es-CL")}</td></tr>
          <tr><td style="padding:8px 16px 8px 0;font-weight:bold">Orden</td><td style="padding:8px">${data.commerceOrder}</td></tr>
        </table>
      `,
    }),
  });

  res.status(200).end();
};
