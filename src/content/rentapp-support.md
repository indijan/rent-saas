# Rentapp tudásbázis

## Mi a Rentapp?

A Rentapp egy bérbeadói és bérlői adminisztrációs rendszer. A célja, hogy a bérbeadó és a bérlő ugyanannak a folyamatnak a két oldalát átláthatóan kezelje: ingatlanok, bérlők, díjak, dokumentumok, emlékeztetők, importok és státuszok.

## Kinek szól?

- Bérbeadóknak, akik több vagy akár csak egy ingatlant kezelnek.
- Bérlőknek, akik a saját nyitott, fizetett és archivált tételeiket szeretnék egy helyen látni.
- Adminisztrátornak, aki a bérbeadói hozzáféréseket kezeli.

## Szerepkörök és nézetek

### Bérbeadó

A bérbeadó a saját ingatlanait, bérlőit, díjait, dokumentumait, importjait és összesítőit látja. Más bérbeadó adatait nem láthatja.

### Bérlő

A bérlő csak a saját díjait és a hozzájuk kapcsolt dokumentumokat látja. Nem fér hozzá más bérlő vagy más ingatlan adataihoz.

### Admin

Az admin bérbeadói hozzáféréseket kezel. Az admin lehet egyszerre owner is, de a rendszer a nézeteket szétválasztja.

### Több nézet egy e-mail-címmel

Ugyanazzal az e-mail-címmel valaki lehet bérlő és bérbeadó is. Ilyenkor belépés után nézetet választhat.

## Fő oldalak

### Nyitóoldal

A nyitóoldal a Rentapp funkcióit, használati díját, próbaidőszakát és a bérbeadói regisztráció lehetőségét mutatja be.

### Funkciók oldal

Itt részletesen össze vannak foglalva a szolgáltatás előnyei és kényelmi funkciói.

### Használati díj oldal

Itt látható az aktuális árazás és az ingyenes próbaidő.

### Belépés

A belépési oldalon e-mail-címmel és jelszóval lehet belépni, vagy jelszó-visszaállítást indítani.

### Fiók oldal

A fiók oldalon lehet:

- nevet módosítani,
- jelszót módosítani,
- kijelentkezni,
- dokumentumokat ZIP-ben letölteni,
- profilt törölni vagy törlési kérelmet küldeni.

## Árazás

- 1-3 ingatlan: 3 000 Ft / ingatlan / hó
- 4-9 ingatlan: 2 000 Ft / ingatlan / hó
- 10 vagy több ingatlan: 1 000 Ft / ingatlan / hó

## Próbaidő

A szolgáltatás 1 hónap ingyenes próbaidővel indul.

## Bérbeadói fő funkciók

### Ingatlanok kezelése

A bérbeadó felvehet új ingatlant, szerkesztheti az adatait, bérlőt rendelhet hozzá és törölheti is.

### Bérlők kezelése

A bérbeadó meghívhat bérlőket, hozzárendelheti őket ingatlanhoz, és kezeli a hozzájuk kapcsolódó díjakat.

### Díjak kezelése

A bérbeadó létrehozhat díjakat manuálisan, szerkesztheti őket, publikálhatja az importból létrejött draftokat, fizetettre jelölheti a teljesített tételeket, érvénytelenítheti a nem aktív tételeket, vagy végleg törölheti azokat.

### Összesítő

Az összesítő oldalon a bérbeadó nemcsak ingatlanonként, hanem teljes portfólió szinten is látja a pénzügyeket.

### Teendők

A Teendők oldalon egy menedzsment összefoglaló jelenik meg arról, hogy mivel kell foglalkozni:

- lejárt díjak,
- közelgő esedékességek,
- importból érkezett draftok,
- bérlő nélküli ingatlanok.

## Bérlői fő funkciók

### Díjlista

A bérlő látja a saját díjait szűrhető listában, státuszokkal és lejárati jelzésekkel.

### Dokumentumok

A bérlő a saját díjaihoz tartozó dokumentumokat megnyithatja.

### Lejárati vizualizáció

A rendszer színekkel is jelzi a helyzetet:

- zöldes: még nem járt le,
- narancsos: közeleg a határidő,
- pirosas: lejárt.

## Díj státuszok

### IMPORT_DRAFT

Automatikusan feldolgozott, de még nem publikált tétel. A bérlő ezt még nem látja.

### UNPAID

Aktív, nyitott tétel. Fizetendő.

### PAID

Fizetett tétel.

### ARCHIVED

Archivált tétel. Ezt nem lehet ugyanúgy szerkeszteni vagy új dokumentummal bővíteni, mint az aktív tételeket.

### CANCELLED

Érvénytelenített tétel. Megmarad a rendszerben és visszaállítható.

## Érvénytelenítés és sztornó

### Érvénytelenítés

Az érvénytelenítés nem végleges törlés. A tétel megmarad, csak nem aktív. Visszaállítható.

### Sztornó

A sztornó a végleges törlést jelenti. A kapcsolódó rekordok és dokumentumok is eltűnhetnek. Ez nem visszavonható.

## Dokumentumkezelés

### Manuális számlafeltöltés

A bérbeadó PDF számlát tölthet fel. A rendszer megpróbálja az AI segítségével kinyerni a fontos adatokat.

### Importok oldal

Az Importok oldalon látható:

- a bérbeadó egyedi bejövő e-mail-címe,
- a feltöltött vagy e-mailben beérkezett számlák listája,
- a feldolgozás állapota,
- a review és draft-készítés folyamata.

