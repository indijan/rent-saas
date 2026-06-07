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

Egy ingatlanhoz több bérlő is rendelhető. Ilyenkor a rendszer ugyanahhoz az ingatlanhoz több bérlői hozzáférést tart nyilván, és az értesítések is több címzetthez mehetnek.

### Bérlő

A bérlő csak azoknak az ingatlanoknak a díjait és a hozzájuk kapcsolt dokumentumokat látja, amelyekhez ténylegesen hozzá van rendelve. Nem fér hozzá más bérlő vagy más ingatlan adataihoz.

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

Egy ingatlanhoz több bérlő is hozzáadható. A részletes ingatlanoldalon látszik:

- az elsődleges bérlő,
- az összes hozzárendelt bérlő,
- a bérlők leválasztása.

### Díjak kezelése

A bérbeadó létrehozhat díjakat manuálisan, szerkesztheti őket, publikálhatja az importból létrejött draftokat, fizetettre jelölheti a teljesített tételeket, érvénytelenítheti a nem aktív tételeket, vagy végleg törölheti azokat.

Az ismétlődő tételeknél a bérbeadó nemcsak azt állíthatja be, hogy ismétlődő legyen a díj, hanem azt is, hány ismétlődés jöjjön létre.

### Összesítő

Az összesítő oldalon a bérbeadó nemcsak ingatlanonként, hanem teljes portfólió szinten is látja a pénzügyeket.

### Teendők

A Teendők oldalon egy menedzsment összefoglaló jelenik meg arról, hogy mivel kell foglalkozni:

- lejárt díjak,
- közelgő esedékességek,
- importból érkezett draftok,
- bérlő nélküli ingatlanok.

Emellett itt jelennek meg a számla tétel javaslatok is: a rendszer a korábbi saját költség minták alapján figyelmeztet, ha egy szokásosan érkező számla most valószínűleg hiányzik.

Ha ilyen hiányzó számla mintát talál, a bérbeadó email értesítést is kaphat róla.

### E-mail log

A bérbeadó a profil menüből megnyithat egy külön E-mail log oldalt, ahol az elmúlt 30 nap bérlőknek kiküldött leveleit látja.

Itt a következő információk jelenhetnek meg:

- tárgy,
- címzett,
- kategória,
- kapcsolódó tétel,
- státusz.

Ha az Amazon SES kézbesítési eseményei is be vannak kötve, akkor a kézbesítve, elfogadva vagy hibás állapotok is látszanak.

## Bérlői fő funkciók

### Díjlista

A bérlő látja a saját, hozzá rendelt ingatlanokhoz tartozó díjait szűrhető listában, státuszokkal és lejárati jelzésekkel.

A bérlő nem láthatja a bérbeadó saját költségeit. A saját költségként rögzített tételek és az ezekhez tartozó dokumentumok nem jelennek meg a bérlői felületen.

Az Adó típus nem továbbterhelhető a bérlő felé, ezért ez sem jelenik meg bérlői díjként vagy bérlői típus-szűrőben.

### Dokumentumok

A bérlő a saját, hozzá rendelt ingatlanok díjaihoz tartozó dokumentumokat megnyithatja.

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

Az UI-ban a sztornó érvénytelenített állapotot jelent. Innen még visszaállítható a tétel, vagy külön végleges törlés is indítható.

### Végleges törlés

Csak már érvénytelenített tételnél elérhető. Ilyenkor a kapcsolódó rekordok és dokumentumok is eltűnhetnek. Ez nem visszavonható.

## Dokumentumkezelés

### Manuális számlafeltöltés

A bérbeadó PDF számlát tölthet fel. A rendszer megpróbálja az AI segítségével kinyerni a fontos adatokat.

### Importok oldal

Az Importok oldalon látható:

- a bejövő e-mail-cím,
- a feltöltött vagy e-mailben beérkezett számlák listája,
- a feldolgozás állapota,
- a review és draft-készítés folyamata.

Az Importok oldalon nemcsak a review állapotú elemek látszanak, hanem azok a piszkozatok is, amelyek már létrejöttek, de még publikálásra várnak.

### Import beállítások

Az owner megadhat ingatlan-aliasokat, hogy a rendszer könnyebben felismerje, melyik ingatlanhoz tartozik egy bejövő számla.

### Közös bejövő e-mail-címek

A számlák központi bejövő címei:

- `szamla@in.rentapp.hu` a továbbított, bérlő felé terhelendő költségekhez
- `sajat@in.rentapp.hu` a saját költségként könyvelendő számlákhoz

### Hogyan azonosítja a rendszer a számlát?

Az emailes importnál a rendszer több lépésben dolgozik:

1. először megpróbálja a feladó e-mail-címe alapján azonosítani a bérbeadót,
2. ha ez nem egyértelmű, a számla tartalmából próbál ingatlant és bérbeadót felismerni,
3. különösen figyeli az ingatlan címét, a szolgáltató nevét, az aliasokat és az ismert mintákat,
4. ha még így sem biztos a helyzet, a számla ellenőrzést vagy jóváhagyást kér.

### Mi történik ismeretlen feladónál?

Ha a feladó e-mail-címét a rendszer nem tudja közvetlenül bérbeadóhoz kötni, de a számla alapján valószínűsíteni tud egy tulajdonost vagy ingatlant, akkor jóváhagyó email megy ki a feltételezett bérbeadónak.

Ebben a levélben lehet:

- jóváhagyni a feldolgozást,
- elutasítani a számlát,
- vagy megnyitni az import részleteit a rendszerben.

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

Az e-mailes importnál is előfordulhat, hogy a rendszer előbb jóváhagyást kér, és csak utána indul el a tényleges feldolgozás.

