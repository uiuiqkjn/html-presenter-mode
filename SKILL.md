---
name: html-presenter-view
description: Add a presenter view (演讲者视图) to any HTML slide deck — dual-window presentation with speaker notes, timer, slide previews, and cross-window sync. Zero dependencies, framework-agnostic. Use when the user needs a presenter console for HTML slides, mentions "presenter view", "演讲者视图", "speaker console", or wants to present HTML slides with notes and a timer on a separate screen.
---

# HTML Presenter View

为任意 HTML 幻灯片添加演讲者视图。

## Workflow

当用户要求为 HTML PPT 添加演讲者视图时：

### 1. 确认目标文件

找到用户要添加演讲者视图的 HTML 文件路径。

### 2. 拷贝资源

将 `assets/presenter-view.js` 和 `assets/presenter-view.css` 拷贝到目标 HTML 同级目录：

```bash
cp <SKILL_ROOT>/assets/presenter-view.js <目标目录>/
cp <SKILL_ROOT>/assets/presenter-view.css <目标目录>/
```

### 3. 注入初始化代码

在目标 HTML 的 `</body>` 之前插入：

```html
<!-- Presenter View -->
<link rel="stylesheet" href="presenter-view.css">
<script src="presenter-view.js"></script>
<script>
  PresenterView.init({ slideSelector: '.slide' });
</script>
```

如果幻灯片的 CSS 选择器不是 `.slide`，调整 `slideSelector` 参数。

### 4. 可选：为幻灯片添加备注

如果需要演讲备注，给 `<section class="slide">` 添加 `data-notes` 属性：

```html
<section class="slide" data-notes="这是演讲者备注内容。">
```

或嵌入隐藏元素：

```html
<section class="slide">
  <div class="speaker-notes" hidden>这是演讲者备注内容。</div>
</section>
```

### 5. 验证

在浏览器打开 HTML，按 **P** 键确认弹窗正常打开，幻灯片预览正确，按钮可用。

## 演讲者面板功能

- **当前页预览**：左侧大区域，按弹窗实际 viewport 渲染后缩放，保证 vw/vh 单位正确
- **下一页预览**：右上角
- **演讲备注**：右下角，直接点击即可编辑，按 Enter 或点击其他地方保存（当前会话有效）
- **计时器**：左上角，从开启时计时
- **幻灯片编号**：`Slide 3 / 20`
- **缩略图导航**：底部缩略图条，点击直接跳转
- **B 键黑屏**：观众视图全黑，点击恢复
- **侧栏拖拽**：可拖拽调整右侧面板宽度

## 键盘快捷键

| 键 | 操作 |
|----|------|
| `P` | 开启/关闭演讲者视图 |
| `→` `↓` `Space` | 下一页 |
| `←` `↑` | 上一页 |
| `Esc` | 退出演讲者视图 |
| `B` | 黑屏/恢复 |

## 双屏

检测到外接屏时自动全屏观众窗口到外接显示器，演讲者面板保留在主屏幕。单屏时弹窗覆盖模式。

## API

```
PresenterView.init({ slideSelector: '.slide' })  // 初始化，按 P 启动
PresenterView.start()      // 开启
PresenterView.stop()       // 关闭
PresenterView.next()       // 下一页
PresenterView.prev()       // 上一页
PresenterView.goTo(n)      // 跳到第 n 页 (0-indexed)
PresenterView.isActive     // 是否激活中
PresenterView.slideCount   // 总页数
```

## 配置选项

```js
PresenterView.init({
  slideSelector: '.slide',    // 幻灯片选择器
  notesAttribute: 'data-notes', // 备注属性名
  notesSelector: '.speaker-notes', // 备注元素选择器
  startKey: 'p',              // 快捷键
  dispatchNavKeys: true,      // true=分发键盘事件导航(适配大部分deck)
  onNavigate: null,           // 自定义导航回调 (index, direction)
});
```

## 原理

零依赖纯原生 JS。`window.postMessage` 跨窗口通信（兼容 file:// 和 about:blank 不同源）。弹窗自动收集主页 `<style>` / `<link>` 注入。幻灯片在弹窗 viewport 实际尺寸渲染后 CSS transform 缩放，保证 vw/vh 单位正确。
