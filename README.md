# mellax-business-crm-oy

This is a [Next.js](https://nextjs.org) project bootstrapped with [v0](https://v0.app).

## Local development (backend + frontend)

```bash
# Backend (Python 3.12+, since Django 6.x)
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # sets DEBUG=True - don't skip this
python manage.py migrate
python manage.py runserver 8001

# Frontend (another terminal)
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://127.0.0.1:8001" > .env.local
npm run dev                   # http://localhost:3000
```

### Creating your own login account

New accounts can't log in until their email is verified (`LoginSerializer` returns
"Please verify your email before logging in."), and in local dev the console email
backend only *prints* the verification link to the `runserver` terminal - nothing is
actually emailed. So either:

- **Recommended:** fill in `DJANGO_SUPERUSER_EMAIL`, `DJANGO_SUPERUSER_PASSWORD` and
  `DJANGO_SUPERUSER_BUSINESS_NAME` in `backend/.env` (or export them), then run
  `python manage.py ensure_superuser`. It creates the account (or fixes up an existing
  one with that email) as an email-verified superuser, and is safe to re-run. This is
  the same command Render runs on every deploy.
- Or, for an account you already signed up with, open the verification link printed in
  the `runserver` output, or mark it verified:
  `python manage.py shell -c "from accounts.models import BusinessAccount as B; B.objects.filter(email='you@example.com').update(is_email_verified=True)"`

### Login troubleshooting

- **"Can't reach the MellaX API at ..."** - the backend isn't running, `NEXT_PUBLIC_API_URL`
  is wrong, or the frontend's origin isn't in `CORS_ALLOWED_ORIGINS`.
- **"Please verify your email before logging in."** - see above.
- **"Request was throttled."** - login/signup/password-reset share the `auth` throttle,
  10 requests per minute per IP (`DEFAULT_THROTTLE_RATES` in `backend/mellax/settings.py`).
- Logging in takes ~0.6s on the backend by design: that's Django's PBKDF2 password check.
  The first visit to `/dashboard` in `next dev` also compiles that page once (~1s).

## Built with v0

This repository is linked to a [v0](https://v0.app) project. You can continue developing by visiting the link below -- start new chats to make changes, and v0 will push commits directly to this repo. Every merge to `main` will automatically deploy.

[Continue working on v0 →](https://v0.app/chat/projects/prj_Z8GAWwIGZbravpFp3zyPZc27SdBY)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.
