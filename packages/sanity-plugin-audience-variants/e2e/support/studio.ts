import {expect, type Locator, type Page} from '@playwright/test'

/**
 * Page helpers for the Studio's article editor and the plugin's UI. Methods
 * act like an editor would (click, type, use menus); tests then check what
 * the Studio shows and what it stored.
 *
 * Text arguments find blocks by their exact text, so give blocks in a test
 * distinct text.
 */
export class Studio {
  readonly editor: Locator

  constructor(readonly page: Page) {
    this.editor = page.locator('[data-pt-editor="true"]')
  }

  async open(id: string) {
    await this.page.goto(`/structure/article;${id}`)
    await expect(this.editor).toBeVisible({timeout: 30_000})
    // The editor is interactive once it's no longer read-only (loading).
    await expect(this.editor).toHaveAttribute('data-read-only', 'false', {timeout: 30_000})
  }

  // -------------------------------------------------------------------------
  // Locators

  /** A text block anywhere in the body, by its exact text. */
  block(text: string): Locator {
    return this.editor.locator(this.blockMatcher(text))
  }

  /** Unrooted, so it can be used inside `filter({has})` relative to any element. */
  private blockMatcher(text: string): Locator {
    // Whole-block text, so blocks made of several spans (links, bold) match too.
    return this.page
      .locator('[data-pt-block="text"]')
      .filter({hasText: new RegExp(`^${escapeRegExp(text)}$`)})
  }

  /** Top-level text blocks' texts, in order (variations show as `[variation]`). */
  async topLevelTexts(): Promise<string[]> {
    return this.editor.evaluate((el) =>
      [...el.children].map((child) =>
        child.hasAttribute('data-audience-variation') ? '[variation]' : (child.textContent ?? ''),
      ),
    )
  }

  variations(): Locator {
    return this.editor.locator('[data-audience-variation]')
  }

  /** The nth variation in the body (0-based). */
  variation(n = 0): Locator {
    return this.variations().nth(n)
  }

  /** Sections of a variation, in display order. */
  sections(variation: Locator = this.variation()): Locator {
    return variation.locator('[data-audience-section]')
  }

  /** A variation's section whose content includes `text`. */
  sectionWith(text: string, variation: Locator = this.variation()): Locator {
    return this.sections(variation).filter({has: this.blockMatcher(text)})
  }

  defaultSection(variation: Locator = this.variation()): Locator {
    return variation.locator('[data-audience-section="default"]')
  }

  /** The label line saying who sees a section ("EMEA · Partners"). */
  sectionLabel(section: Locator): Locator {
    return section.getByTestId('section-picker')
  }

  /** What each section's label says, in display order. */
  async sectionLabels(variation: Locator = this.variation()): Promise<string[]> {
    return this.sections(variation)
      .getByTestId('section-picker')
      .evaluateAll((els) => els.map((el) => el.textContent ?? ''))
  }

  /** Portalled popovers (pickers) and menus. */
  popover(): Locator {
    return this.page.locator('[data-ui="Popover"]').last()
  }

  // -------------------------------------------------------------------------
  // Caret and selection

  /** Put the caret in a block: at its end (default), its start, or an offset. */
  async caretIn(text: string, at: 'start' | 'end' | number = 'end') {
    const span = this.block(text).locator('[data-pt-text]').first()
    await span.click()
    await this.setSelection({text, offset: at}, {text, offset: at})
  }

  /**
   * Select from a point in one block to a point in another (both found by
   * exact text). Sets a DOM selection, which the editor picks up like a
   * mouse selection.
   */
  async select(from: string, to: string = from) {
    await this.block(from).locator('[data-pt-text]').first().click()
    await this.setSelection({text: from, offset: 'start'}, {text: to, offset: 'end'})
  }

  private async setSelection(
    anchor: {text: string; offset: 'start' | 'end' | number},
    focus: {text: string; offset: 'start' | 'end' | number},
  ) {
    await this.editor.evaluate(
      (editor, {anchor, focus}) => {
        const point = ({text, offset}: typeof anchor) => {
          const spans = [...editor.querySelectorAll('[data-pt-text]')]
          const blocks = [...editor.querySelectorAll('[data-pt-block="text"]')]
          const block = blocks.find(
            (b) =>
              [...b.querySelectorAll('[data-pt-text]')].map((s) => s.textContent).join('') === text,
          )
          if (!block) throw new Error(`No block with text "${text}"`)
          const own = spans.filter((s) => block.contains(s))
          const node = (s: Element) => s.firstChild ?? s
          if (offset === 'start') return {node: node(own[0]), offset: 0}
          if (offset === 'end') {
            const last = own.at(-1)!
            return {node: node(last), offset: last.textContent?.length ?? 0}
          }
          let rest = offset
          for (const s of own) {
            const len = s.textContent?.length ?? 0
            if (rest <= len) return {node: node(s), offset: rest}
            rest -= len
          }
          throw new Error(`Offset ${offset} past the end of "${text}"`)
        }
        const a = point(anchor)
        const f = point(focus)
        const selection = window.getSelection()!
        selection.setBaseAndExtent(a.node, a.offset, f.node, f.offset)
      },
      {anchor, focus},
    )
    // Let the editor sync its selection from the DOM.
    await this.page.waitForTimeout(100)
  }