### Import beállítások

Az owner megadhat ingatlan-aliasokat, hogy a rendszer könnyebben felismerje, melyik ingatlanhoz tartozik egy bejövő számla.

### Egyedi bejövő e-mail-cím

Minden owner kap egy egyedi Rentappos e-mail-címet. Ha egy számla erre a címre érkezik, a rendszer importfolyamata draftot készíthet belőle.

## AI és számlafeldolgozás

### Mit csinál az AI?

Az AI megpróbálja kinyerni a számla kulcsadatait:

- megnevezés,
- összeg,
- pénznem,
- esedékesség,
- szolgáltató neve,
- díjtípus.

### Emberi jóváhagyás

Az AI nem publikál kontroll nélkül. Az automatikusan feldolgozott számlák draftként jönnek létre, és a bérbeadó publikálja őket, miután ellenőrizte vagy javította az adatokat.

### Mi történik új vagy bizonytalan számlatípusnál?

Ha a rendszer nem biztos a feldolgozásban, review szükséges. Ilyenkor a bérbeadó ellenőrzi az adatokat, majd draftot készít.

## Értesítések és emailek

### Közelgő határidő

A bérlő automatikus email emlékeztetőt kaphat a közelgő fizetési határidőről.

### Lejárt tétel

A lejárt, de még nyitott tételről nem automatikusan a bérlő kap behajtó jellegű emailt. Először a bérbeadó kap értesítést arról, hogy ellenőrizze, megtörtént-e a fizetés.

### Baráti emlékeztető

Ha a bérbeadó úgy látja, hogy a tétel nincs rendezve, a rendszerből egy gombnyomással küldhet baráti hangvételű emlékeztető emailt.

### Import értesítések

Az importból érkező számlák draftként jönnek létre. A rendszer értesítést küldhet a bérbeadónak az új importról vagy a kézi ellenőrzést igénylő tételekről.

## Jelszó-visszaállítás

### Hogyan működik?

Az Elfelejtett jelszó funkció új jelszó-visszaállító emailt küld. A link megnyitása után a felhasználó új jelszót állíthat be.

### Ha a link nem működik

Ha a jelszó-visszaállító email a spam mappába érkezett, a levélben lévő link nem biztos, hogy működni fog. Ilyenkor:

1. a feladót tedd a megbízható feladók közé,
2. kérj új jelszó-visszaállító emailt,
3. az új linket használd.

### Miért számít a spam mappa?

Bizonyos levelezőrendszerek a spambe került levelek linkjeit előnézetként megnyithatják vagy módosíthatják, ami érvénytelenítheti a jelszó-visszaállító linket.

## Profil és adatkezelés

### Dokumentumletöltés

A felhasználó a fiók oldalról letöltheti a profiljához kapcsolódó dokumentumokat ZIP formátumban.

### Profil törlése

A bérbeadó vagy admin a saját profilját végleg törölheti. A rendszer figyelmeztet arra, hogy ez dokumentumokat is érinthet, és DELETE megerősítést kér.

### Bérlői törlési kérelem

A bérlő közvetlen teljes törlés helyett törlési kérelmet küldhet a bérbeadójának.

## Mobilhasználat

A felület mobilra optimalizált:

- a menü és a fő oldalak mobilon is kezelhetők,
- a díjkártyák és szűrők mobilon is olvashatók,
- az alap műveletek nagy, jól nyomható gombokkal érhetők el.

## Rendszer viselkedése röviden

- A bérbeadó csak a saját ingatlanait és bérlőit látja.
- A bérlő csak a saját tételeit látja.
- Az importált számla nem publikálódik automatikusan.
- A bizonytalan AI-feldolgozás emberi ellenőrzést kér.
- A díjakhoz kapcsolódó állapotok és műveletek nem minden státuszban ugyanazok.

## Gyakori kérdések

### A bérlő látja az importált, de még nem publikált számlát?

Nem. Az importált számla először draft, és csak publikálás után válik bérlői oldalon láthatóvá.

### Mi a teendő, ha a számlán az összeg vagy esedékesség hibás?

A bérbeadó szerkesztheti a tételt publikálás előtt, illetve a létrejött díjat is módosíthatja a jogosult státuszokban.

### Mi történik, ha egy díjat archiválok?

Az archivált tétel nem ugyanúgy viselkedik, mint az aktív. Nem minden művelet érhető el rá.

### Tudok ugyanazzal az e-mail-címmel több nézetet használni?

Igen. Ugyanaz az e-mail-cím lehet bérlői és bérbeadói hozzáféréshez is kötve.

### Mi történik, ha a jelszó-visszaállító levél spambe ment?

A feladót tedd a megbízható feladók közé, majd kérj új jelszó-visszaállító levelet. A spambe került levélből nyitott link nem biztos, hogy működni fog.

## Támogatás és közvetlen kapcsolat

Ha a chatbot nem tud biztos választ adni, vagy az ügy egyedi kivizsgálást igényel, a felhasználót közvetlen kapcsolatra kell irányítani.

### WhatsApp

https://wa.me/64275665850

### Messenger

https://m.me/indijanmac

## Chatbot válaszadási szabály

A chatbot csak a Rentappal kapcsolatos kérdésekre válaszoljon. Ha a kérdés kívül esik a Rentapp működésén, vagy a tudásbázis alapján nem adható biztos válasz, ezt egyértelműen jelezze, majd adja meg a WhatsApp és Messenger linkeket közvetlen segítséghez.
