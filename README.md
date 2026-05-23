# HTML Presenter View

[![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-f7df1e?logo=javascript&logoColor=111)](#)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-zero-2ea44f)](#)
[![Framework Agnostic](https://img.shields.io/badge/framework-agnostic-0969da)](#)
[![License: MIT](https://img.shields.io/badge/license-MIT-black)](#license)

[中文说明](README.zh-CN.md)

Add a professional presenter view to any HTML slide deck.

`HTML Presenter View` is a zero-dependency speaker console for browser-based presentations. It opens a separate presenter window with current slide preview, next slide preview, speaker notes, timer, thumbnail navigation, blackout mode, and audience fullscreen support.

## Why

Most HTML slide decks are great for visual storytelling, but they often lack the presenter tools expected in Keynote or PowerPoint.

This project keeps the deck as plain HTML while adding the missing presenter workflow:

- See the current slide and the next slide.
- Read and edit speaker notes during the session.
- Control the audience view from a separate window.
- Present from `file://`, `localhost`, or a hosted page.

## Features

- Current slide preview rendered from the audience viewport, then scaled down without clipping.
- Next slide preview for preparing transitions.
- Speaker notes from `data-notes` or hidden `.speaker-notes` elements.
- Editable notes inside the presenter window for the current session.
- Timer that starts when presenter view opens.
- Slide counter and thumbnail navigation.
- Keyboard navigation with arrow keys and space.
- Blackout mode with `B`.
- Audience fullscreen button for single-screen and dual-screen presenting.
- No build step, no runtime dependency, no framework lock-in.

## Demo

Open the included sample deck:

```bash
open test-ppt/index.html
```

Then press `P` to open the presenter view.

If your browser blocks popups, allow popups for the page and press `P` again.

### Audience View

![Audience view demo](docs/images/demo1.png)

### Presenter View

![Presenter view demo](docs/images/demo2.png)

## Quick Start

Copy the runtime files next to your HTML deck:

```bash
cp assets/presenter-view.js path/to/your/deck/
cp assets/presenter-view.css path/to/your/deck/
```

Add this before `</body>`:

```html
<!-- Presenter View -->
<link rel="stylesheet" href="presenter-view.css">
<script src="presenter-view.js"></script>
<script>
  PresenterView.init({ slideSelector: '.slide' });
</script>
```

Make sure each slide matches the selector:

```html
<section class="slide">
  <h1>Hello</h1>
</section>
```

Open the HTML file in a browser and press `P`.

## Speaker Notes

Use a `data-notes` attribute:

```html
<section class="slide" data-notes="Mention the launch date and pricing.">
  <h1>Launch Plan</h1>
</section>
```

Or add a hidden notes element:

```html
<section class="slide">
  <h1>Launch Plan</h1>
  <div class="speaker-notes" hidden>
    Mention the launch date and pricing.
  </div>
</section>
```

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `P` | Open or close presenter view |
| `Right`, `Down`, `Space` | Next slide |
| `Left`, `Up` | Previous slide |
| `B` | Toggle audience blackout |
| `Esc` | Close presenter view |

## API

```js
PresenterView.init({ slideSelector: '.slide' });

PresenterView.start();
PresenterView.stop();
PresenterView.next();
PresenterView.prev();
PresenterView.goTo(3); // 0-indexed

console.log(PresenterView.isActive);
console.log(PresenterView.slideCount);
console.log(PresenterView.currentIndex);
```

## Configuration

```js
PresenterView.init({
  slideSelector: '.slide',
  notesAttribute: 'data-notes',
  notesSelector: '.speaker-notes',
  startKey: 'p',
  aspectRatio: 16 / 9,
  dispatchNavKeys: true,
  onNavigate: null,
});
```

| Option | Default | Description |
| --- | --- | --- |
| `slideSelector` | `.slide` | CSS selector used to collect slides |
| `notesAttribute` | `data-notes` | Attribute used for speaker notes |
| `notesSelector` | `.speaker-notes` | Element selector used for speaker notes |
| `startKey` | `p` | Keyboard key that opens presenter view |
| `aspectRatio` | `16 / 9` | Fallback ratio when viewport size is unavailable |
| `dispatchNavKeys` | `true` | Dispatch arrow key events to drive existing deck navigation |
| `onNavigate` | `null` | Custom navigation callback: `(index, direction) => void` |

## Codex Skill Usage

This repository is also packaged as a Codex skill.

Install it into your local Codex skills directory:

```bash
rsync -a --exclude .git ./ ~/.codex/skills/html-presenter-view/
```

Restart Codex, then ask:

```text
Add presenter view to ./my-deck/index.html
```

Codex will copy the assets, inject the initialization snippet, and use the right slide selector when it can infer one from the deck.

## How It Works

The presenter window is generated with plain browser APIs:

- `window.open` creates the presenter console.
- `window.postMessage` keeps the audience page and presenter page in sync.
- The preview iframe renders slides at the audience viewport size, then scales the iframe down to fit the console.
- The preview iframe inherits the source page's `html` and `body` classes/styles.
- Preview-only CSS reveals common animation placeholders such as `[data-anim]`.

This keeps `vw`, `vh`, absolute positioning, and responsive layouts aligned with what the audience actually sees.

## Project Structure

```text
.
├── assets/
│   ├── presenter-view.css
│   └── presenter-view.js
├── test-ppt/
│   ├── index.html
│   ├── presenter-view.css
│   └── presenter-view.js
├── README.md
├── README.zh-CN.md
└── SKILL.md
```

## Browser Notes

- Presenter view opens a popup, so popup blocking must be disabled for the deck page.
- Fullscreen requests depend on browser permissions and must be triggered by a user action.
- `file://` works because synchronization uses `postMessage` instead of same-origin-only channels.

## License

MIT. See the source header in `assets/presenter-view.js`.
