# Salpa: Northern Front

*Itärajan puolustus – Vaalimaalta Ylä-Lappiin.*

3D low-poly tower defence -selainpeli Suomen itärajalta. Itäraja on jaettu kuuteen sektoriin, Kaakkois-Suomesta Ylä-Lappiin, ja jokaisella on oma maastonsa ja oma puolustettava kaupunkinsa.

**Pelaa:** `https://<käyttäjätunnus>.github.io/salpa-northern-front/`

## Rakenne

```
src/main.js       pelimoottori (maasto, reitinhaku, tornit, viholliset, UI, strateginen kartta)
src/sectors.js    sektoreiden asetukset ja Suomen kartan ääriviivat
src/icons.js      rakennusten ja tulituen SVG-kuvakkeet
template.html     HTML-pohja ja tyylit
assets/           kansikuva (cover.jpg) ja Oswald-fontti, upotetaan buildissa
build.mjs         build-skripti (esbuild) → docs/index.html
docs/index.html   valmis peli yhtenä tiedostona (GitHub Pages julkaisee tämän)
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
