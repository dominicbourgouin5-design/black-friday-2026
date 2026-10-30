const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// ─── CONFIG ───
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'jbillcataria@gmail.com';
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'contact@cataria-systems.com';
const SENDER_NAME = process.env.SENDER_NAME || 'Cataria Systems';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Labels ───
const projectLabels = {
  'le-palmier-dor': "Le Palmier d'Or (Restaurant)",
  'maison-adja': 'Maison Adja (Mode & Couture)',
  'clinique-gbeto': 'Clinique Gbeto (Cabinet medical)',
  'fondation-soleil-davenir': "Fondation Soleil d'Avenir (ONG)",
  'auto-ecole-la-victoire': 'Auto-Ecole La Victoire',
  'sika-immobilier': 'Sika Immobilier',
  'glam-by-nafi': 'Glam by Nafi (Institut beaute)',
  'terre-davie': "Terre d'Avie (Agribusiness)",
  'cabinet-me-hounkpatin': 'Cabinet Me Hounkpatin (Avocat)',
  'dako-events': 'Dako Events (Evenementiel)',
  'resa-sport-academy': 'Resa Sport Academy',
};

const objectionLabels = {
  'prix': 'Le prix ne passait pas',
  'pas-le-moment': "Ce n'etait pas le moment",
  'pas-convaincu': 'Pas convaincu par la proposition',
  'autre-offre': 'Parti avec un autre prestataire',
  'complique': 'Trop complique / pas clair',
  'confiance': 'Manque de confiance',
};

const triggerLabels = {
  'prix-reduit': 'Un prix vraiment reduit',
  'paiement-echelonne': 'Pouvoir payer en plusieurs fois',
  'garantie': 'Garantie satisfait ou rembourse',
  'voir-avant': 'Voir un apercu avant de payer',
  'bonus': 'Des bonus offerts',
};

const budgetLabels = {
  'moins-100k': 'Moins de 100 000 FCFA',
  '100-200k': '100 000 - 200 000 FCFA',
  '200-350k': '200 000 - 350 000 FCFA',
  '350-500k': '350 000 - 500 000 FCFA',
  '500k+': 'Plus de 500 000 FCFA',
  'paiement-echelonne': 'Prefere payer en plusieurs fois',
};

// ─── Brevo API helper ───
async function brevoRequest(url, payload) {
  console.log(`[BREVO] Calling ${url}...`);
  console.log(`[BREVO] API Key present: ${!!BREVO_API_KEY}`);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    console.log(`[BREVO] Response (${res.status}):`, JSON.stringify(body).substring(0, 200));
    if (!res.ok) {
      console.error(`[BREVO] API error (${res.status}):`, body);
    }
    return { code: res.status, body };
  } catch (err) {
    console.error('[BREVO] Request failed:', err.message);
    return { code: 500, body: { error: err.message } };
  }
}

