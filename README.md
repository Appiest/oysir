# OySir Pitch

A 3-minute client pitch for **OySir**, an oyster-shell fragrance atomizer: open the shell, press the pearl. Inspired by "Our Time" from *Merrily We Roll Along*.

The deck is a small static web app. It has no build step and no dependencies to install.

The live version is at **https://appiest.github.io/oysir/**. It updates every time `main` changes (see `.github/workflows/pages.yml`).

## Run it

Open it through any static server (the live 3D model loads `meshes.json`, so opening the file directly will not work):

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Present

| Key | Action |
|---|---|
| → · Space · Enter | Next slide |
| ← · Backspace | Previous slide |
| N | Show or hide speaker notes and the 3:00 timer |
| R | Reset the timer |
| F | Full screen |
| P | Play or pause “Our Time” |
| Home / End | First / last slide |

You can also click (right two-thirds forward, left third back) or swipe. The timer starts when you leave the first slide. Each slide has its own link, for example `#slide-9`.

On the **3D model** slide, the model turns by itself. Drag it to turn it, and tap the pearl to see it spray.

On the **“Our Time”** slide, press P or the pearl button to play the song (it streams from YouTube, so you need an internet connection). When you move to another slide, the song fades out.

To present without internet, run the deck locally and put the song at `audio/our-time.m4a`. On `localhost`, the deck plays that file instead of YouTube. The `audio/` folder is in `.gitignore`, so the recording never goes into the public repository.

## Files

```
index.html     the ten slides and their speaker notes
styles.css     layout and type (a 1920×1080 stage scaled to the screen)
app.js         navigation, notes, timer, and the live 3D model (three.js from a CDN)
img/           wordmark, sketch, Vizcom renders and crops, workbench screenshot, model views
meshes.json    the 3D print model, packed for the browser
params.json    hinge, pearl and nozzle positions for the model
```

To change a slide, edit its `<section>` in `index.html`. The text in each `<aside class="notes">` is that slide's speaker notes.

## Font note

The OySir wordmark is drawn from **Vogue** by Vladimir Nikolic (free for personal use, from dafont.com). The repository holds only the outlined letters (`img/oysir-wordmark.svg`, also inlined in `index.html`), not the font file. Commercial use of the wordmark needs a license from the author.
