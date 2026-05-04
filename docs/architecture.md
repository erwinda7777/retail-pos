# Architecture

## Data Model

- `User`: tai khoan, vai tro `ADMIN` hoac `STAFF`.
- `Category`: nhom hang.
- `Product`: SKU, barcode, gia nhap, gia ban, ton kho, nguong canh bao.
- `Customer`: thong tin khach va cong no.
- `Order` va `OrderItem`: lich su ban hang.
- `StockMovement`: nhat ky nhap, xuat, ban hang, dieu chinh.

## Backend Layers

- `src/app.js`: khoi tao Express, middleware, mount routes.
- `src/middleware/auth.js`: JWT auth va role guard.
- `src/middleware/validate.js`: validate body/query/params bang Zod.
- `src/routes/*.routes.js`: RESTful endpoints.
- `src/config/prisma.js`: Prisma client singleton.

## Security

- Password hash bang bcrypt.
- JWT bearer token.
- Zod input validation.
- Helmet security headers.
- Role-based authorization cho user/category/product mutations.

## Scaling Path

- Tach report thanh read replica khi du lieu lon.
- Them Redis cache cho dashboard.
- Dung queue cho Telegram/email/print jobs.
- Them multi-branch inventory bang model `Branch` va `InventoryBalance` neu can chuoi cua hang.
