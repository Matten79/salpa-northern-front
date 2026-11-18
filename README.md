# Salpa: Northern Front

*Itärajan puolustus – Vaalimaalta Ylä-Lappiin.*

3D low-poly tower defence -selainpeli Suomen itärajalta. Itäraja on jaettu kuuteen sektoriin, Kaakkois-Suomesta Ylä-Lappiin, ja jokaisella on oma maastonsa ja oma puolustettava kaupunkinsa.

**Pelaa:** `https://<käyttäjätunnus>.github.io/salpa-northern-front/`

## Ominaisuudet

- Strateginen kampanja: 6 sektoria, viikkoja 12, uhka kasvaa (punainen = kiireellinen, keltainen = uhka kasvaa), valtakunnan kestävyys
- Tower defence -taistelut: 11 rakennettavaa kalustoa (mm. henkilö- ja panssarimiinat) + purku, linnoittaminen, päivitykset
- Hankinnat määrärahoilla: Leopard 2A6 ja Patria AMV (liikkuvat), K9 Moukari, NASAMS, pysyvät parannukset
- Tulituki: F-35 ja HIMARS (latautuminen 4 min) sekä kertakäyttöinen ydinisku
- ICEYE-tutkasatelliitti: paljastaa viholliset yöllä ja sumussa, paikantaa tykistöpatterin ja erikoisjoukot; tilauksella uhkaennuste kartalle
- Viholliset: jalkaväki, BMP, panssarivaunu, lennokki, taisteluhelikopteri, häirintäasema, erikoisjoukot, tykistöpatteri
- Vuodenajat, yö, sumu ja lumimyräkkä; porot pohjoisessa
- Asemat säilyvät pidetyssä sektorissa, kesken jäänyt taistelu jatkuu
- Äänet, grafiikka-asetus, opastus, suomi/englanti
- Asennettavissa puhelimen kotinäytölle (PWA), toimii myös ilman nettiä

## Rakenne

```
src/main.js       pelimoottori (maasto, reitinhaku, tornit, viholliset, UI, strateginen kartta)
src/sectors.js    sektoreiden asetukset ja Suomen kartan ääriviivat
src/icons.js      rakennusten ja tulituen SVG-kuvakkeet
src/audio.js      äänet (WebAudio-synteesi, ei äänitiedostoja)
template.html     HTML-pohja ja tyylit
assets/           kansikuva, Oswald-fontti ja sovelluskuvakkeet
build.mjs         build-skripti (esbuild) → docs/index.html
docs/             valmis peli (index.html) + PWA-tiedostot (manifest, sw.js, kuvakkeet)
```

## Kehitys omalla koneella

Tarvitaan Node.js 18 tai uudempi.

```bash
npm install
npm run build     # rakentaa docs/index.html
npm run dev       # rakentaa uudelleen aina kun tallennat muutoksen
```

Avaa `docs/index.html` selaimessa. Kun olet tehnyt muutoksen, aja `npm run build` ja vie muuttunut `docs/index.html` GitHubiin.

## Kansikuvan vaihto

Korvaa `assets/cover.jpg` (vaakakuva 1376×768 px, tekstit valmiina kuvassa) ja aja `npm run build`.

## Sektoreiden muokkaus

Kaikki sektoreiden asetukset ovat tiedostossa `src/sectors.js`:
- tiet, järvet, joet, suot ja tunturit (koordinaatit ruutuina, kartta 30×18, raja kohdassa x=24)
- talviaallot, aaltojen määrä ja aloitusbudjetti
- vihollisen kokoonpanokertoimet (`mix`)
- porojen määrä ja kaupungin koko

## Lisenssit

- Oswald-fontti: SIL Open Font License 1.1 (@fontsource/oswald)
- three.js: MIT
