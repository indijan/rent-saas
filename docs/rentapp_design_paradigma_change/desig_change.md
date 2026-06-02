# Rentapp – UX/UI és Funkcionális Specifikáció (Véglegesített Verzió)

## Projekt célja

A Rentapp egy modern, webalapú bérbeadói operációs rendszer.

Nem klasszikus ingatlankezelő vagy CRM rendszer.

A cél:

- bérleti díjak kezelése
- költségek kezelése
- számlák automatikus feldolgozása
- bérlők kezelése
- operatív feladatok kezelése
- pénzügyi áttekintés

A rendszer filozófiája:

> A felhasználó mindig egy kiválasztott ingatlan vagy az összes ingatlan kontextusában dolgozik.

---

# Design alapelvek

Inspiráció:

platform.openai.com

Elvek:

- minimális navigáció
- kontextus alapú működés
- modern SaaS UI
- világos és sötét mód
- mobil-first szemlélet
- adminisztráció helyett operatív fókusz
- csak olyan funkció jelenhet meg, amely ténylegesen létezik a rendszerben

---

# Fő navigáció

## Desktop bal oldali menü

- Áttekintés
- Pénzügyek
- Importok
- Bérlők
- Feladatok
- Ötletláda
- Kapcsolat

NEM szerepelhet:

- Ingatlanok
- Dokumentumok
- Szerződések
- Üzenetek
- Karbantartás
- Számlák

---

# Felső sáv

## Ingatlan választó

Példák:

- Összes ingatlan
- Király utca 12.
- Petőfi utca 8.

Ez határozza meg a teljes alkalmazás kontextusát.

Minden oldal ehhez igazodik.

---

## Ingatlan választó menü

Tartalma:

Összes ingatlan

Ingatlanok listája

+ Új ingatlan hozzáadása

---

# Profil menü

Lehetséges elemek:

- Bérbeadói nézet
- Bérlői nézet
- Profil
- Ingatlanok kezelése
- Új ingatlan
- Kijelentkezés

---

# Megjelenés menü

Csak:

- Automatikus
- Világos
- Sötét

Nem tartalmaz üzleti funkciókat.

---

# Új ingatlan

Az új ingatlan létrehozása két helyről érhető el:

## 1. Ingatlan választó

+ Új ingatlan hozzáadása

## 2. Profil menü

+ Új ingatlan

---

# Áttekintés oldal

## Rentapp összefoglaló

Tartalmazza:

- Lejárt díjak
- Bérlő nélküli ingatlanok
- Import review vár
- Kintlévőség

---

## KPI sor

- Ingatlanok
- Bérlők
- Havi bevétel
- Kintlévőség

---

## Grafikon

Nettó eredmény alakulása

Nem bevétel grafikon.

---

## Következő események

Példák:

- Bérleti díj esedékes
- Import review vár
- Kilépési kérelem

---

## Azonnali figyelmet igényel

Összesítő blokk.

Innen a Feladatok oldalra navigálunk.

---

# Pénzügyek

## KPI-k

- Bevétel
- Kiadás
- Profit
- Kintlévőség

---

# Bevétel

Minden olyan tétel, amelyet a bérlőnek számlázunk.

Példák:

- bérleti díj
- továbbszámlázott rezsi
- továbbszámlázott biztosítás
- továbbszámlázott közös költség
- továbbszámlázott egyéb költség

Pozitív érték.

---

# Kiadás

Minden nem bérleti díj jellegű költség.

Példák:

- rezsi
- biztosítás
- közös költség
- felújítás
- saját költség

Negatív érték.

---

# Profit

Profit = Bevétel - Kiadás

Csak egy profit létezik.

Nincs:

- Bruttó profit
- Nettó profit

---

# Kintlévőség

Minden olyan tétel:

- lejárt a határideje
- nincs fizetettnek jelölve

---

# ÚJ FUNKCIÓ: Saját költség

Korábban minden költség a bérlőhöz kapcsolódott.

Mostantól létezik:

## Saját költség

Példák:

- felújítás
- tulajdonosi javítás
- saját biztosítás
- tulajdonosi kiadás

Ezeket nem továbbítjuk a bérlőnek.

---

# Saját költség import

Új email cím:

sajat@in.rentapp.hu

Az ide érkező számlák:

- saját költség draftként jönnek létre
- nem kapcsolódnak bérlőhöz
- nincs mögöttük bérlői fedezet

