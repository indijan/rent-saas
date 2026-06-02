# Rentapp Zárt App Funkcióleltár

Ez a dokumentum a belső, belépéshez kötött Rentapp felületek és funkciók összefoglalója. A publikus marketing oldalak, landing oldalak és nyilvános tartalmi route-ok nincsenek benne.

## Hatókör

Ide tartozik:

- a közös belső account és szerepkörválasztó felületek
- a bérbeadói (`owner`) felületek
- a bérlői (`tenant`) felületek
- az admin (`admin`) felületek
- a zárt app fő üzleti workflow-jai

Nem tartozik ide:

- publikus landing
- pricing, FAQ, funkciók, ÁSZF
- publikus ötletláda oldal
- publikus chat és cookie UI

## Belépés és szerepkör-logika

### Auth védelem

- A belső oldalak `requireUser()` vagy `requireRole()` ellenőrzéssel védettek.
- Be nem jelentkezett felhasználó `/login` oldalra kerül.
- A rendszer kezeli az elérhető szerepköröket és az aktív szerepkört.

### Szerepkör-alapú irányítás

- `/dashboard`
  - Ha a felhasználónak csak egy szerepköre van, automatikusan a megfelelő route-ra kerül.
  - Ha több szerepköre van, a rendszer a nézetválasztó oldalra küldi.
- `/valassz-nezetet`
  - Több szerepkör esetén itt lehet nézetet váltani `OWNER`, `TENANT`, `ADMIN` között.

## Közös zárt oldalak

### `/account`

Fájl: `/Users/indijanmac/Projects/rent-saas/src/app/account/page.tsx`

Funkciók:

- profiladatok megjelenítése
- email és aktív szerepkör megjelenítése
- elérhető szerepkörök listázása
- teljes név módosítása
- jelszó módosítása
- kijelentkezés
- saját dokumentumok ZIP exportja
- signed-in ötlet beküldése az ötletládába

Bérlő-specifikus extra funkciók:

- aktív ingatlan-hozzárendelések listázása
- függő kilépési kérelmek megjelenítése
- bérlői profil törlési / kilépési kérelem indítása
- ha nincs aktív hozzárendelés, profil végleges törlése

Nem bérlői útvonalon:

- profil végleges törlése

### `/dashboard`

Fájl: `/Users/indijanmac/Projects/rent-saas/src/app/dashboard/page.tsx`

Funkciók:

- belső redirect router
- egy szerepkör esetén automatikus átirányítás
- több szerepkör esetén átirányítás a nézetválasztóra

### `/valassz-nezetet`

Fájl: `/Users/indijanmac/Projects/rent-saas/src/app/valassz-nezetet/page.tsx`

Funkciók:

- szerepkörválasztó felület
- owner nézetre váltás
- tenant nézetre váltás
- admin nézetre váltás

## Bérbeadói felületek

### `/owner/osszefoglalo`

Fájl: `/Users/indijanmac/Projects/rent-saas/src/app/owner/osszefoglalo/page.tsx`

Szerepe:

- a bérbeadói fő dashboard
- központi döntéstámogató nézet

Funkciók:

- dátumszűrés `from` / `to`
- ingatlan-kontextus szűrő
- díjak, ingatlanok és hozzárendelések betöltése
- kintlévőség, fizetett, piszkozat és teljes összesítés számítása
- egyedi bérlőszám számítása
- havi bevétel számítása
- többhavi bevételi trend számítása
- lejárt, közelgő és figyelmet kérő tételek összesítése

Widgetek:

- ingatlanok
- bérlők
- havi bevétel
- kintlévőség
- nyitott feladatok
- következő események
- bevétel áttekintés
- feladat snapshot
- modulok gyorsnézet
- ingatlanonkénti bontás
- azonnali figyelmet igényel

### `/owner/properties`

Fájl: `/Users/indijanmac/Projects/rent-saas/src/app/owner/properties/page.tsx`

Szerepe:

- bérbeadói ingatlanportfólió kezelése

Funkciók:

- új ingatlan létrehozása
- ingatlanok listázása
- állapot, cím és alapadatok megjelenítése
- tenant hozzárendelési állapot megjelenítése
- aktív / inaktív portfólió összesítés
- továbbnavigálás az ingatlan részletoldalára

