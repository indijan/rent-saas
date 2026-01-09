# Google Drive PDF import

This flow watches a Drive folder and sends new PDFs to the app. The app runs OCR/AI, creates the invoice charge, uploads the document, and emails the owner with a status report.

## App configuration

Add these to `.env.local` and Vercel:

```
IMPORT_SECRET=replace-with-strong-secret
IMPORT_PROPERTY_ID=8d4017a4-0aa3-4b42-9b96-45f8874ea4af
IMPORT_OWNER_EMAIL=indijanmac@gmail.com
```

Optional:

```
AZURE_OCR_MODEL_ID=mvm
```

## Apps Script setup

1) Open https://script.google.com  
2) New project → paste the content of `scripts/google-drive-import.gs`  
3) Replace:
   - `API_URL` → `https://www.rentapp.hu/api/invoices/import`
   - `API_TOKEN` → the same value as `IMPORT_SECRET`
4) Save

## Trigger (low frequency is fine)

Apps Script → Triggers → Add Trigger:
- Function: `processInvoices`
- Deployment: Head
- Event source: Time-driven
- Type: Every 6 hours (or daily)

## Processed files

Processed PDFs are moved into a `Processed` subfolder within the same Drive folder.

## API contract

- Method: `POST`
- URL: `/api/invoices/import`
- Auth: `Authorization: Bearer <IMPORT_SECRET>`
- Body: multipart/form-data with field `file` (PDF)