A létrejött import piszkozat több helyről is publikálható:

- a Pénzügyek oldalról,
- az Importok oldalról,
- az import részletező nézetből,
- bizonyos esetekben az emailből nyitott műveleti linken keresztül.

### Mi történik új vagy bizonytalan számlatípusnál?

Ha a rendszer nem biztos a feldolgozásban, review szükséges. Ilyenkor a bérbeadó ellenőrzi az adatokat, majd draftot készít.

## Értesítések és emailek

### Közelgő határidő

A bérlő automatikus email emlékeztetőt kaphat a közelgő fizetési határidőről. Ez jelenleg a lejárat előtt 2 nappal megy ki a bérlő felé.

Csak bérlő felé kezelt, ténylegesen továbbterhelt tételekre megy ilyen emlékeztető. Saját költségre nem.

### Lejárt tétel

A lejárt, de még nyitott tételről nem automatikusan a bérlő kap behajtó jellegű emailt. Először a bérbeadó kap értesítést arról, hogy ellenőrizze, megtörtént-e a fizetés.

### Baráti emlékeztető

Ha a bérbeadó úgy látja, hogy a tétel nincs rendezve, a rendszerből egy gombnyomással küldhet baráti hangvételű emlékeztető emailt.

Ha egy ingatlanhoz több bérlő van rendelve, az emlékeztető több címzetthez is kimehet.

### Import értesítések

Az importból érkező számlák draftként jönnek létre. A rendszer értesítést küldhet a bérbeadónak az új importról vagy a kézi ellenőrzést igénylő tételekről.

Az importértesítő emailben lehetnek közvetlen műveleti linkek is, például:

- `Jónak tűnik, mehet`
- `Nem jó, szerkesztem`
- `Megnyitom a piszkozatot`

Ezek a linkek nem vakon hajtanak végre műveletet, hanem megerősítő oldalra visznek, ahol a felhasználó ténylegesen jóváhagyja a lépést.

## Pénzügyek és összesítők

### Bevétel

A Pénzügyek oldalon a bevételbe a fizetett és archivált, bérlő felé kezelt tételek számítanak bele.

### Költség

A költségek közé minden költség jellegű tétel beleszámít:

- a saját költségek,
- és azok a továbbterhelt költségek is, amelyek már fizetett vagy archivált állapotba kerültek.

Ez azért fontos, mert így a pénzügyi összesítők és a költségmegoszlás nem csak a saját költségeket mutatja, hanem a teljes költségoldalt.

### Áttekintés és Pénzügyek egyezése

Az áttekintés alsó pénzügyi bontásának ugyanazt a logikát kell mutatnia, mint a Pénzügyek oldalnak:

- a rögzített bevétel az összes fizetett és archivált bevételi tétel,
- az összes költség pedig minden költség jellegű tétel az aktuális hónap utolsó napjáig.

### Időszakválasztó

Az időszakválasztónál a Maximum nézet az aktuális hónap végéig tart, nem csak a mai napig.

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

A bérlő közvetlen teljes törlés helyett először kilépési kérelmet küld azokhoz az ingatlanokhoz, amelyekhez hozzá van rendelve.

Ez azt jelenti:

1. a bérlő a fiók oldalon elküldi a kilépési kérelmeket,
2. az adott ingatlan bérbeadója ezeket a `Bérlők` oldalon látja,
3. a bérbeadó jóváhagyhatja vagy elutasíthatja a kérelmet,
4. csak akkor törölhető végleg a bérlői profil, ha már nincs aktív ingatlan-hozzárendelés.

### Dokumentumok törlése profil törléskor

- Bérlői profil törlésekor a dokumentumok nem törlődnek a rendszerből.
- Bérbeadói profil törlésekor a hozzá tartozó dokumentumok is törlődhetnek.

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

Ugyanígy a saját költségként rögzített tételt a bérlő akkor sem látja, ha aktív vagy fizetett állapotban van.

### Mi a teendő, ha a számlán az összeg vagy esedékesség hibás?

A bérbeadó szerkesztheti a tételt publikálás előtt, illetve a létrejött díjat is módosíthatja a jogosult státuszokban.

### Honnan tudom, hogy kiment-e automata vagy kézi email a bérlőnek?

Az owner felületen az E-mail log oldalon lehet megnézni az elmúlt 30 nap kiküldött bérlői leveleit.

### Mit jelez a számla tétel javaslat?

Ez nem automatikus számlakibocsátás. A rendszer csak figyelmezteti a bérbeadót, ha a korábbi minták alapján most valószínűleg hiányzik egy szokásos saját költség számla.

### Mi történik, ha egy díjat archiválok?

Az archivált tétel nem ugyanúgy viselkedik, mint az aktív. Nem minden művelet érhető el rá.

### Tudok ugyanazzal az e-mail-címmel több nézetet használni?

Igen. Ugyanaz az e-mail-cím lehet bérlői és bérbeadói hozzáféréshez is kötve.

### Mindenki ugyanarra az email-címre küldi a számlát?

Nem teljesen. Két központi cím van:

- `szamla@in.rentapp.hu` a továbbított költségekhez
- `sajat@in.rentapp.hu` a saját költségekhez

Innen a rendszer próbálja felismerni, hogy melyik bérbeadóhoz és melyik ingatlanhoz tartozik a számla.

### Mi történik, ha a feladó email-címe nem egyezik a bérbeadó regisztrált emailjével?

Ilyenkor a rendszer nem feltétlenül utasítja el automatikusan a számlát. Előbb megpróbálja a számla tartalmából azonosítani az ingatlant és a bérbeadót. Ha van valószínű egyezés, jóváhagyást kérhet a feltételezett bérbeadótól.

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