### `/owner/properties/[id]`

Fájl: `/Users/indijanmac/Projects/rent-saas/src/app/owner/properties/[id]/page.tsx`

Szerepe:

- egy konkrét ingatlan részletes kezelése

Funkciók:

- ingatlan részleteinek megjelenítése
- név, cím, státusz és fő tenant megjelenítése
- ingatlan adatainak szerkesztése
- tenant hozzárendelése ingatlanhoz
- tenant eltávolítása ingatlanról
- kapcsolódó díjak oldal megnyitása
- ingatlan törlése

### `/owner/charges`

Fájl: `/Users/indijanmac/Projects/rent-saas/src/app/owner/charges/page.tsx`

Szerepe:

- bérbeadói pénzügyi hub / belépő oldal

Funkciók:

- ha csak egy ingatlan van, automatikus átirányítás annak díjoldalára
- több ingatlan esetén ingatlankártyás választó
- property-szintű díjkezelő oldalak megnyitása

### `/owner/properties/[id]/charges`

Fájl: `/Users/indijanmac/Projects/rent-saas/src/app/owner/properties/[id]/charges/page.tsx`

Szerepe:

- egy ingatlan teljes díj- és számlakezelő oldala

Szűrők:

- státusz
- típus
- dátumtól
- dátumig
- oldalszám

Funkciók:

- szűrt időszaki összesítések számítása
- CSV export
- díjak listázása lapozással
- kapcsolódó dokumentumok signed URL-jeinek előállítása
- új díj kézi rögzítése
- díj szerkesztése
- számla feltöltése díjhoz
- import draft publikálása
- díj fizetettre állítása
- fizetett díj archiválása
- archivált díj visszaállítása
- nem fizetett vagy draft díj sztornózása / törlése

Kiemelt állapotok:

- `UNPAID`
- `PAID`
- `ARCHIVED`
- `CANCELLED`
- `IMPORT_DRAFT`
- lejárt, virtuális `OVERDUE` nézet

### `/owner/importok`

Fájl: `/Users/indijanmac/Projects/rent-saas/src/app/owner/importok/page.tsx`

Szerepe:

- számlaimport központ

Funkciók:

- bejövő email cím megjelenítése
- owner inbox létrehozása / forgatása
- shared inbox vs owner-specifikus inbox kezelése
- email import működésének magyarázata
- kézi PDF feltöltés ingestion workflow-ba
- siker / hiba / draft létrejött státuszok
- legutóbbi importok naplója
- továbbnavigálás az import részletoldalára
- átjárás az import beállításokhoz

### `/owner/importok/[id]`

Fájl: `/Users/indijanmac/Projects/rent-saas/src/app/owner/importok/[id]/page.tsx`

Szerepe:

- egy konkrét import / ingestion rekord review oldala

Funkciók:

- ingestion rekord részleteinek megjelenítése
- PDF előnézet signed URL-lel
- kinyert mezők megjelenítése
- confidence, javasolt ingatlan, kibocsátó, összeg, határidő, díjtípus megjelenítése
- import review véglegesítése
- létrejött draft frissítése vagy kiegészítése
- siker esetén átirányítás a kapcsolódó property charges oldalra

### `/owner/importok/beallitasok`

Fájl: `/Users/indijanmac/Projects/rent-saas/src/app/owner/importok/beallitasok/page.tsx`

Szerepe:

- import alias és property matching finomhangolás

Funkciók:

- property import aliasok listázása
- alias hozzáadása
- alias törlése
- státusz- és hibaüzenetek kezelése

### `/owner/tenants`

Fájl: `/Users/indijanmac/Projects/rent-saas/src/app/owner/tenants/page.tsx`

Szerepe:

- saját bérlők kezelése

Funkciók:

- ownerhez tartozó bérlők listázása
- új bérlő meghívása / létrehozása
- kilépési kérelmek megjelenítése
- kilépési kérelem jóváhagyása
- kilépési kérelem elutasítása
- bérlő törlése

### `/owner/todo`

Fájl: `/Users/indijanmac/Projects/rent-saas/src/app/owner/todo/page.tsx`

