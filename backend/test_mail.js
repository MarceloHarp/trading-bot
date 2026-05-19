const nodemailer = require('nodemailer');
require('dotenv').config();

const t = nodemailer.createTransport({
  host: process.env.ALERT_SMTP_HOST,
  port: Number(process.env.ALERT_SMTP_PORT),
  secure: false,
  auth: { user: process.env.ALERT_SMTP_USER, pass: process.env.ALERT_SMTP_PASS }
});

t.sendMail({
  from: process.env.ALERT_SMTP_USER,
  to: process.env.ALERT_EMAIL_TO,
  subject: 'Trading Bot — Test de conexion',
  text: 'Si ves este mail, las alertas estan configuradas correctamente.'
}).then(() => console.log('MAIL ENVIADO OK')).catch(e => console.error('ERROR:', e.message));