  async type(text: string) {
    await this.page.keyboard.type(text, {delay: 10})
  }

  async press(...keys: string[]) {
    for (const key of keys) await this.page.keyboard.press(key)
  }

  /**
   * Undo, the way the editor sees it when a user presses Cmd+Z / Ctrl+Z.
   *
   * Don't use `press('ControlOrMeta+z')` for this. On macOS Playwright turns Meta+Z into
   * Chromium's native "undo:" command instead of a keydown the editor handles. Native undo
   * only reverses the browser's own DOM edits (typing), so plugin actions such as wrap,
   * unwrap and remove look un-undoable in tests even though they undo fine by hand.
   * Control+Z reaches the editor's own undo on every platform.
   */
  async undo() {
    await this.page.keyboard.press('Control+z')
  }

  // -------------------------------------------------------------------------
  // Plugin actions

  /** Alt+Shift+V: wrap the selected blocks in a variation. */
  async wrapShortcut() {
    await this.page.keyboard.press('Alt+Shift+KeyV')
  }

  /** The variation's action bar (Variant / Default Audience / Unwrap). */
  async variationActions(variation: Locator = this.variation()): Promise<Locator> {
    await variation.hover()
    const actions = variation.getByTestId('variation-actions')
    await expect(actions).toBeVisible()
    return actions
  }

  async addVariant(variation: Locator = this.variation()) {
    const actions = await this.variationActions(variation)
    await actions.getByRole('button', {name: 'Variant', exact: true}).click()
  }

  async addDefault(variation: Locator = this.variation()) {
    const actions = await this.variationActions(variation)
    await actions.getByRole('button', {name: 'Default Audience', exact: true}).click()
  }

  /** Click Unwrap, and confirm unless `confirm` is false. Returns the confirm button. */
  async unwrap(variation: Locator = this.variation(), {confirm = true} = {}) {
    const actions = await this.variationActions(variation)
    await actions.getByRole('button', {name: 'Unwrap', exact: true}).click()
    const confirmButton = actions.getByRole('button').last()
    if (confirm) await confirmButton.click()
    return confirmButton
  }

  /** Open a section's "…" menu and pick an item by its text. */
  async sectionMenu(section: Locator, item: string | RegExp) {
    await section.hover()
    await section.getByTestId('section-menu').click()
    await this.page.getByRole('menuitem', {name: item}).click()
  }

  /** Open a section's audience picker. */
  async openPicker(section: Locator): Promise<Locator> {
    await section.hover()
    await this.sectionLabel(section).click()
    const popover = this.popover()
    await expect(popover).toBeVisible()
    return popover
  }

  /**
   * Tick (or untick) options in a section's picker by their full titles,
   * then close it.
   */
  async pick(section: Locator, ...titles: string[]) {
    const popover = await this.openPicker(section)
    for (const title of titles) await this.option(popover, title).click()
    await this.page.keyboard.press('Escape')
    await expect(popover).toBeHidden()
  }

  // -------------------------------------------------------------------------
  // Toolbar

  /** The toolbar's "Audience variation" insert button. */
  variationInsertButton(): Locator {
    return this.page
      .getByTestId('audienceVariation-insert-menu-button')
      .and(this.page.locator('[aria-hidden="false"]'))
  }

  /** Open the toolbar's insert menu ("+"/"…"). */
  async openInsertMenu(): Promise<Locator> {
    await this.page.getByTestId('insert-menu-button').click()
    const menu = this.page.getByRole('menu')
    await expect(menu).toBeVisible()
    return menu
  }

  // -------------------------------------------------------------------------
  // Block objects

  /** A block object (image, table…) by text in its preview. */
  object(text: string): Locator {
    return this.editor.locator('[data-pt-block="object"]').filter({hasText: text})
  }

  /**
   * Drag a block object by its handle and drop it on the top edge (before)
   * or bottom edge (after) of a text block. (Dropping in the middle of the
   * text splits the block there.)
   */
  async dragObject(objectText: string, target: string, where: 'before' | 'after') {
    const handle = this.object(objectText).locator('[draggable="true"]').first()
    const block = this.block(target)
    const box = await block.boundingBox()
    if (!box) throw new Error(`Block "${target}" isn't visible`)
    await handle.dragTo(block, {
      targetPosition: {x: 20, y: where === 'before' ? 2 : box.height - 2},
    })
  }

  // -------------------------------------------------------------------------
  // "Preview as"

  previewAsButton(): Locator {
    return this.page.getByRole('button', {name: 'Preview as', exact: true})
  }

  /** Preview the body as readers matching these option titles. */
  async previewAs(...titles: string[]) {
    await this.previewAsButton().click()
    const popover = this.popover()
    await expect(popover).toBeVisible()
    for (const title of titles) await this.option(popover, title).click()
    await this.page.keyboard.press('Escape')
    await expect(popover).toBeHidden()
  }

  /** A checkbox in an open picker, by its option title. */
  option(popover: Locator, title: string): Locator {
    return popover.getByRole('checkbox', {name: new RegExp(`^${escapeRegExp(title)}`)})
  }
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