Szerepe:

- operatív feladatnézet

Funkciók:

- lejárt nem fizetett díjak gyűjtése
- 5 napon belül esedékes díjak gyűjtése
- import draft tételek gyűjtése
- tenant nélküli aktív ingatlanok figyelése
- KPI kártyák a fő queue-król
- tétel fizetettre állítása
- baráti emlékeztető küldése
- gyors linkek a kapcsolódó oldalakra

## Bérlői felületek

### `/tenant/charges`

Fájl: `/Users/indijanmac/Projects/rent-saas/src/app/tenant/charges/page.tsx`

Szerepe:

- bérlő saját díjainak áttekintése

Szűrők:

- ingatlan
- státusz
- típus
- dátumtól
- dátumig
- oldalszám

Funkciók:

- csak a tenant saját ingatlanjaihoz tartozó díjak listázása
- import draftok kizárása
- teljes, nyitott, fizetett és lezárt összesítések
- figyelmet kérő tételek listázása
- CSV export
- kapcsolódó dokumentumok megnyitása signed URL-en
- fizetett díj archiválása
- detail oldal megnyitása

### `/tenant/charges/[id]`

Fájl: `/Users/indijanmac/Projects/rent-saas/src/app/tenant/charges/[id]/page.tsx`

Szerepe:

- egy konkrét tenant charge részletoldala

Funkciók:

- charge tulajdonjog ellenőrzése tenant property IDs alapján
- ingatlan, összeg, határidő, státusz és fizetési idő megjelenítése
- kapcsolódó dokumentumok megjelenítése
- visszalépés a tenant charge listára

## Admin felületek

### `/admin/berbeadok`

Fájl: `/Users/indijanmac/Projects/rent-saas/src/app/admin/berbeadok/page.tsx`

Szerepe:

- bérbeadó admin menedzsment

Funkciók:

- új bérbeadó meghívása / létrehozása
- meglévő felhasználóhoz owner jogosultság adása
- bérbeadók listázása
- property count megjelenítése
- alap szerepkör és létrehozási idő megjelenítése

### `/admin/berlok`

Fájl: `/Users/indijanmac/Projects/rent-saas/src/app/admin/berlok/page.tsx`

Funkciók:

- legacy route
- automatikus átirányítás `/admin/berbeadok` oldalra

### `/admin/otletlada`

Fájl: `/Users/indijanmac/Projects/rent-saas/src/app/admin/otletlada/page.tsx`

Szerepe:

- admin ötletláda / feedback összesítő

Funkciók:

- ötletek listázása
- beküldések csoportosítása email szerint
- név, email, szerepkör, forrás, oldal és időpont megjelenítése
- feature név és leírás megjelenítése

## Fő üzleti workflow-k

### 1. Szerepköralapú belső navigáció

- a felhasználó bejelentkezik
- a rendszer megállapítja az elérhető szerepköröket
- egy szerepkör esetén automatikus átirányítás történik
- több szerepkör esetén a felhasználó választ nézetet

### 2. Ingatlan létrehozás és hozzárendelés

- owner létrehoz egy ingatlant
- szerkeszti az alapadatait
- tenantot rendel hozzá
- tenantot leválaszthat róla
- megnyitja az ingatlanhoz tartozó díjkezelést

### 3. Díjkezelés

- owner kézzel új díjat rögzít
- díjat szerkeszt
- számlát csatol
- draftot publikál
- nem fizetett díjat fizetettre állít
- fizetett díjat archivál
- szükség esetén sztornóz vagy töröl

### 4. Számlaimport / ingestion

- számla bejön emailben vagy kézi PDF feltöltéssel
- ingestion rekord jön létre
- a rendszer property matchinget próbál végezni
- ha elég biztos, draft charge jön létre
- ha nem biztos, review szükséges
- owner review oldalon jóváhagyja vagy javítja
- a draft az ingatlan díjoldalán folytatható

### 5. Operatív utánkövetés

- owner todo oldalon látja a lejárt és közelgő tételeket
- fizetettre állítást tud végezni
- baráti emlékeztetőt tud küldeni
- látja az import draftokat és tenant nélküli ingatlanokat

### 6. Tenant self-service

