const DRIVE_FOLDER_ID = "1j4HEhT7Gqyi3d17XAdC0wOF3Rh2FRuXH";
const API_URL = "https://www.rentapp.hu/api/invoices/import";
const API_TOKEN = "REPLACE_WITH_IMPORT_SECRET";
const PROCESSED_FOLDER_NAME = "Processed";

function processInvoices() {
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const processedFolder = getOrCreateProcessedFolder(folder, PROCESSED_FOLDER_NAME);
  const files = folder.getFilesByType(MimeType.PDF);

  while (files.hasNext()) {
    const file = files.next();
    if (isInFolder(file, processedFolder)) {
      continue;
    }

    const blob = file.getBlob();
    const boundary = "----RentSaasBoundary" + new Date().getTime();
    const payload = buildMultipart(boundary, "file", blob, file.getName());

    const res = UrlFetchApp.fetch(API_URL, {
      method: "post",
      contentType: "multipart/form-data; boundary=" + boundary,
      payload: payload,
      headers: {
        Authorization: "Bearer " + API_TOKEN,
      },
      muteHttpExceptions: true,
    });

    const code = res.getResponseCode();
    if (code >= 200 && code < 300) {
      file.moveTo(processedFolder);
    }
  }
}

function buildMultipart(boundary, fieldName, blob, filename) {
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close = "\r\n--" + boundary + "--";
  const metadata =
    "Content-Disposition: form-data; name=\"" +
    fieldName +
    "\"; filename=\"" +
    filename +
    "\"\r\n" +
    "Content-Type: " +
    blob.getContentType() +
    "\r\n\r\n";

  const bytes = Utilities.newBlob("")
    .setDataFromString(delimiter + metadata)
    .getBytes()
    .concat(blob.getBytes())
    .concat(Utilities.newBlob("").setDataFromString(close).getBytes());

  return bytes;
}

function getOrCreateProcessedFolder(parent, name) {
  const folders = parent.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parent.createFolder(name);
}

function isInFolder(file, folder) {
  const parents = file.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === folder.getId()) {
      return true;
    }
  }
  return false;
}
