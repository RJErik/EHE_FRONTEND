# Event Horizon Exchange 

 

## Futtatási utasítások 

 

A program futásához elengedhetetlenek az alábbi fájlók megadása a Spring Boot alkalmazás szervernek: 

1. JWT kriptográfiai kulcsokat tartalmazó fájl (amelyre, egy jks fájlt vár a rendszer) 

2. Email használatához szükséges, token és e-mail cím, 

3. Alpaca API kulcsot és titkot tartalmazó fájl, 

4. Titkosításra használt kulcsók, az oszlopoknak (mint az felhasználó API kulcsai) 

 

Ezeknek az elérési útjait be kell állítani, az adatbázissal, frontend, annak különböző elérési útjaival együtt, a jelenlegi beállítások megfelelőek, a frontendet tekintve. Valamint azt, hogyha a szeretnék, hogy a sütit Secure-ok legyenek (éles környezetben). Ezen felül még belehet állítani az igazoló token-ek, jwt token-ek életartalmát. 

 

A futtáshoz szükséges az NGINX webszerver konfigurálása. Amelyet megtalálnak a beadott fájlók között, az elérései utat frissíteni kell majd, ahová el kell majd helyezni a három frontend buildjeit. Valamint meg kell arról győződni, hogy a számítógép feltudja oldani a weboldal címét, dns beállításai megfelelőek erre a célra (az oldal az https://www.eventhorizonexchange.com oldalon fut). Itt még érdemes megjegyezni, hogy fog kelleni egy self-signed tanúsítvány a webszervernek, a működése érdekében. 

 

## Elérhetőség 

 

A szakdolgozat egyes részei elérhetőek az alábbi linkeken: 

 

1. Adatbázis: https://github.com/RJErik/EHE_DB 

2. Spring Boot server: https://github.com/RJErik/EHE_SERVER 

3. Nem bejelentkezett felhasználók frontendje: https://github.com/RJErik/ehe_frontend_ua 

4. Általános felhasználók frontendje: https://github.com/RJErik/EHE_FRONTEND 

5. Adminisztrátorok frontendje: https://github.com/RJErik/EHE_FE 