- tenant csak a saját díjait látja
- szűrni tud dátum, státusz, típus és ingatlan szerint
- dokumentumokat meg tudja nyitni
- fizetett tételt archiválni tud

### 7. Profil- és hozzáféréskezelés

- felhasználó módosítja a nevét
- jelszót változtat
- dokumentumait exportálja
- tenant kilépési kérelmet indít
- admin vagy owner kezeli a kapcsolódó felhasználókat

## Zárt route lista

### Közös

- `/account`
- `/dashboard`
- `/valassz-nezetet`

### Owner

- `/owner/osszefoglalo`
- `/owner/properties`
- `/owner/properties/[id]`
- `/owner/charges`
- `/owner/properties/[id]/charges`
- `/owner/importok`
- `/owner/importok/[id]`
- `/owner/importok/beallitasok`
- `/owner/tenants`
- `/owner/todo`

### Tenant

- `/tenant/charges`
- `/tenant/charges/[id]`

### Admin

- `/admin/berbeadok`
- `/admin/berlok`
- `/admin/otletlada`

## Megjegyzés

Ez a fájl az aktuálisan létező route-ok és a kódban jelenleg elérhető funkciók alapján készült. Ha új zárt oldal, új server action vagy új belső workflow kerül az appba, ezt a dokumentumot is frissíteni kell.

## Technikai melléklet

Ez a rész már nem csak funkcionális, hanem fejlesztői referencia. A célja, hogy egy route mögött gyorsan látszódjon:

- milyen server actionök tartoznak hozzá
- milyen API route-ok kapcsolódnak hozzá
- melyik főbb adatbázistáblákra támaszkodik

### Főbb közös adatmodellek

- `profiles`
  - felhasználói profilok, név, email, szerepkörhöz kapcsolódó metaadatok
- `owner_memberships`
  - owner jogosultságok
- `tenant_memberships`
  - tenant jogosultságok és owner-tenant kapcsolatok
- `properties`
  - ingatlan törzsadatok
- `property_tenants`
  - ingatlan és tenant kapcsolatok
- `charges`
  - díjak, követelések, terhelések
- `documents`
  - feltöltött számlák és egyéb kapcsolódó dokumentumok
- `document_ingestions`
  - emailes vagy kézi importból érkező számlafeldolgozási rekordok
- `document_fingerprints`
  - duplikáció-ellenőrzési ujjlenyomatok
- `property_import_aliases`
  - import matching aliasok ingatlanokhoz
- `tenant_exit_requests`
  - tenant kilépési kérelmek
- `idea_submissions`
  - ötletláda bejegyzések
- `inbound_mailboxes`
  - ownerhez rendelt bejövő számla email címek
- `extraction_reviews`
  - számlakivonat review napló
- `supplier_profiles`
  - beszállítói / issuer segédadatok

### Közös auth és szerepkör infrastruktúra

- `/Users/indijanmac/Projects/rent-saas/src/lib/auth/requireUser.ts`
  - belépéskényszerítés
  - aktív profil és role context feloldása
- `/Users/indijanmac/Projects/rent-saas/src/lib/auth/requireRole.ts`
  - role-specific route védelem
- `/Users/indijanmac/Projects/rent-saas/src/lib/auth/roles.ts`
  - route mapping és role segédfüggvények

## Route -> action -> adat kapcsolat

### `/account`

Kapcsolódó server actionök:

- `logout`
- `updateProfile`
- `updatePassword`
- `deleteProfile`
- `requestTenantProfileDeletion`

Kapcsolódó API route-ok:

- `/api/account/documents/export`

Főbb táblák:

- `profiles`
- `tenant_exit_requests`
- `property_tenants`
- `tenant_memberships`
- `owner_memberships`
- `charges`
- `documents`
- `properties`
- `document_ingestions`
- `property_import_aliases`
- `supplier_profiles`
- `document_fingerprints`
- `inbound_mailboxes`
- `extraction_reviews`

Megjegyzés:

- ez az egyik legérzékenyebb oldal, mert itt van profilfrissítés, jelszókezelés, dokumentumexport és destruktív fióktörlési logika is

### `/dashboard`

Kapcsolódó server action:

- nincs külön action, csak role-alapú redirect logika

Kapcsolódó táblák:

- közvetve `profiles`, memberships és role context

### `/valassz-nezetet`

Kapcsolódó server action:

- `chooseRole`

Kapcsolódó táblák:

- közvetve role context és membership adatok

### `/owner/osszefoglalo`

Kapcsolódó server action:

- nincs külön server action, query param alapú szűrt dashboard

Kapcsolódó API route:

- nincs közvetlen saját API route

Főbb táblák:

- `charges`
- `properties`
- `property_tenants`

Megjegyzés:

- itt készül a legtöbb aggregált KPI, ezért ha dashboard számok hibásak, ezt az oldalt és a kapcsolódó lekérdezéseket kell elsőként auditálni

### `/owner/properties`

Kapcsolódó server actionök:

- `createProperty`

Főbb táblák:

- `properties`
- `profiles`
- `property_tenants`

Kapcsolódó komponensek:

- `OwnerPropertyCreateForm`

### `/owner/properties/[id]`

Kapcsolódó server actionök:

- `assignTenantToProperty`
- `removeTenantFromProperty`
- `updateProperty`
- `deleteProperty`

Főbb táblák:

- `properties`
- `property_tenants`
- `tenant_memberships`
- `charges`
- `documents`

Kapcsolódó komponensek:

- `OwnerPropertyEditForm`
- `DeletePropertyForm`

### `/owner/charges`

Kapcsolódó server action:

- nincs külön action

Főbb táblák:

- `properties`

Megjegyzés:

- ez egy hub oldal, az érdemi díjkezelés a property-szintű charges route-on történik

### `/owner/properties/[id]/charges`

Kapcsolódó server actionök:

- `createCharge`
- `extractInvoiceData`
- `extractInvoiceFromBuffer`
- `markChargePaid`
- `sendManualChargeReminder`
- `publishCharge`
- `updateCharge`
- `cancelCharge`
- `restoreCharge`
- `archiveCharge`
- `deleteCharge`

Kapcsolódó API route-ok:

- `/owner/properties/[id]/charges/export`
- `/api/charges/upload-invoice`

Főbb táblák:

- `properties`
- `charges`
- `documents`
- közvetve `profiles`

Kapcsolódó komponensek:

- `CreateChargeForm`
- `EditChargeForm`
- `ConfirmActionForm`
- `UploadInvoice`

Megjegyzés:

- ez a zárt app egyik legfontosabb üzleti oldala, mert itt találkozik a manuális díjrögzítés, a dokumentumkezelés és az import draft életciklus

### `/owner/importok`

Kapcsolódó server actionök:

- `createManualIngestion`
- `rotateOwnerInboundMailbox`

Kapcsolódó API route-ok:

- `/api/invoices/import`
- `/api/inbound/process`
- `/email-inbound-action`

Főbb táblák:

- `properties`
- `profiles`
- `document_ingestions`
- `document_fingerprints`
- `inbound_mailboxes`
- `charges`
- `documents`

Kapcsolódó library-k:

- `/Users/indijanmac/Projects/rent-saas/src/lib/ingestionProcessing.ts`
- `/Users/indijanmac/Projects/rent-saas/src/lib/inboundMailboxes.ts`
- `/Users/indijanmac/Projects/rent-saas/src/lib/propertyMatching.ts`

### `/owner/importok/[id]`

Kapcsolódó server action:

- `finalizeIngestionReview`

Kapcsolódó API route-ok:

- ugyanaz az ingestion stack használódik, mint az import központban

Főbb táblák:

- `document_ingestions`
- `properties`
- `charges`
- `documents`
- `extraction_reviews`

Kapcsolódó komponensek:

- `PdfPreview`

### `/owner/importok/beallitasok`

Kapcsolódó server actionök:

- `addPropertyImportAlias`
- `deletePropertyImportAlias`

Főbb táblák:

- `properties`
- `property_import_aliases`

### `/owner/tenants`

Kapcsolódó server actionök:

- `createTenant`
- `deleteTenant`
- `approveTenantExitRequest`
- `rejectTenantExitRequest`

Főbb táblák:

- `profiles`
- `tenant_memberships`
- `property_tenants`
- `tenant_exit_requests`
- `properties`
- `charges`
- `documents`

Kapcsolódó segédlib:

- `/Users/indijanmac/Projects/rent-saas/src/lib/tenantOwnership.ts`

### `/owner/todo`

Kapcsolódó server actionök:

- `markChargePaid`
- `sendManualChargeReminder`

Főbb táblák:

- `charges`
- `properties`
- `property_tenants`
- `profiles`

Megjegyzés:

- ez nem külön task-táblára épül, hanem a charges és property állapotokból derivál operatív feladatlistát

### `/tenant/charges`

Kapcsolódó server action:

- `archiveTenantCharge`

Kapcsolódó API route:

- `/tenant/charges/export`

Főbb táblák:

- `charges`
- `documents`
- `profiles`

Kapcsolódó segédlib:

- `/Users/indijanmac/Projects/rent-saas/src/lib/propertyTenants.ts`

### `/tenant/charges/[id]`

Kapcsolódó server action:

- nincs külön action

Főbb táblák:

- `charges`
- `documents`

Kapcsolódó segédlib:

- `listTenantPropertyIds`
- `createDocumentSignedUrl`

### `/admin/berbeadok`

Kapcsolódó server action:

- `createOwner`

Főbb táblák:

- `profiles`
- `owner_memberships`
- `properties`

Megjegyzés:

- email küldés is kapcsolódik hozzá, tehát admin user provisioning + jogosultságkezelés egyben történik

### `/admin/berlok`

Kapcsolódó server action:

- nincs

Megjegyzés:

- legacy redirect route

### `/admin/otletlada`

Kapcsolódó server action:

- nincs külön action

Főbb táblák:

- `idea_submissions`

## Fontos belső API route-ok

Ezek nem mind külön oldalakhoz kötődnek, de a zárt app működéséhez kapcsolódnak.

- `/api/account/documents/export`
  - account oldalról ZIP export
- `/api/charges/upload-invoice`
  - díjhoz kötött számlafeltöltés
- `/api/invoices/import`
  - számlaimport belépési pont
- `/api/inbound/process`
  - bejövő import feldolgozó végpont
- `/api/cron/charge-reminders`
  - díjemlékeztető cron

## Fontos segédlibek

### Dokumentumkezelés

- `/Users/indijanmac/Projects/rent-saas/src/lib/documentStorage.ts`
  - storage object feltöltés
  - törlés
  - signed URL generálás

### Property matching és import

- `/Users/indijanmac/Projects/rent-saas/src/lib/propertyMatching.ts`
  - számla és ingatlan összepárosítás
- `/Users/indijanmac/Projects/rent-saas/src/lib/ingestionProcessing.ts`
  - ingestion életciklus
- `/Users/indijanmac/Projects/rent-saas/src/lib/inboundMailboxes.ts`
  - owner inbox kezelés

### Tenant / property ownership

- `/Users/indijanmac/Projects/rent-saas/src/lib/propertyTenants.ts`
  - tenanthez tartozó ingatlanok
  - ingatlanhoz tartozó tenantok
- `/Users/indijanmac/Projects/rent-saas/src/lib/tenantOwnership.ts`
  - ownerhez tartozó tenantok

## Fejlesztői megjegyzések

### Dashboard számok

Ha a fő dashboard számai furcsák vagy ellentmondásosak, első körben ezt kell ellenőrizni:

- a dátum range alapértékei
- property filter hatása
- tenant számítás `property_tenants` alapján
- charge státuszok szűrése
- overdue és unpaid logika szétválasztása

### Import workflow

Az import stack több külön lépésből áll:

- fájl vagy email beérkezik
- ingestion rekord készül
- fingerprint duplikációellenőrzés fut
- property matching fut
- draft charge jön létre vagy review queue-ba kerül
- owner review után véglegesedik

### Törlési műveletek

Az account és tenant delete útvonalak több táblát érintenek. Ezeket különösen óvatosan kell módosítani, mert:

- dokumentum storage objektumok is kapcsolódnak hozzájuk
- charges és tenant/property kapcsolatok nullázása vagy törlése is történhet
- membership és exit request rekordok is takarításra kerülnek
