# SES inbound minta

Ez a mappa nem a Next.js app része, hanem külön deployolható AWS oldal.

Javasolt flow:

1. `Amazon SES` fogadja a bejövő e-mailt
2. receipt rule S3-ba menti a nyers `.eml` fájlt
3. `Lambda` lefut az S3 eseményre
4. a Lambda:
   - letölti az `.eml` fájlt
   - kiveszi a PDF csatolmányokat
   - feltölti őket a Cloudflare R2 `rentapp` bucketbe
   - meghívja a Rentapp `/api/inbound/process` endpointját

## Fájlok

- `ses-s3-to-rentapp-lambda.mjs`: Node.js Lambda handler minta

## Szükséges package-ek a Lambda csomaghoz

```bash
npm install @aws-sdk/client-s3 postal-mime
```

## Szükséges environment változók

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
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
      "storageBucket": "rentapp",
      "storageKey": "inbound-email/....pdf",
      "contentType": "application/pdf"
    }
  ]
}
```