// ─── Submit endpoint ───
app.post('/submit', async (req, res) => {
  const data = req.body;

  if (!data || !data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return res.status(400).json({ error: 'Email invalide' });
  }

  const email = data.email;
  const project = projectLabels[data.project] || data.project || 'Non selectionne';
  const objections = (data.objections || []).map(o => objectionLabels[o] || o);
  const triggers = (data.triggers || []).map(t => triggerLabels[t] || t);
  const budget = budgetLabels[data.budget] || data.budget || 'Non renseigne';
  const urgency = parseInt(data.urgency) || 0;
  const trust = parseInt(data.trust) || 0;
  const message = data.message || 'Aucun';
  const autreResult = data.autreResult || '';

  // 1. Create/Update Brevo contact
  await brevoRequest('https://api.brevo.com/v3/contacts', {
    email,
    attributes: {
      BF_PROJECT: project,
      BF_OBJECTIONS: objections.join(', '),
      BF_BUDGET: budget,
      BF_URGENCY: urgency,
      BF_TRUST: trust,
      BF_TRIGGERS: triggers.join(', '),
      BF_MESSAGE: data.message || '',
    },
    updateEnabled: true,
  });

  // 2. Notification email
  const urgencyBar = '★'.repeat(urgency) + '☆'.repeat(5 - urgency);
  const trustBar = '★'.repeat(trust) + '☆'.repeat(5 - trust);

  const notifHtml = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#f59e0b;color:#000;padding:16px 24px;border-radius:8px 8px 0 0;">
    <h2 style="margin:0;">🔥 Nouvelle reponse Black Friday</h2>
  </div>
  <div style="background:#1a1a1a;color:#fafaf9;padding:24px;border-radius:0 0 8px 8px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:8px 0;color:#999;width:140px;">Email</td><td style="padding:8px 0;"><strong>${email}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#999;">Projet</td><td style="padding:8px 0;">${project}</td></tr>
      <tr><td style="padding:8px 0;color:#999;">Freins</td><td style="padding:8px 0;">${objections.length ? objections.join('<br>') : 'Aucun'}</td></tr>
      ${autreResult ? `<tr><td style="padding:8px 0;color:#999;">Autre presta</td><td style="padding:8px 0;">${autreResult}</td></tr>` : ''}
      <tr><td style="padding:8px 0;color:#999;">Urgence</td><td style="padding:8px 0;">${urgencyBar} (${urgency}/5)</td></tr>
      <tr><td style="padding:8px 0;color:#999;">Budget</td><td style="padding:8px 0;">${budget}</td></tr>
      <tr><td style="padding:8px 0;color:#999;">Declencheurs</td><td style="padding:8px 0;">${triggers.length ? triggers.join('<br>') : 'Aucun'}</td></tr>
      <tr><td style="padding:8px 0;color:#999;">Confiance</td><td style="padding:8px 0;">${trustBar} (${trust}/5)</td></tr>
      <tr><td style="padding:8px 0;color:#999;">Message</td><td style="padding:8px 0;">${message}</td></tr>
    </table>
  </div>
</div>`;

  await brevoRequest('https://api.brevo.com/v3/smtp/email', {
    sender: { name: SENDER_NAME, email: SENDER_EMAIL },
    to: [{ email: NOTIFY_EMAIL, name: SENDER_NAME }],
    subject: `🔥 BF2026 — ${project} — ${email}`,
    htmlContent: notifHtml,
  });

  // 3. Confirmation email to prospect
  const confirmHtml = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:linear-gradient(135deg,#f59e0b,#f97316);color:#000;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
    <h1 style="margin:0 0 8px;font-size:22px;">Merci pour votre reponse !</h1>
    <p style="margin:0;font-size:14px;opacity:0.8;">Black Friday 2026 — Cataria Systems</p>
  </div>
  <div style="background:#ffffff;color:#333;padding:24px;border-radius:0 0 8px 8px;">
    <p>Bonjour,</p>
    <p>Nous avons bien recu vos reponses concernant votre projet <strong>${project}</strong>.</p>
    <p>Notre equipe analyse vos besoins et vous contactera <strong>avant le Black Friday</strong> avec une offre personnalisee qui repond a vos attentes.</p>
    <p style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:4px;margin:20px 0;">
      💡 <strong>En attendant</strong>, n'hesitez pas a repondre a cet email si vous avez des questions ou des precisions a ajouter.
    </p>
    <p>A tres bientot,<br><strong>L'equipe Cataria Systems</strong></p>
  </div>
  <div style="text-align:center;padding:16px;color:#999;font-size:12px;">
    Cataria Systems — cataria-systems.com
  </div>
</div>`;

  await brevoRequest('https://api.brevo.com/v3/smtp/email', {
    sender: { name: SENDER_NAME, email: SENDER_EMAIL },
    to: [{ email }],
    subject: 'Merci ! Votre offre Black Friday est en preparation 🎁',
    htmlContent: confirmHtml,
  });

  console.log(`[${new Date().toISOString()}] Submission from ${email} — ${project}`);
  res.json({ success: true, message: 'Merci ! Votre reponse a ete enregistree.' });
});

app.listen(PORT, () => {
  console.log(`Black Friday server running on port ${PORT}`);
});
