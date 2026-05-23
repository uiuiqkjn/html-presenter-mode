# HTML Presenter View / HTML 演讲者视图

[![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-f7df1e?logo=javascript&logoColor=111)](#)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-zero-2ea44f)](#)
[![Framework Agnostic](https://img.shields.io/badge/framework-agnostic-0969da)](#)
[![License: MIT](https://img.shields.io/badge/license-MIT-black)](#license--许可证)

Add a professional presenter view to any HTML slide deck.

为任意 HTML 幻灯片添加专业演讲者视图。

`HTML Presenter View` is a zero-dependency speaker console for browser-based presentations. It opens a separate presenter window with current slide preview, next slide preview, speaker notes, timer, thumbnail navigation, blackout mode, and audience fullscreen support.

`HTML Presenter View` 是一个零依赖、框架无关的浏览器演讲者控制台。它会打开一个独立的演讲者窗口，提供当前页预览、下一页预览、演讲备注、计时器、缩略图导航、黑屏模式和观众全屏控制。

## Why / 为什么需要它

Most HTML slide decks are great for visual storytelling, but they often lack the presenter tools expected in Keynote or PowerPoint.

很多 HTML PPT 在视觉表达上很自由，但缺少 Keynote 或 PowerPoint 里常见的演讲者工具。

This project keeps the deck as plain HTML while adding the missing presenter workflow:

这个项目保持幻灯片仍然是普通 HTML，同时补齐演讲时需要的工作流：

- See the current slide and the next slide.
- 查看当前页和下一页。
- Read and edit speaker notes during the session.
- 在演讲过程中查看并临时编辑备注。
- Control the audience view from a separate window.
- 在独立窗口中控制观众视图。
- Present from `file://`, `localhost`, or a hosted page.
- 支持从 `file://`、`localhost` 或线上页面直接演示。

## Features / 功能特性

- Current slide preview rendered from the audience viewport, then scaled down without clipping.
- 当前页预览按观众窗口尺寸渲染，再等比缩放，避免右侧或底部内容被裁切。
- Next slide preview for preparing transitions.
- 下一页预览，方便提前准备转场。
- Speaker notes from `data-notes` or hidden `.speaker-notes` elements.
- 支持从 `data-notes` 属性或隐藏的 `.speaker-notes` 元素读取演讲备注。
- Editable notes inside the presenter window for the current session.
- 演讲者窗口内可临时编辑备注，当前会话内生效。
- Timer that starts when presenter view opens.
- 打开演讲者视图后自动开始计时。
- Slide counter and thumbnail navigation.
- 显示页码，并支持缩略图快速跳转。
- Keyboard navigation with arrow keys and space.
- 支持方向键和空格键翻页。
- Blackout mode with `B`.
- 按 `B` 可让观众视图临时黑屏。
- Audience fullscreen button for single-screen and dual-screen presenting.
- `Audience` 按钮可控制观众窗口全屏，适合单屏和双屏演示。
- No build step, no runtime dependency, no framework lock-in.
- 无需构建步骤，无运行时依赖，不绑定任何框架。

## Demo / 示例

Open the included sample deck:

打开内置示例：

```bash
open test-ppt/index.html
```

Then press `P` to open the presenter view.

然后按 `P` 打开演讲者视图。

If your browser blocks popups, allow popups for the page and press `P` again.

如果浏览器拦截弹窗，请允许该页面弹窗后再次按 `P`。

## Quick Start / 快速开始

Copy the runtime files next to your HTML deck:

将运行时文件复制到你的 HTML 幻灯片同级目录：

```bash
cp assets/presenter-view.js path/to/your/deck/
cp assets/presenter-view.css path/to/your/deck/
```

Add this before `</body>`:

在 `</body>` 前加入：

```html
<!-- Presenter View -->
<link rel="stylesheet" href="presenter-view.css">
<script src="presenter-view.js"></script>
<script>
  PresenterView.init({ slideSelector: '.slide' });
</script>
```

Make sure each slide matches the selector:

确保每一页幻灯片都匹配这个选择器：

```html
<section class="slide">
  <h1>Hello</h1>
</section>
```

Open the HTML file in a browser and press `P`.

在浏览器中打开 HTML 文件，然后按 `P`。

## Speaker Notes / 演讲备注

Use a `data-notes` attribute:

使用 `data-notes` 属性：

```html
<section class="slide" data-notes="Mention the launch date and pricing.">
  <h1>Launch Plan</h1>
</section>
```

Or add a hidden notes element:

或添加隐藏的备注元素：

```html
<section class="slide">
  <h1>Launch Plan</h1>
  <div class="speaker-notes" hidden>
    Mention the launch date and pricing.
  </div>
</section>
```

## Keyboard Shortcuts / 快捷键

| Key / 按键 | Action / 操作 |
| --- | --- |
| `P` | Open or close presenter view / 打开或关闭演讲者视图 |
| `Right`, `Down`, `Space` | Next slide / 下一页 |
| `Left`, `Up` | Previous slide / 上一页 |
| `B` | Toggle audience blackout / 切换观众视图黑屏 |
| `Esc` | Close presenter view / 关闭演讲者视图 |

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

## Configuration / 配置

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

| Option / 选项 | Default / 默认值 | Description / 说明 |
| --- | --- | --- |
| `slideSelector` | `.slide` | CSS selector used to collect slides / 用于收集幻灯片的 CSS 选择器 |
| `notesAttribute` | `data-notes` | Attribute used for speaker notes / 备注属性名 |
| `notesSelector` | `.speaker-notes` | Element selector used for speaker notes / 备注元素选择器 |
| `startKey` | `p` | Keyboard key that opens presenter view / 启动演讲者视图的快捷键 |
| `aspectRatio` | `16 / 9` | Fallback ratio when viewport size is unavailable / 无法读取 viewport 时的备用比例 |
| `dispatchNavKeys` | `true` | Dispatch arrow key events to drive existing deck navigation / 通过派发方向键事件驱动现有幻灯片导航 |
| `onNavigate` | `null` | Custom navigation callback: `(index, direction) => void` / 自定义导航回调 |

## Codex Skill Usage / Codex Skill 用法

This repository is also packaged as a Codex skill.

这个仓库也可以作为 Codex skill 使用。

Install it into your local Codex skills directory:

安装到本地 Codex skills 目录：

```bash
rsync -a --exclude .git ./ ~/.codex/skills/html-presenter-view/
```

Restart Codex, then ask:

重启 Codex 后，直接告诉 Codex：

```text
为 ./my-deck/index.html 添加演讲者视图
```

Codex will copy the assets, inject the initialization snippet, and use the right slide selector when it can infer one from the deck.

Codex 会复制资源文件、注入初始化代码，并在能推断时自动使用正确的幻灯片选择器。

## How It Works / 实现原理

The presenter window is generated with plain browser APIs:

演讲者窗口完全由原生浏览器 API 生成：

- `window.open` creates the presenter console.
- `window.open` 创建演讲者控制台窗口。
- `window.postMessage` keeps the audience page and presenter page in sync.
- `window.postMessage` 同步观众页面和演讲者页面状态。
- The preview iframe renders slides at the audience viewport size, then scales the iframe down to fit the console.
- 预览 iframe 按观众窗口 viewport 渲染幻灯片，再整体缩放适配控制台。
- The preview iframe inherits the source page's `html` and `body` classes/styles.
- 预览 iframe 会继承源页面的 `html` 和 `body` class/style。
- Preview-only CSS reveals common animation placeholders such as `[data-anim]`.
- 预览专用 CSS 会静态显示常见动画占位元素，例如 `[data-anim]`。

This keeps `vw`, `vh`, absolute positioning, and responsive layouts aligned with what the audience actually sees.

这样可以保证 `vw`、`vh`、绝对定位和响应式布局与观众实际看到的画面一致。

## Project Structure / 项目结构

```text
.
├── assets/
│   ├── presenter-view.css
│   └── presenter-view.js
├── test-ppt/
│   ├── index.html
│   ├── presenter-view.css
│   └── presenter-view.js
├── SKILL.md
└── README.md
```

## Browser Notes / 浏览器说明

- Presenter view opens a popup, so popup blocking must be disabled for the deck page.
- 演讲者视图会打开弹窗，因此需要允许幻灯片页面弹窗。
- Fullscreen requests depend on browser permissions and must be triggered by a user action.
- 全屏请求受浏览器权限限制，通常必须由用户操作触发。
- `file://` works because synchronization uses `postMessage` instead of same-origin-only channels.
- 支持 `file://`，因为同步基于 `postMessage`，不依赖同源通道。

## License / 许可证

MIT. See the source header in `assets/presenter-view.js`.

MIT。详见 `assets/presenter-view.js` 文件头部声明。
