// Flow POST a esta URL al volver del pago — redirigimos al home con el token
module.exports = (req, res) => {
  const token = req.body?.token || req.query?.token || "";
  const base  = process.env.SITE_URL || "";
  res.redirect(302, `${base}/?payment=return${token ? "&token=" + token : ""}`);
};
