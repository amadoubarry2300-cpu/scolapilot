# ScolaPilot — Supabase / GitHub / Vercel

## Architecture

- **Supabase** : Auth, PostgreSQL, RLS, stockage des logos et photos.
- **React + Vite** : vitrine, démo dashboard et espace connecté.
- **GitHub** : dépôt du code et historique des versions.
- **Vercel** : déploiement automatique depuis GitHub.

## Fichiers importants

- `index.html` : vitrine publique ;
- `dashboard.html` : dashboard de démonstration avec données fictives ;
- `app.html` : application connectée à Supabase ;
- `supabase/schema.sql` : tables, fonctions RPC et RLS ;
- `.env.example` : variables attendues ;
- `vercel.json` : configuration de déploiement Vercel.

## 1. Supabase

1. Créer un projet Supabase.
2. Ouvrir **SQL Editor**.
3. Coller `supabase/schema.sql`.
4. Exécuter le script.
5. Vérifier les tables dans **Table Editor**.
6. Vérifier que la vue `student_balance_summary` utilise `security_invoker`.

Le schéma contient les niveaux :

- Préscolaire : Petite section, Moyenne section, Grande section ;
- Primaire : CP1, CP2, CE1, CE2, CM1, CM2 ;
- Postprimaire : 6e, 5e, 4e, 3e ;
- Secondaire : 2nde, 1ère, Tle.

## 2. Développement local

Installer les dépendances :

```bash
npm install
```

Créer la configuration locale :

```bash
cp .env.example .env.local
```

Puis renseigner :

```env
VITE_SUPABASE_URL=https://ton-projet.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Lancer le projet :

```bash
npm run dev
```

Pages locales :

- `http://localhost:5173/` : vitrine ;
- `http://localhost:5173/demo` : dashboard de démonstration ;
- `http://localhost:5173/app` : espace connecté.

## 3. GitHub

Créer un dépôt **privé** sur GitHub, par exemple `scolapilot`.

Depuis ce dossier :

```bash
git init
git add .
git commit -m "Initialisation ScolaPilot"
git branch -M main
git remote add origin https://github.com/TON_COMPTE/scolapilot.git
git push -u origin main
```

Ne jamais committer `.env.local`, une clé `service_role` ou un mot de passe.

Le build est vérifié localement avec `npm run build` avant chaque déploiement. Une GitHub Action pourra être ajoutée ensuite si le scope `workflow` est activé sur le compte.

## 4. Vercel

1. Ouvrir Vercel et cliquer sur **Add New Project**.
2. Importer le dépôt GitHub `scolapilot`.
3. Laisser Vercel détecter Vite.
4. Ajouter dans **Environment Variables** :

```env
VITE_SUPABASE_URL=https://ton-projet.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

5. Ajouter les variables pour **Production**, **Preview** et **Development**.
6. Cliquer sur **Deploy**.

La configuration `vercel.json` prévoit les routes :

- `/` : vitrine ;
- `/demo` : dashboard de démonstration ;
- `/app` : application Supabase connectée.

## 5. Après le premier déploiement

Dans Supabase, ajouter le domaine Vercel dans :

**Authentication → URL Configuration → Site URL**

Ajouter aussi l’URL de redirection autorisée si la confirmation e-mail est activée.

## Prochaine phase fonctionnelle

1. Ajouter les parents et tuteurs ;
2. créer les frais scolaires ;
3. enregistrer les paiements ;
4. générer les reçus PDF ;
5. calculer les impayés ;
6. ajouter les présences et les notes ;
7. tester avec une école pilote.
