# Deploy online khong can Docker

Muc tieu: dua app len web de dung nhu phan mem online. Sau khi lam xong, ban chi mo link frontend va dang nhap.

Dung 3 dich vu:

- Neon: PostgreSQL database.
- Render: backend API Node.js.
- Vercel: frontend React.

## 1. Dua code len GitHub

1. Tao repository moi tren GitHub.
2. Upload toan bo thu muc du an nay len repository.

Neu dung Git:

```bash
git init
git add .
git commit -m "Initial retail POS system"
git branch -M main
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

## 2. Tao database Neon

1. Vao `https://neon.tech`.
2. Dang ky/dang nhap.
3. Tao project moi.
4. Copy connection string PostgreSQL.

Connection string thuong co dang:

```text
postgresql://user:password@host/database?sslmode=require
```

Giu lai chuoi nay de gan vao Render.

## 3. Deploy backend len Render

1. Vao `https://render.com`.
2. Chon New -> Blueprint.
3. Ket noi GitHub repo.
4. Render se doc file `render.yaml`.
5. Dien environment variables:

```text
DATABASE_URL=<connection string Neon>
CORS_ORIGIN=https://<frontend-vercel-domain>
```

Luc frontend chua deploy, co the tam thoi dien:

```text
CORS_ORIGIN=http://localhost:5173
```

Sau khi deploy frontend xong, quay lai sua thanh domain Vercel.

6. Bam Deploy.

Backend sau deploy se co URL dang:

```text
https://retail-pos-api.onrender.com
```

Kiem tra:

```text
https://retail-pos-api.onrender.com/health
```

Neu tra ve `{"ok":true}` la backend da chay.

## 4. Deploy frontend len Vercel

1. Vao `https://vercel.com`.
2. Add New Project.
3. Import GitHub repo.
4. Trong phan project settings:

```text
Root Directory: frontend
Build Command: npm run build
Output Directory: dist
```

5. Them environment variable:

```text
VITE_API_URL=https://retail-pos-api.onrender.com/api
```

Thay domain backend Render cua ban vao.

6. Bam Deploy.

Frontend sau deploy se co URL dang:

```text
https://retail-pos.vercel.app
```

## 5. Cap nhat CORS tren Render

Sau khi co domain Vercel, quay lai Render -> backend service -> Environment.

Sua:

```text
CORS_ORIGIN=https://retail-pos.vercel.app
```

Bam Save, Render se redeploy.

## 6. Dang nhap

Mo frontend Vercel:

```text
https://retail-pos.vercel.app
```

Tai khoan mau:

```text
admin@example.com
123456
```

Nhan vien:

```text
staff@example.com
123456
```

## 7. Khi cap nhat code

Chi can push code len GitHub:

```bash
git add .
git commit -m "Update app"
git push
```

Render va Vercel se tu deploy lai.

## Loi hay gap

### Frontend bao loi khi dang nhap

Kiem tra `VITE_API_URL` tren Vercel phai co `/api`:

```text
https://retail-pos-api.onrender.com/api
```

### Backend bi CORS

Kiem tra `CORS_ORIGIN` tren Render phai dung domain frontend:

```text
https://retail-pos.vercel.app
```

Khong them dau `/` o cuoi.

### Render free bi cham lan dau

Render free co the sleep khi khong dung. Lan dau mo app, backend mat 30-60 giay de wake up.