---

# Normál import

Email:

szamla@in.rentapp.hu

A rendszer:

- feldolgozza a számlát
- draftot készít
- bérlőhöz kapcsolja

---

# Tranzakció típusok

Kizárólag:

- Bérleti díj
- Rezsi
- Biztosítás
- Közös költség
- Felújítás
- Egyéb

---

# Tranzakció lista oszlopok

- Dátum
- Típus
- Megnevezés
- Ingatlan
- Bérlő / Partner
- Összeg
- Státusz
- Dokumentum
- Műveletek

# Dokumentum:
- A feltöltés ikonnal, ha nincs, akkor az ikonra kattintva lehet feltölteni PDF dokumentumot

# Műveletek:
- Szerkesztés
- Fizetettnek jelölés
- Sztorno
- Archiválás


---

# Tranzakció színezés

## Bérleti díj

Példa:

+120 000 Ft

Szín:

Zöld

---

## Továbbszámlázott költség

Példa:

28 500 Ft

Szín:

Normál

Nincs előjel.

---

## Saját költség

Példa:

-45 000 Ft

Szín:

Piros

---

# Archiválás

Archivált rekord:

- halványított sor
- státusz = Archivált

---

# Dokumentum ikon

PDF ikon csak akkor jelenik meg, ha van dokumentum.
A feltöltés a feltöltés ikonra kattintva is elvégezhető
Az Új tétel rögzítésénél is feltölthető a számlához tartozó PDF dokumentum, ha nem az AI Import folyamaton vagy levélküldésen keresztül történik a számla előállítása.
AI vagy email+ AI folamatnál a számla automatiksaun feltöltődik a tételhez

---

# Importok oldal

## KPI-k

- Beérkezett
- Feldolgozás alatt
- Ellenőrzésre vár
- Feldolgozva

---

# Import címek

Normál:

szamla@in.rentapp.hu

Saját költség:

sajat@in.rentapp.hu

---

# Import pipeline

Beérkezett

↓

Feldolgozás

↓

Ellenőrzés

↓

Kész

---

# Manuális PDF feltöltés

## Kötelező

Ingatlan kiválasztása

ha nincs konkrét ingatlan kiválasztva.

---

## Import típus

- Továbbított költség
- Saját költség

---

## Feltöltés

Drag & Drop

vagy

Tallózás

---

# Bérlők oldal

## Funkciók

### Bérlő lista

- Név
- Email
- Ingatlan
- Státusz

---

### Új bérlő meghívása

Adatok:

- Név
- Email
- Ingatlan

---

### Kilépési kérelmek

Lehetséges műveletek:

- Elfogadás
- Elutasítás

---

# Feladatok oldal

A rendszer operatív központja.

Ide kerül minden emberi döntést igénylő esemény.

---

# KPI-k

- Lejárt tételek
- Közelgő esedékességek
- Import review
- Kilépési kérelmek

---

# Prioritások

- Magas
- Közepes
- Alacsony
- Elvégzett

---

# Feladat típusok

Példák:

- Bérleti díj lejárt
- Import ellenőrzés
- Rezsi esedékes
- Kilépési kérelem

---

# Dashboard kapcsolatok

A Dashboard:

- Következő események
- Azonnali figyelmet igényel

blokkjai ide navigálnak.

---

# Mobil verzió

Bottom navigation:

- Áttekintés
- Pénzügyek
- Importok
- Bérlők
- Feladatok

Ötletláda és Kapcsolat hamburger menübe kerülhet.

---

# Világos és sötét mód

Mindkét mód támogatott.

Beállítás:

- Automatikus
- Világos
- Sötét

A felhasználó manuálisan is válthat.

---
# Ikonok
Az icon_set mappában vannak az ikonok. 
- az ikonokat SVG formátumra kell alakítani
- Ne feledd a design szerint CSS-ben kerekíteni őket, hogy ne látszódjon a fehér szélük.


---


# Végső UX alapelv

A Rentapp nem adminisztrációs rendszer.

A Rentapp egy operatív vezérlőközpont.

A felhasználónak mindig azt kell látnia:

- mi történt
- mi vár feldolgozásra
- mi igényel döntést
- mennyi pénzt termelnek az ingatlanjai
- hol van teendője

Minden képernyőnek ezt a célt kell szolgálnia.