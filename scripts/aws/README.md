# SES inbound minta

Ez a mappa nem a Next.js app része, hanem külön deployolható AWS oldal.

Javasolt flow:

1. `Amazon SES` fogadja a bejövő e-mailt
2. receipt rule S3-ba menti a nyers `.eml` fájlt
3. `Lambda` lefut az S3 eseményre
4. a Lambda:
   - letölti az `.eml` fájlt
   - kiveszi a PDF csatolmányokat
   - feltölti őket a Supabase `documents` bucketbe
   - meghívja a Rentapp `/api/inbound/process` endpointját

## Fájlok

- `ses-s3-to-rentapp-lambda.mjs`: Node.js Lambda handler minta

## Szükséges package-ek a Lambda csomaghoz

```bash
npm install @aws-sdk/client-s3 @supabase/supabase-js postal-mime
```

## Szükséges environment változók

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RENTAPP_INBOUND_API_URL`
- `RENTAPP_INBOUND_PROCESS_SECRET`

## Várt API cél

A Lambda ezt a body-t küldi a Rentapp backendnek:

```json
{
  "recipient": "in-abc123@in.rentapp.hu",
  "messageId": "ses-message-id",
  "from": "provider@example.com",
  "subject": "Számla",
  "attachments": [
    {
      "fileName": "invoice.pdf",
      "storageBucket": "documents",
      "storageKey": "inbound-email/....pdf",
      "contentType": "application/pdf"
    }
  ]
}
```
