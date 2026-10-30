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

const timelineLabels = {
  'urgent': 'Tres urgent (1-2 semaines)',
  '1-2-mois': '1-2 mois',
  '2-3-mois': '2-3 mois',
  '3-6-mois': '3-6 mois',
  'flexible': 'Flexible, pas urgent',
};

const expensiveLabels = {
  'oui-trop': 'Oui, c\'etait trop cher pour moi',
  'oui-valeur': 'Oui, le rapport qualite-prix n\'etait pas bon',
  'non-ok': 'Non, le prix etait correct',
  'uncertain': 'Je ne sais pas',
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
  const timeline = timelineLabels[data.timeline] || data.timeline || 'Non renseigne';
  const expensive = expensiveLabels[data.expensive] || data.expensive || 'Non renseigne';
  const trust = parseInt(data.trust) || 0;
  const interest = parseInt(data.interest) || 0;
  const costValue = parseInt(data.costValue) || 0;
  const message = data.message || 'Aucun';
  const autreResult = data.autreResult || '';
  const budgetMax = data.budgetMax || 'Non renseigne';
  const scope = data.scope || 'Non renseigne';
  const wouldBook = data.wouldBook || 'Non renseigne';
  const expensiveWhy = data.expensiveWhy || 'Non renseigne';

  // 1. Create/Update Brevo contact
  await brevoRequest('https://api.brevo.com/v3/contacts', {
    email,
    attributes: {
      BF_PROJECT: project,
      BF_OBJECTIONS: objections.join(', '),
      BF_BUDGET_MAX: budgetMax,
      BF_TIMELINE: timeline,
      BF_SCOPE: scope,
      BF_WOULD_BOOK: wouldBook,
      BF_EXPENSIVE: expensive,
      BF_EXPENSIVE_WHY: expensiveWhy,
      BF_COST_VALUE: String(costValue),
      BF_TRUST: String(trust),
      BF_INTEREST: String(interest),
      BF_TRIGGERS: triggers.join(', '),
      BF_MESSAGE: data.message || '',
    },
    updateEnabled: true,
  });

  // 2. Notification email
  const trustBar = '★'.repeat(trust) + '☆'.repeat(5 - trust);
  const interestBar = '★'.repeat(interest) + '☆'.repeat(5 - interest);
  const costValueBar = '★'.repeat(costValue) + '☆'.repeat(5 - costValue);

  const notifHtml = `
<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">
  <div style="background:#f59e0b;color:#000;padding:16px 24px;border-radius:8px 8px 0 0;">
    <h2 style="margin:0;">🔥 Nouvelle reponse Black Friday 2026</h2>
  </div>
  <div style="background:#1a1a1a;color:#fafaf9;padding:24px;border-radius:0 0 8px 8px;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr><td style="padding:6px 0;color:#999;width:160px;">Email</td><td style="padding:6px 0;"><strong>${email}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#999;">Projet</td><td style="padding:6px 0;">${project}</td></tr>
      <tr><td style="padding:6px 0;color:#999;">Freins</td><td style="padding:6px 0;">${objections.length ? objections.join(' | ') : 'Aucun'}</td></tr>
      ${autreResult ? `<tr><td style="padding:6px 0;color:#999;">Autre offre</td><td style="padding:6px 0;">${autreResult}</td></tr>` : ''}
      <tr style="border-top:1px solid rgba(255,255,255,0.1);"><td style="padding:6px 0;color:#999;">Budget max</td><td style="padding:6px 0;">${budgetMax}</td></tr>
      <tr><td style="padding:6px 0;color:#999;">Timeline</td><td style="padding:6px 0;">${timeline}</td></tr>
      <tr><td style="padding:6px 0;color:#999;">Scope</td><td style="padding:6px 0;word-break:break-word;">${scope}</td></tr>
      <tr style="border-top:1px solid rgba(255,255,255,0.1);"><td style="padding:6px 0;color:#999;">Aurait boucle ?</td><td style="padding:6px 0;word-break:break-word;">${wouldBook}</td></tr>
      <tr><td style="padding:6px 0;color:#999;">Trop cher ?</td><td style="padding:6px 0;">${expensive}</td></tr>
      <tr><td style="padding:6px 0;color:#999;">Pourquoi ?</td><td style="padding:6px 0;word-break:break-word;">${expensiveWhy}</td></tr>
      <tr style="border-top:1px solid rgba(255,255,255,0.1);"><td style="padding:6px 0;color:#999;">Cout vs Valeur</td><td style="padding:6px 0;">${costValueBar} (${costValue}/5)</td></tr>
      <tr><td style="padding:6px 0;color:#999;">Interet</td><td style="padding:6px 0;">${interestBar} (${interest}/5)</td></tr>
      <tr><td style="padding:6px 0;color:#999;">Confiance</td><td style="padding:6px 0;">${trustBar} (${trust}/5)</td></tr>
      <tr><td style="padding:6px 0;color:#999;">Declencheurs</td><td style="padding:6px 0;">${triggers.length ? triggers.join(' | ') : 'Aucun'}</td></tr>
      <tr style="border-top:1px solid rgba(255,255,255,0.1);"><td style="padding:6px 0;color:#999;">Message</td><td style="padding:6px 0;word-break:break-word;">${message}</td></tr>
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
